import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const executeRun = vi.fn().mockResolvedValue({ started: true });
vi.mock('../scheduler/runner.js', () => ({ executeRun }));
const revalidateWeb = vi.fn().mockResolvedValue(true);
vi.mock('../scheduler/revalidate.js', () => ({ revalidateWeb }));

const { connectDb, disconnectDb } = await import('../db/connection.js');
const { createApp } = await import('./app.js');
const { clearCache } = await import('./middleware/cache.js');
const { config } = await import('../config/index.js');
const { Article, AdminUser, Author, Category, NewsletterSubscriber, ScrapeRun } =
  await import('../models/index.js');

const app = createApp({ loginMax: 100, newsletterMax: 100 });
let token = '';
const ids: Record<string, string> = {};

async function seed() {
  const [ai, robo] = await Category.create([
    { name: 'AI Strategy', slug: 'ai-strategy', order: 1 },
    { name: 'Robotics', slug: 'robotics', order: 2 },
  ]);
  const author = await Author.create({ name: 'Adam Pond', slug: 'adam-pond' });
  const mk = (n: number, over: Record<string, unknown> = {}) => ({
    title: `Article ${n} about robots`,
    slug: `article-${n}`,
    excerpt: `Excerpt ${n}`,
    category: n % 2 ? ai!._id : robo!._id,
    author: author._id,
    sourceUrl: `https://aimagazine.com/news/article-${n}`,
    sourceHash: `h${n}`,
    publishedAt: new Date(Date.now() - n * 3600_000),
    ...over,
  });
  const docs = await Article.create([
    mk(1, { isFeatured: true }),
    mk(2),
    mk(3, { viewCount: 50 }),
    mk(4),
    mk(5, { isHidden: true, status: 'hidden' }),
  ]);
  docs.forEach((d, i) => (ids[`a${i + 1}`] = String(d._id)));
  await AdminUser.create({
    email: 'admin@example.com',
    passwordHash: await bcrypt.hash('correct-horse-battery', 4),
  });
}

beforeAll(async () => {
  await connectDb('mongodb://localhost:27017/aimag_test_api');
});
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  clearCache();
  executeRun.mockClear();
  revalidateWeb.mockClear();
  await seed();
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

const login = async () => {
  const res = await request(app)
    .post('/api/admin/login')
    .send({ email: 'admin@example.com', password: 'correct-horse-battery' });
  token = res.body.token;
  return res;
};

