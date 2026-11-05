import type { ScrapedArticle } from '@aimag/shared';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const createFetcher = vi.fn().mockResolvedValue({});
const discoverEntries = vi.fn();
const fetchArticle = vi.fn();
vi.mock('./run.js', async (orig) => ({
  ...(await orig<typeof import('./run.js')>()),
  createFetcher,
  discoverEntries,
  fetchArticle,
}));

const { connectDb, disconnectDb } = await import('../db/connection.js');
const { runScrape } = await import('./pipeline.js');
const { BlockedError } = await import('./fetcher.js');
const { StageError } = await import('./run.js');
const { Article, ScrapeError, ScrapeRun } = await import('../models/index.js');

const url = (n: number) => `https://aimagazine.com/news/story-${n}`;
const entry = (n: number) => ({ loc: url(n), lastmod: null, imageUrl: null, imageCaption: null });
const article = (n: number, over: Partial<ScrapedArticle> = {}): ScrapedArticle => ({
  title: `Story ${n}`,
  excerpt: `Excerpt ${n}`,
  imageUrl: `https://assets.example.com/${n}.jpg`,
  imageThumbUrl: null,
  imageAlt: null,
  category: { name: 'AI Strategy', slug: 'ai-strategy' },
  authorName: 'Adam Pond',
  publishedAt: new Date('2026-11-01T10:00:00Z'),
  sourceModifiedAt: null,
  sourceUrl: url(n),
  sourceSlug: `story-${n}`,
  slug: `story-${n}`,
  sourceHash: `hash-${n}`,
  ...over,
});
const entries = (n: number) => Array.from({ length: n }, (_, i) => entry(i + 1));
const found = (n: number, warnings: string[] = []) => ({ entries: entries(n), warnings });
/** fetchArticle answering from a plain list, reporting which layer served it. */
const serve = (via = 'next-data') =>
  fetchArticle.mockImplementation(async (_f, e) => ({
    article: article(Number(e.loc.split('-').pop())),
    via,
  }));

beforeAll(async () => {
  await connectDb('mongodb://localhost:27017/aimag_test_pipeline');
});
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  discoverEntries.mockReset();
  fetchArticle.mockReset();
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

describe('runScrape', () => {
  it('imports new articles, skips known URLs, and logs the run', async () => {
    discoverEntries.mockResolvedValue(found(4));
    serve();
    await runScrape({ trigger: 'cli' }); // first run imports all 4
    fetchArticle.mockClear();
    discoverEntries.mockResolvedValue(found(6));
    const s = await runScrape({ trigger: 'cron' });

    expect(fetchArticle).toHaveBeenCalledTimes(2); // only the 2 new ones are fetched
    expect(s).toMatchObject({ status: 'success', created: 2, skipped: 4, failed: 0, urlsFound: 6 });
    expect(s.newSlugs).toEqual(['story-5', 'story-6']);
    expect(await Article.countDocuments()).toBe(6);
    const run = await ScrapeRun.findById(s.runId).lean();
    expect(run).toMatchObject({ trigger: 'cron', status: 'success', created: 2 });
    expect(run?.finishedAt).toBeTruthy();
  });

  it('honours limit, and refresh re-fetches known URLs without duplicating', async () => {
    discoverEntries.mockResolvedValue(found(5));
    serve();
    expect((await runScrape({ trigger: 'cli', limit: 3 })).created).toBe(3);
    fetchArticle.mockClear();
    const s = await runScrape({ trigger: 'cli', refresh: true });
    expect(fetchArticle).toHaveBeenCalledTimes(5);
    expect(s.created).toBe(2);
    expect(await Article.countDocuments()).toBe(5);
  });

  it('records parse failures as ScrapeErrors and marks the run partial', async () => {
    discoverEntries.mockResolvedValue(found(3));
    fetchArticle.mockImplementation(async (_f, e) => {
      if (e.loc === url(2)) throw new StageError('parse', 'no usable title/date in any layer');
      return { article: article(Number(e.loc.split('-').pop())), via: 'next-data' };
    });
    const s = await runScrape({ trigger: 'cli' });
    expect(s).toMatchObject({ status: 'partial', created: 2, failed: 1 });
    const err = await ScrapeError.findOne({ run: s.runId }).lean();
    expect(err).toMatchObject({ stage: 'parse', url: url(2) });
  });

  it('stops immediately and reports blocked on repeated 403/429', async () => {
    discoverEntries.mockResolvedValue(found(5));
    fetchArticle.mockRejectedValue(new BlockedError('blocked (429) 3 times in a row'));
    const s = await runScrape({ trigger: 'cron' });
    expect(s.status).toBe('blocked');
    expect(fetchArticle).toHaveBeenCalledTimes(1);
  });

  it('fails a run that finds zero URLs instead of reporting success', async () => {
    discoverEntries.mockResolvedValue({ entries: [], warnings: ['no URLs from sitemaps'] });
    const s = await runScrape({ trigger: 'cron' });
    expect(s.status).toBe('failed');
    const err = await ScrapeError.findOne({ run: s.runId, stage: 'discover' }).lean();
    expect(err?.message).toMatch(/found no article URLs/);
  });

  it('records discovery warnings on the run', async () => {
    discoverEntries.mockResolvedValue(found(3, ['fell back to the homepage latest-stories list']));
    serve();
    const s = await runScrape({ trigger: 'cron' });
    expect(s.status).toBe('success');
    expect(s.warnings).toContain('fell back to the homepage latest-stories list');
    expect((await ScrapeRun.findById(s.runId).lean())?.warnings).toContain(
      'fell back to the homepage latest-stories list',
    );
  });

  it('fails the run (and logs a discover error) when discovery throws', async () => {
    discoverEntries.mockRejectedValue(new Error('sitemap unreachable'));
    const s = await runScrape({ trigger: 'cron' });
    expect(s.status).toBe('failed');
    expect(await ScrapeError.findOne({ run: s.runId, stage: 'discover' })).toBeTruthy();
  });

  it('stops after the current page when aborted and reports partial', async () => {
    discoverEntries.mockResolvedValue(found(5));
    const ctl = new AbortController();
    fetchArticle.mockImplementation(async (_f, e) => {
      ctl.abort();
      return { article: article(Number(e.loc.split('-').pop())), via: 'next-data' };
    });
    const s = await runScrape({ trigger: 'cron', signal: ctl.signal });
    expect(s).toMatchObject({ status: 'partial', created: 1, aborted: true });
  });
});

