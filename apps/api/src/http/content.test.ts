import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../scheduler/index.js', () => ({ startRun: vi.fn() }));
const revalidateWeb = vi.fn().mockResolvedValue(true);
vi.mock('../scheduler/revalidate.js', () => ({ revalidateWeb }));

const { connectDb, disconnectDb } = await import('../db/connection.js');
const { createApp } = await import('./app.js');
const { clearCache } = await import('./middleware/cache.js');
const { publishDue } = await import('../scheduler/publisher.js');
const { AdminUser, Article, Category, Media, Role } = await import('../models/index.js');
const { config } = await import('../config/index.js');

const app = createApp({ loginMax: 1000, newsletterMax: 1000, globalMax: 100000 });
const PW = 'correct-horse-battery';
const hash = bcrypt.hashSync(PW, 4);
const as = (t: string) => ({ Authorization: `Bearer ${t}` });
const tokenFor = async (email: string) =>
  (await request(app).post('/api/admin/login').send({ email, password: PW })).body.token as string;

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
let sup = '';
let catId = '';

const article = (over: object = {}) => ({
  title: 'Our own story about robots',
  excerpt: 'A short summary we wrote.',
  body: '# Heading\n\nSome **original** body text with the word zeppelin.',
  category: catId,
  tags: ['Robots', 'Opinion'],
  status: 'published',
  ...over,
});
const create = (t: string, body: object) =>
  request(app).post('/api/admin/articles').set(as(t)).send(body);

beforeAll(() => connectDb('mongodb://localhost:27017/aimag_test_content'));
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  clearCache();
  revalidateWeb.mockClear();
  for (const [email, role] of [
    ['super@t.test', 'super_admin'],
    ['editor@t.test', 'editor'],
    ['viewer@t.test', 'viewer'],
    ['mod@t.test', 'moderator'],
  ] as const) {
    await AdminUser.create({ email, role, passwordHash: hash, name: email.split('@')[0] });
  }
  catId = String((await Category.create({ name: 'Robotics', slug: 'robotics' }))._id);
  sup = await tokenFor('super@t.test');
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