describe('public API', () => {
  it('lists published articles only, newest first, with pagination', async () => {
    const res = await request(app).get('/api/articles?limit=2').expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.items.map((a: { slug: string }) => a.slug)).toEqual(['article-1', 'article-2']);
    expect(res.body.items[0].category).toEqual({ name: 'AI Strategy', slug: 'ai-strategy' });
    expect(res.body.items[0].author.slug).toBe('adam-pond');
    expect(Object.keys(res.body.items[0])).not.toContain('sourceHash');
  });

  it('filters by category and author, sorts by popularity, handles unknown slugs', async () => {
    const cat = await request(app).get('/api/articles?category=robotics').expect(200);
    expect(cat.body.items.map((a: { slug: string }) => a.slug)).toEqual(['article-2', 'article-4']);
    const pop = await request(app).get('/api/articles?sort=popular&limit=1').expect(200);
    expect(pop.body.items[0].slug).toBe('article-3');
    const none = await request(app).get('/api/articles?category=nope').expect(200);
    expect(none.body.items).toEqual([]);
    expect((await request(app).get('/api/articles?author=adam-pond')).body.total).toBe(4);
  });

  it('validates query input', async () => {
    await request(app).get('/api/articles?limit=1000').expect(400);
    await request(app).get('/api/articles?sort=evil').expect(400);
    await request(app).get('/api/articles?category=../etc').expect(400);
    await request(app).get('/api/search?q=a').expect(400);
  });

  it('returns one article, 404 for unknown and 410 for hidden', async () => {
    const ok = await request(app).get('/api/articles/article-1').expect(200);
    expect(ok.body.sourceUrl).toBe('https://aimagazine.com/news/article-1');
    await request(app).get('/api/articles/missing').expect(404);
    await request(app).get('/api/articles/article-5').expect(410);
  });

  it('returns related articles from the same category, excluding itself and hidden ones', async () => {
    const res = await request(app).get('/api/articles/article-1/related').expect(200);
    expect(res.body.items.map((a: { slug: string }) => a.slug)).toEqual(['article-3']);
  });

  it('builds the home payload without duplicates', async () => {
    const res = await request(app).get('/api/home').expect(200);
    expect(res.body.hero.slug).toBe('article-1');
    const slugs = [...res.body.featured, ...res.body.latest].map((a: { slug: string }) => a.slug);
    expect(slugs).not.toContain('article-1');
    expect(slugs).not.toContain('article-5');
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(res.body.sections.map((s: { category: { slug: string } }) => s.category.slug)).toEqual([
      'ai-strategy',
      'robotics',
    ]);
    expect(res.body.trending[0].slug).toBe('article-3');
  });

  it('lists categories with counts, trending, and authors', async () => {
    const cats = await request(app).get('/api/categories').expect(200);
    expect(
      cats.body.items.find((c: { slug: string }) => c.slug === 'ai-strategy').articleCount,
    ).toBe(2);
    expect((await request(app).get('/api/trending')).body.items.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/authors/adam-pond')).body.articleCount).toBe(4);
    await request(app).get('/api/authors/nobody').expect(404);
    await request(app).get('/api/tags').expect(200);
  });

  it('searches via the text index and excludes hidden articles', async () => {
    const res = await request(app).get('/api/search?q=robots').expect(200);
    expect(res.body.total).toBe(4);
  });

  it('serves sitemap feeds and tag lookups', async () => {
    const arts = await request(app).get('/api/sitemap/articles').expect(200);
    expect(arts.body.total).toBe(4);
    expect(arts.body.items.map((a: { slug: string }) => a.slug)).not.toContain('article-5');
    const news = await request(app).get('/api/sitemap/news').expect(200);
    expect(news.body.items.length).toBe(4);
    const pages = await request(app).get('/api/sitemap/pages').expect(200);
    expect(pages.body.categories).toEqual(expect.arrayContaining(['ai-strategy', 'robotics']));
    await request(app).get('/api/tags/missing').expect(404);
  });

  it('counts views', async () => {
    await request(app).post('/api/articles/article-2/view').expect(204);
    expect((await Article.findOne({ slug: 'article-2' }))?.viewCount).toBe(1);
  });

  it('caches GET responses and sets Cache-Control', async () => {
    const first = await request(app).get('/api/categories');
    const second = await request(app).get('/api/categories');
    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
    expect(first.headers['cache-control']).toMatch(/public, max-age=300/);
  });

  it('accepts newsletter signups idempotently and validates email', async () => {
    await request(app).post('/api/newsletter').send({ email: 'Reader@Example.com' }).expect(202);
    await request(app).post('/api/newsletter').send({ email: 'reader@example.com' }).expect(202);
    expect(await NewsletterSubscriber.countDocuments()).toBe(1);
    await request(app).post('/api/newsletter').send({ email: 'nope' }).expect(400);
  });

  it('rate-limits newsletter signups', async () => {
    const fresh = createApp({ newsletterMax: 2 });
    await request(fresh).post('/api/newsletter').send({ email: 'a@example.com' }).expect(202);
    await request(fresh).post('/api/newsletter').send({ email: 'b@example.com' }).expect(202);
    await request(fresh).post('/api/newsletter').send({ email: 'c@example.com' }).expect(429);
  });

  it('protects revalidate with the secret', async () => {
    await request(app).post('/api/revalidate').send({}).expect(401);
    await request(app)
      .post('/api/revalidate')
      .set('x-revalidate-secret', config.revalidateSecret)
      .send({ articleSlugs: ['article-1'] })
      .expect(200);
    expect(revalidateWeb).toHaveBeenCalledWith({ articleSlugs: ['article-1'], categorySlugs: [] });
  });

  it('sets security headers and honours the CORS allowlist', async () => {
    const res = await request(app).get('/health').set('Origin', config.corsOrigins[0]!);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).toBe(config.corsOrigins[0]);
    const bad = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns JSON 404 and 400 for bad JSON', async () => {
    await request(app).get('/api/nope').expect(404);
    await request(app)
      .post('/api/newsletter')
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400);
  });
});