describe('per-run details for the admin', () => {
  it('records which articles were new, updated and failed, with the slug that was actually saved', async () => {
    discoverEntries.mockResolvedValue(found(3));
    fetchArticle.mockImplementation(async (_f, e) => {
      if (e.loc === url(3)) throw new StageError('parse', 'no usable title/date in any layer');
      return { article: article(Number(e.loc.split('-').pop())), via: 'next-data' };
    });
    const first = await runScrape({ trigger: 'cli' });
    const run = await ScrapeRun.findById(first.runId).lean();
    expect(run?.items.map((i) => [i.outcome, i.slug ?? i.url])).toEqual([
      ['created', 'story-1'],
      ['created', 'story-2'],
      ['failed', url(3)],
    ]);
    expect(run?.items[2]).toMatchObject({
      stage: 'parse',
      message: expect.stringContaining('no usable title'),
    });

    // a second run: story 1 changed (updated), story 2 unchanged (not listed), story 3 now parses (created)
    fetchArticle.mockImplementation(async (_f, e) => {
      const n = Number(e.loc.split('-').pop());
      return {
        article: article(n, n === 1 ? { sourceHash: 'changed', title: 'Story 1 edited' } : {}),
        via: 'next-data',
      };
    });
    const second = await runScrape({ trigger: 'cli', refresh: true });
    const items = (await ScrapeRun.findById(second.runId).lean())?.items ?? [];
    expect(items.map((i) => [i.outcome, i.slug])).toEqual([
      ['updated', 'story-1'],
      ['created', 'story-3'],
    ]);
  });
});

describe('selector-break detection in a run', () => {
  it('stays quiet for a healthy source', async () => {
    discoverEntries.mockResolvedValue(found(6));
    serve('next-data');
    expect((await runScrape({ trigger: 'cron' })).warnings).toEqual([]);
  });

  it('warns and persists warnings when every page needed the meta fallback', async () => {
    discoverEntries.mockResolvedValue(found(6));
    serve('meta');
    const s = await runScrape({ trigger: 'cron' });
    expect(s.status).toBe('success'); // the run "works", which is exactly why this needs its own signal
    expect(s.warnings.join(' ')).toMatch(/__NEXT_DATA__/);
    expect((await ScrapeRun.findById(s.runId).lean())?.warnings).toEqual(s.warnings);
  });

  it('warns loudly when nothing can be parsed', async () => {
    discoverEntries.mockResolvedValue(found(3));
    fetchArticle.mockRejectedValue(new StageError('parse', 'no usable title/date in any layer'));
    const s = await runScrape({ trigger: 'cron' });
    expect(s.status).toBe('failed');
    expect(s.warnings[0]).toMatch(/None of 3 fetched pages could be parsed/);
  });
});