describe('original articles', () => {
  it('drafts are invisible; publishing exposes the body (single article only), with no source', async () => {
    const draft = await create(sup, article({ status: 'draft' })).expect(201);
    expect(draft.body).toMatchObject({ slug: 'our-own-story-about-robots', status: 'draft' });
    await request(app).get('/api/articles/our-own-story-about-robots').expect(404);
    expect((await request(app).get('/api/articles')).body.total).toBe(0);
    expect((await request(app).get('/api/sitemap/articles')).body.items).toEqual([]);

    await request(app)
      .put(`/api/admin/articles/${draft.body.id}`)
      .set(as(sup))
      .send(article({ status: 'published' }))
      .expect(200);
    clearCache();
    const one = (await request(app).get('/api/articles/our-own-story-about-robots').expect(200))
      .body;
    expect(one).toMatchObject({
      kind: 'original',
      sourceUrl: null,
      author: { name: 'super' },
      category: { slug: 'robotics' },
    });
    expect(one.body).toContain('**original**');
    expect(one.tags.map((t: { name: string }) => t.name).sort()).toEqual(['Opinion', 'Robots']);
    expect(one.readingTimeMin).toBe(1);

    const list = (await request(app).get('/api/articles').expect(200)).body.items[0];
    expect(list.kind).toBe('original');
    expect(list).not.toHaveProperty('body'); // bodies are never in lists
    expect((await request(app).get('/api/search?q=zeppelin')).body.total).toBe(1); // body text is searchable
  });

  it('scheduled articles go live only when their time comes', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const res = await create(sup, article({ status: 'scheduled', publishedAt: future })).expect(
      201,
    );
    expect(res.body.status).toBe('scheduled');
    await request(app).get('/api/articles/our-own-story-about-robots').expect(404);
    expect(await publishDue(new Date())).toBe(0);
    expect(await publishDue(new Date(Date.now() + 2 * 3600_000))).toBe(1);
    clearCache();
    await request(app).get('/api/articles/our-own-story-about-robots').expect(200);
    expect(revalidateWeb).toHaveBeenCalled();
    // publishing with a future date also schedules; scheduling without a future date is refused
    expect(
      (
        await create(
          sup,
          article({ title: 'Another one', status: 'published', publishedAt: future }),
        )
      ).body.status,
    ).toBe('scheduled');
    await create(sup, article({ title: 'Third one', status: 'scheduled' })).expect(400);
    await create(
      sup,
      article({
        title: 'Fourth one',
        status: 'scheduled',
        publishedAt: '2020-01-01T00:00:00.000Z',
      }),
    ).expect(400);
  });

  it('keeps slugs unique: auto-suffix for titles, 409 for an explicit clash', async () => {
    await create(sup, article()).expect(201);
    expect((await create(sup, article())).body.slug).toBe('our-own-story-about-robots-2');
    await create(sup, article({ slug: 'our-own-story-about-robots' })).expect(409);
    expect((await create(sup, article({ slug: 'custom-slug' }))).body.slug).toBe('custom-slug');
  });

  it('validates input', async () => {
    for (const bad of [
      { title: 'ab' },
      { excerpt: '' },
      { body: '' },
      { category: 'nope' },
      { slug: 'Bad Slug!' },
      { coverUrl: 'http://insecure.example/x.png' },
      { tags: Array(11).fill('t') },
      { status: 'weird' },
    ]) {
      expect((await create(sup, article(bad))).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await create(sup, article({ category: '000000000000000000000000' }))).status).toBe(400); // unknown category
  });

  it('needs articles.write; featuring needs articles.feature; viewers and moderators cannot create', async () => {
    expect((await create(await tokenFor('viewer@t.test'), article())).status).toBe(403);
    expect((await create(await tokenFor('mod@t.test'), article())).status).toBe(403);
    const ed = await tokenFor('editor@t.test');
    expect((await create(ed, article({ isFeatured: true }))).status).toBe(201); // editor has articles.feature

    await Role.create({
      key: 'writer',
      name: 'Writer',
      permissions: ['dashboard.view', 'articles.view', 'articles.write'],
      rank: 30,
    });
    await AdminUser.create({ email: 'w@t.test', role: 'writer', passwordHash: hash });
    const w = await tokenFor('w@t.test');
    expect((await create(w, article({ title: 'Writer story' }))).status).toBe(201);
    expect(
      (await create(w, article({ title: 'Featured by writer', isFeatured: true }))).status,
    ).toBe(403);
  });

  it('aggregated stories can not be edited as originals, and never expose a body', async () => {
    const scraped = await Article.create({
      title: 'Scraped headline',
      slug: 'scraped-headline',
      excerpt: 'Short.',
      category: catId,
      sourceUrl: 'https://aimagazine.com/news/scraped-headline',
      sourceHash: 'h',
      publishedAt: new Date(),
      body: 'THIS FULL TEXT MUST NEVER BE SERVED', // even if something wrote a body by mistake
    });
    await request(app)
      .put(`/api/admin/articles/${scraped._id}`)
      .set(as(sup))
      .send(article())
      .expect(400);
    const one = (await request(app).get('/api/articles/scraped-headline').expect(200)).body;
    expect(one.kind).toBe('scraped');
    expect(one.sourceUrl).toBe('https://aimagazine.com/news/scraped-headline');
    expect(JSON.stringify(one)).not.toContain('MUST NEVER');
    expect(one).not.toHaveProperty('body');
    expect(JSON.stringify((await request(app).get('/api/articles')).body)).not.toContain(
      'MUST NEVER',
    );
  });

  it('original articles are deleted for real; aggregated ones are taken down', async () => {
    const own = await create(sup, article()).expect(201);
    await request(app)
      .delete(`/api/admin/articles/${own.body.id}`)
      .set(as(await tokenFor('mod@t.test')))
      .expect(403); // moderators cannot delete originals
    await request(app).delete(`/api/admin/articles/${own.body.id}`).set(as(sup)).expect(204);
    expect(await Article.countDocuments({ kind: 'original' })).toBe(0);

    const scraped = await Article.create({
      title: 'S',
      slug: 's',
      excerpt: 'e',
      category: catId,
      sourceUrl: 'https://aimagazine.com/news/s',
      sourceHash: 'h',
      publishedAt: new Date(),
    });
    await request(app)
      .delete(`/api/admin/articles/${scraped._id}`)
      .set(as(await tokenFor('editor@t.test')))
      .expect(403); // editors cannot take down
    await request(app).delete(`/api/admin/articles/${scraped._id}`).set(as(sup)).expect(204);
    expect((await Article.findById(scraped._id))?.status).toBe('hidden'); // still there, hidden
  });

  it('allows several originals (no sourceUrl) alongside scraped stories (unique sourceUrl)', async () => {
    await create(sup, article({ title: 'First original' })).expect(201);
    await create(sup, article({ title: 'Second original' })).expect(201);
    await Article.create({
      title: 'S',
      slug: 's',
      excerpt: 'e',
      category: catId,
      sourceUrl: 'https://aimagazine.com/news/dup',
      sourceHash: 'h',
      publishedAt: new Date(),
    });
    await expect(
      Article.create({
        title: 'S2',
        slug: 's2',
        excerpt: 'e',
        category: catId,
        sourceUrl: 'https://aimagazine.com/news/dup',
        sourceHash: 'h',
        publishedAt: new Date(),
      }),
    ).rejects.toThrow(/duplicate key/);
  });

  it('admin list filters by kind and status', async () => {
    await create(sup, article({ title: 'Draft one', status: 'draft' }));
    await create(sup, article({ title: 'Live one' }));
    await Article.create({
      title: 'S',
      slug: 's',
      excerpt: 'e',
      category: catId,
      sourceUrl: 'https://aimagazine.com/news/s',
      sourceHash: 'h',
      publishedAt: new Date(),
    });
    const get = (q: string) =>
      request(app)
        .get(`/api/admin/articles?${q}`)
        .set(as(sup))
        .then((r) => r.body);
    expect((await get('kind=original')).total).toBe(2);
    expect((await get('kind=scraped')).total).toBe(1);
    expect((await get('status=draft')).items[0]).toMatchObject({
      title: 'Draft one',
      kind: 'original',
    });
    const one = (
      await request(app)
        .get(`/api/admin/articles/${(await get('status=draft')).items[0].id}`)
        .set(as(sup))
    ).body;
    expect(one).toMatchObject({ kind: 'original', categoryId: catId });
    expect(one.body).toContain('zeppelin');
  });
});