describe('admin API', () => {
  it('rejects bad credentials and unauthenticated access', async () => {
    await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@example.com', password: 'wrong' })
      .expect(401);
    await request(app)
      .post('/api/admin/login')
      .send({ email: 'ghost@example.com', password: 'whatever' })
      .expect(401);
    await request(app).get('/api/admin/stats').expect(401);
    await request(app).get('/api/admin/stats').set('Authorization', 'Bearer garbage').expect(401);
  });

  it('rate-limits login attempts', async () => {
    const fresh = createApp({ loginMax: 3 });
    const attempt = () =>
      request(fresh).post('/api/admin/login').send({ email: 'admin@example.com', password: 'x' });
    await attempt();
    await attempt();
    await attempt();
    await attempt().expect(429);
  });

  it('logs in and reads stats', async () => {
    await login();
    expect(token).toBeTruthy();
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toMatchObject({ articles: 5, hidden: 1, featured: 1, categories: 2 });
    expect(res.body.topCategories.length).toBe(2);
  });

  it('hides and features articles, edits SEO, with audit log and revalidation', async () => {
    await login();
    const auth = { Authorization: `Bearer ${token}` };
    await request(app)
      .patch(`/api/admin/articles/${ids.a2}`)
      .set(auth)
      .send({ isHidden: true })
      .expect(200);
    await request(app).get('/api/articles/article-2').expect(410);
    await request(app)
      .patch(`/api/admin/articles/${ids.a2}`)
      .set(auth)
      .send({ isHidden: false, isFeatured: true, seo: { metaTitle: 'Custom', noindex: true } })
      .expect(200);
    const res = await request(app).get('/api/articles/article-2').expect(200);
    expect(res.body.seo).toMatchObject({ metaTitle: 'Custom', noindex: true });
    expect(revalidateWeb).toHaveBeenCalled();
    await request(app)
      .patch(`/api/admin/articles/${ids.a2}`)
      .set(auth)
      .send({ sourceUrl: 'x' })
      .expect(400);
    await request(app).patch(`/api/admin/articles/${ids.a2}`).set(auth).send({}).expect(400);
    await request(app)
      .patch('/api/admin/articles/not-an-id')
      .set(auth)
      .send({ isHidden: true })
      .expect(400);
  });

  it('takes an article down on DELETE but keeps the record', async () => {
    await login();
    await request(app)
      .delete(`/api/admin/articles/${ids.a4}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await request(app).get('/api/articles/article-4').expect(410);
    expect(await Article.countDocuments({ slug: 'article-4' })).toBe(1);
  });

  it('lists articles and scrape runs, and triggers a manual run', async () => {
    await login();
    const auth = { Authorization: `Bearer ${token}` };
    const list = await request(app).get('/api/admin/articles?hidden=true').set(auth).expect(200);
    expect(list.body.items).toHaveLength(1);
    await ScrapeRun.create({ trigger: 'cron', status: 'success', created: 3 });
    const runs = await request(app).get('/api/admin/scrape-runs').set(auth).expect(200);
    expect(runs.body.items[0]).toMatchObject({ trigger: 'cron', created: 3 });
    await request(app).post('/api/admin/scrape-runs').set(auth).expect(202);
    expect(executeRun).toHaveBeenCalledWith({ trigger: 'manual' });
  });
});
