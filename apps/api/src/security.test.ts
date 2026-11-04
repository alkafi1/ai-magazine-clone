import { scrapedArticleSchema } from '@aimag/shared';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDb, disconnectDb } from './db/connection.js';
import { Article, Category } from './models/index.js';
import { createApp } from './http/app.js';
import { DisallowedError, PoliteFetcher } from './scraper/fetcher.js';

const base = {
  title: 't',
  excerpt: 'e',
  imageUrl: 'https://assets.example.com/a.jpg',
  imageThumbUrl: null,
  imageAlt: null,
  category: { name: 'C', slug: 'c' },
  authorName: null,
  publishedAt: new Date(),
  sourceModifiedAt: null,
  sourceUrl: 'https://aimagazine.com/news/x',
  sourceSlug: 'x',
  slug: 'x',
  sourceHash: 'h',
};

describe('stored URLs', () => {
  it('accepts https and rejects javascript:, data:, and http: URLs', () => {
    expect(scrapedArticleSchema.safeParse(base).success).toBe(true);
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,<script>',
      'http://aimagazine.com/x',
      'ftp://x.com/a',
    ]) {
      expect(scrapedArticleSchema.safeParse({ ...base, sourceUrl: bad }).success).toBe(false);
      expect(scrapedArticleSchema.safeParse({ ...base, imageUrl: bad }).success).toBe(false);
    }
  });
});

describe('scraper only talks to the source host', () => {
  const f = new PoliteFetcher({
    baseUrl: 'https://aimagazine.com',
    userAgent: 't',
    delayMs: 0,
    maxRetries: 0,
    backoffBaseMs: 1,
  });
  it('refuses off-site URLs (sitemap-supplied links)', async () => {
    await expect(f.get('https://evil.example/news/a')).rejects.toBeInstanceOf(DisallowedError);
    await expect(f.get('http://169.254.169.254/latest/meta-data')).rejects.toBeInstanceOf(
      DisallowedError,
    );
    await expect(f.get('https://aimagazine.com.evil.example/news/a')).rejects.toBeInstanceOf(
      DisallowedError,
    );
  });
});

describe('API input hardening', () => {
  const app = createApp({ loginMax: 1000, newsletterMax: 1000, globalMax: 10000 });
  beforeAll(() => connectDb('mongodb://localhost:27017/aimag_test_security'));
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDb();
  });

  it('never turns query-string operators into Mongo operators', async () => {
    const cat = await Category.create({ name: 'Sec', slug: 'sec' });
    await Article.create({
      title: 'x',
      slug: 'sec-1',
      excerpt: 'e',
      category: cat._id,
      sourceUrl: 'https://aimagazine.com/news/sec-1',
      sourceHash: 'h',
      publishedAt: new Date(),
    });
    // If these were applied they would filter the single article out; they are ignored instead.
    for (const q of ['category[$eq]=zzz', 'author[$exists]=true', 'sort[$where]=1']) {
      const res = await request(app).get(`/api/articles?${q}`);
      if (res.status === 200) expect(res.body.total).toBe(1);
      else expect(res.status).toBe(400);
    }
    await request(app).get('/api/search?q[$regex]=.*').expect(400);
  });

  it('rejects NoSQL operator objects in JSON bodies', async () => {
    await request(app)
      .post('/api/admin/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } })
      .expect(400);
    await request(app)
      .post('/api/newsletter')
      .send({ email: { $ne: null } })
      .expect(400);
  });

  it('does not leak internals in errors or headers', async () => {
    const res = await request(app).get('/api/articles/..%2F..%2Fetc%2Fpasswd');
    expect([400, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules|mongo/i);
    expect((await request(app).get('/health')).headers['x-powered-by']).toBeUndefined();
  });

  it('rejects oversized bodies', async () => {
    await request(app)
      .post('/api/newsletter')
      .send({ email: 'a@b.co', pad: 'x'.repeat(60_000) })
      .expect(413);
  });

  it('admin endpoints reject missing, malformed and wrong-algorithm tokens', async () => {
    const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const body = Buffer.from('{"sub":"1","email":"a@b.co","role":"admin"}').toString('base64url');
    for (const auth of ['', 'Bearer', 'Bearer x.y.z', `Bearer ${none}.${body}.`]) {
      await request(app).get('/api/admin/stats').set('Authorization', auth).expect(401);
    }
  });
});