describe('categories', () => {
  const cat = (t: string, body: object) =>
    request(app).post('/api/admin/categories').set(as(t)).send(body);

  it('create, update, list with counts, and delete only when empty', async () => {
    const created = await cat(sup, {
      name: 'Quantum Computing',
      description: 'Qubits.',
      order: 5,
    }).expect(201);
    expect(created.body.slug).toBe('quantum-computing');
    await cat(sup, { name: 'Other', slug: 'quantum-computing' }).expect(409);
    await request(app)
      .patch(`/api/admin/categories/${created.body.id}`)
      .set(as(sup))
      .send({ name: 'Quantum', slug: 'quantum', description: 'x', order: 1, showInMenu: false })
      .expect(200);

    await create(sup, article({ category: created.body.id })).expect(201);
    const list = (await request(app).get('/api/admin/categories').set(as(sup))).body.items;
    expect(list.find((c: { slug: string }) => c.slug === 'quantum')).toMatchObject({
      articleCount: 1,
      showInMenu: false,
    });
    await request(app).delete(`/api/admin/categories/${created.body.id}`).set(as(sup)).expect(409);
    const empty = await cat(sup, { name: 'Empty' }).expect(201);
    await request(app).delete(`/api/admin/categories/${empty.body.id}`).set(as(sup)).expect(204);
  });

  it('needs categories.manage', async () => {
    await cat(await tokenFor('editor@t.test'), { name: 'Nope' }).expect(403);
    await AdminUser.create({ email: 'ads@t.test', role: 'ad_manager', passwordHash: hash });
    await request(app)
      .get('/api/admin/categories')
      .set(as(await tokenFor('ads@t.test')))
      .expect(403); // no articles.view
    await request(app)
      .get('/api/admin/categories')
      .set(as(await tokenFor('editor@t.test')))
      .expect(200); // editors can read the list
  });
});

