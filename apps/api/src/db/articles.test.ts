import type { ScrapedArticle } from '@aimag/shared';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Article, Author, Category, ScrapeRun } from '../models/index.js';
import { connectDb, disconnectDb } from './connection.js';
import { upsertArticle } from './articles.js';
import { seedCategories } from './seed.js';

const TEST_URI = process.env.MONGODB_URI_TEST ?? 'mongodb://localhost:27017/aimag_test';

const sample = (over: Partial<ScrapedArticle> = {}): ScrapedArticle => ({
  title: 'Sample Title',
  excerpt: 'A short excerpt.',
  imageUrl: 'https://assets.example.com/a.jpg',
  imageThumbUrl: 'https://assets.example.com/a-small.jpg',
  imageAlt: 'alt',
  category: { name: 'AI Strategy', slug: 'ai-strategy' },
  authorName: 'Adam Pond',
  publishedAt: new Date('2026-11-01T10:00:00Z'),
  sourceModifiedAt: null,
  sourceUrl: 'https://aimagazine.com/news/sample-title',
  sourceSlug: 'sample-title',
  slug: 'sample-title',
  sourceHash: 'hash-1',
  ...over,
});

beforeAll(async () => {
  await connectDb(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});
beforeEach(async () => {
  // Empty collections instead of dropping the DB: avoids rebuilding indexes for every test.
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

describe('upsertArticle', () => {
  it('creates, then reports unchanged for same hash', async () => {
    expect(await upsertArticle(sample())).toBe('created');
    expect(await upsertArticle(sample())).toBe('unchanged');
    expect(await Article.countDocuments()).toBe(1);
    expect(await Author.countDocuments()).toBe(1);
    expect(await Category.countDocuments()).toBe(1);
  });

  it('updates when the hash changes but keeps admin fields and slug', async () => {
    await upsertArticle(sample());
    await Article.updateOne({}, { isFeatured: true, isHidden: true, 'seo.noindex': true });
    expect(
      await upsertArticle(sample({ title: 'New Title', slug: 'new-title', sourceHash: 'hash-2' })),
    ).toBe('updated');
    const a = await Article.findOne().lean();
    expect(a?.title).toBe('New Title');
    expect(a?.slug).toBe('sample-title');
    expect(a?.isFeatured).toBe(true);
    expect(a?.isHidden).toBe(true);
    expect(a?.seo?.noindex).toBe(true);
  });

  it('suffixes the slug on collision with a different source URL (stable per URL)', async () => {
    await upsertArticle(sample());
    const other = sample({
      sourceUrl: 'https://aimagazine.com/news/other-xyz123',
      sourceSlug: 'other-xyz123',
      sourceHash: 'h3',
    });
    await upsertArticle(other);
    const slugs = (await Article.find().lean()).map((a) => a.slug).sort();
    expect(slugs[0]).toBe('sample-title');
    expect(slugs[1]).toMatch(/^sample-title-[0-9a-f]{6}$/);
    // re-saving the same story with changed content keeps its slug (URLs never change under readers)
    await upsertArticle({ ...other, sourceHash: 'h4', title: 'Renamed' });
    expect((await Article.find().lean()).map((a) => a.slug).sort()).toEqual(slugs);
  });

  it('gives different slugs to stories whose titles share their first 80 characters (the week 1/2/3 incident)', async () => {
    const base =
      'this-weeks-top-five-stories-in-ai-week-for-the-month-of-the-year-two-thousand-and-twenty-six';
    const long = (n: number, over = {}) =>
      sample({
        title: `This week's top five stories in AI: week ${n} of the month of October`,
        slug: base.slice(0, 80), // what the normalizer produces: identical for all three
        sourceUrl: `https://aimagazine.com/news/this-weeks-top-five-stories-in-ai-week-${n}-october`,
        sourceSlug: `this-weeks-top-five-stories-in-ai-week-${n}-october`, // same last 6 characters, too
        sourceHash: `hash-${n}`,
        ...over,
      });
    const results = [];
    for (const n of [1, 2, 3]) results.push(await upsertArticle(long(n)));
    expect(results).toEqual(['created', 'created', 'created']); // no E11000
    const slugs = (await Article.find().lean()).map((a) => a.slug);
    expect(new Set(slugs).size).toBe(3);
    expect(slugs.every((x) => x.length <= 90)).toBe(true);
  });

  it('works without an author', async () => {
    await upsertArticle(sample({ authorName: null }));
    expect((await Article.findOne().lean())?.author).toBeUndefined();
  });

  it('enforces unique sourceUrl at the database level', async () => {
    await upsertArticle(sample());
    await expect(
      Article.create({ ...sample(), category: new mongoose.Types.ObjectId(), slug: 'different' }),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe('models', () => {
  it('declares the PLAN.md indexes', async () => {
    const keys = (await Article.collection.indexes()).map((i) => JSON.stringify(i.key));
    for (const k of [
      { sourceUrl: 1 },
      { slug: 1 },
      { category: 1, publishedAt: -1 },
      { isFeatured: 1, publishedAt: -1 },
      { isHidden: 1, status: 1, publishedAt: -1 },
      { tags: 1, publishedAt: -1 },
      { author: 1, publishedAt: -1 },
      { isHidden: 1, status: 1, viewCount: -1, publishedAt: -1 },
      { publishedAt: -1 },
    ]) {
      expect(keys).toContain(JSON.stringify(k));
    }
    expect(keys.some((k) => k.includes('_fts'))).toBe(true);
    const runIdx = await ScrapeRun.collection.indexes();
    expect(runIdx.find((i) => i.expireAfterSeconds === 90 * 24 * 3600)?.key).toEqual({
      startedAt: -1,
    });
  });

  it('seeds categories idempotently', async () => {
    await seedCategories();
    const n = await Category.countDocuments();
    await seedCategories();
    expect(await Category.countDocuments()).toBe(n);
  });
});