describe('custom pages', () => {
  it('drafts are hidden, published pages are public, noindex pages leave the sitemap', async () => {
    const p = await request(app)
      .post('/api/admin/pages')
      .set(as(sup))
      .send({ title: 'Our Team', body: '# Team\n\nHi', status: 'draft' })
      .expect(201);
    expect(p.body.slug).toBe('our-team');
    await request(app).get('/api/pages/our-team').expect(404);
    await request(app)
      .put(`/api/admin/pages/${p.body.id}`)
      .set(as(sup))
      .send({ title: 'Our Team', body: '# Team\n\nHi', status: 'published' })
      .expect(200);
    clearCache();
    expect((await request(app).get('/api/pages/our-team').expect(200)).body).toMatchObject({
      title: 'Our Team',
    });
    expect((await request(app).get('/api/sitemap/pages')).body.pages).toContain('our-team');
    await request(app)
      .post('/api/admin/pages')
      .set(as(sup))
      .send({ title: 'Dup', slug: 'our-team', body: 'x', status: 'draft' })
      .expect(409);
    await request(app).delete(`/api/admin/pages/${p.body.id}`).set(as(sup)).expect(204);
    await request(app)
      .post('/api/admin/pages')
      .set(as(await tokenFor('editor@t.test')))
      .send({ title: 'Nope', body: 'x', status: 'draft' })
      .expect(403);
  });
});

describe('media', () => {
  const upload = (t: string, data: Buffer, type = 'image/png', name = 'logo.png') =>
    request(app)
      .post('/api/admin/media')
      .set(as(t))
      .set('Content-Type', type)
      .set('x-filename', name)
      .send(data);

  it('accepts real images, serves them immutably, and links them to articles', async () => {
    const up = await upload(sup, PNG).expect(201);
    const img = await request(app).get(`/api/media/${up.body.id}`).expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.headers['cache-control']).toContain('immutable');
    expect(img.headers['x-content-type-options']).toBe('nosniff');
    expect(img.headers['content-security-policy']).toContain('sandbox');
    expect(Buffer.compare(img.body, PNG)).toBe(0);

    await create(sup, article({ coverMediaId: up.body.id })).expect(201);
    clearCache();
    const pub = (await request(app).get('/api/articles/our-own-story-about-robots')).body;
    expect(pub.imageUrl).toBe(`${config.publicApiUrl}/api/media/${up.body.id}`);
    await request(app).delete(`/api/admin/media/${up.body.id}`).set(as(sup)).expect(409); // used as a cover
  });

  it('rejects fakes, scripts, wrong types, oversize files and non-admins', async () => {
    await upload(sup, Buffer.from('not an image at all')).expect(415);
    await upload(sup, PNG, 'image/jpeg').expect(415); // declared type does not match contents
    await upload(sup, PNG, 'text/html').expect(415);
    const evil = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await upload(sup, evil, 'image/svg+xml').expect(415);
    await upload(
      sup,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>'),
      'image/svg+xml',
    ).expect(415);
    await upload(
      sup,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'),
      'image/svg+xml',
      'a.svg',
    ).expect(201);
    await upload(sup, Buffer.concat([PNG, Buffer.alloc(2.5 * 1024 * 1024)])).expect(413);
    await upload(await tokenFor('viewer@t.test'), PNG).expect(403);
    expect(await Media.countDocuments()).toBe(1);
  });
});
