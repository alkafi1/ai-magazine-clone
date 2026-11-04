import { ROLES, can, canManageRole, assignableRoles, type Role } from '@aimag/shared';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../scheduler/index.js', () => ({ startRun: vi.fn() }));
vi.mock('../scheduler/revalidate.js', () => ({ revalidateWeb: vi.fn().mockResolvedValue(true) }));

const { connectDb, disconnectDb } = await import('../db/connection.js');
const { createApp } = await import('./app.js');
const { clearCache } = await import('./middleware/cache.js');
const { AdminUser, Article, AuditLog, Category, NewsletterSubscriber } =
  await import('../models/index.js');

const app = createApp({ loginMax: 1000, newsletterMax: 1000, globalMax: 100000 });
const PW = 'correct-horse-battery';
const hash = bcrypt.hashSync(PW, 4);
let articleId = '';

const addUser = (email: string, role: Role, extra: Record<string, unknown> = {}) =>
  AdminUser.create({ email, role, passwordHash: hash, name: email.split('@')[0], ...extra });

async function tokenFor(email: string, password = PW) {
  const res = await request(app).post('/api/admin/login').send({ email, password });
  return res.body.token as string;
}
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(() => connectDb('mongodb://localhost:27017/aimag_test_rbac'));
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  clearCache();
  const cat = await Category.create({ name: 'C', slug: 'c' });
  const a = await Article.create({
    title: 'T',
    slug: 't',
    excerpt: 'e',
    category: cat._id,
    sourceUrl: 'https://aimagazine.com/news/t',
    sourceHash: 'h',
    publishedAt: new Date(),
  });
  articleId = String(a._id);
  for (const role of ROLES) await addUser(`${role}@t.test`, role);
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

describe('role matrix (shared definitions)', () => {
  it('only super admins and admins hold every permission', () => {
    expect(can('super_admin', 'users.manage')).toBe(true);
    expect(can('editor', 'users.manage')).toBe(false);
    expect(can('viewer', 'articles.moderate')).toBe(false);
    expect(can('ad_manager', 'articles.view')).toBe(false);
  });
  it('hierarchy: nobody manages their peers or betters, except super admins', () => {
    expect(canManageRole('admin', 'editor')).toBe(true);
    expect(canManageRole('admin', 'admin')).toBe(false);
    expect(canManageRole('admin', 'super_admin')).toBe(false);
    expect(canManageRole('editor', 'moderator')).toBe(false); // equal rank
    expect(canManageRole('super_admin', 'super_admin')).toBe(true);
    expect(assignableRoles('admin')).not.toContain('admin');
    expect(assignableRoles('editor')).toEqual(['viewer']);
  });
});

describe('endpoint permissions', () => {
  // [method, path, body, allowed roles]
  const cases: [string, string, (() => unknown) | undefined, Role[]][] = [
    [
      'get',
      '/api/admin/stats',
      undefined,
      ['super_admin', 'admin', 'editor', 'moderator', 'ad_manager', 'viewer'],
    ],
    [
      'get',
      '/api/admin/articles',
      undefined,
      ['super_admin', 'admin', 'editor', 'moderator', 'viewer'],
    ],
    [
      'get',
      '/api/admin/scrape-runs',
      undefined,
      ['super_admin', 'admin', 'editor', 'moderator', 'viewer'],
    ],
    ['post', '/api/admin/scrape-runs', undefined, ['super_admin', 'admin']],
    ['get', '/api/admin/users', undefined, ['super_admin', 'admin']],
    ['get', '/api/admin/audit', undefined, ['super_admin', 'admin']],
    ['get', '/api/admin/subscribers', undefined, ['super_admin', 'admin']],
    ['get', '/api/admin/subscribers/export.csv', undefined, ['super_admin', 'admin']],
    ['get', '/api/admin/settings/site', undefined, ['super_admin', 'admin']],
    ['get', '/api/admin/settings/ads', undefined, ['super_admin', 'admin', 'ad_manager']],
  ];
  it.each(cases)('%s %s', async (method, path, _body, allowed) => {
    for (const role of ROLES) {
      const token = await tokenFor(`${role}@t.test`);
      const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
        method
      ]!(path).set(as(token));
      expect(res.status, `${role} on ${method} ${path}`).toBe(
        allowed.includes(role) ? 200 + (res.status === 202 ? 2 : 0) : 403,
      );
    }
  });

  it('article changes need the matching permission', async () => {
    const [editor, moderator, viewer] = await Promise.all(
      ['editor', 'moderator', 'viewer'].map((r) => tokenFor(`${r}@t.test`)),
    );
    const patch = (t: string, body: object) =>
      request(app).patch(`/api/admin/articles/${articleId}`).set(as(t)).send(body);
    expect((await patch(editor!, { isFeatured: true })).status).toBe(200);
    expect((await patch(editor!, { seo: { metaTitle: 'x' } })).status).toBe(200);
    expect((await patch(editor!, { isHidden: true })).status).toBe(403); // editors cannot hide
    expect((await patch(moderator!, { isHidden: true })).status).toBe(200);
    expect((await patch(moderator!, { isFeatured: true })).status).toBe(403); // moderators cannot feature
    expect((await patch(viewer!, { isHidden: false })).status).toBe(403);
    expect(
      (await request(app).delete(`/api/admin/articles/${articleId}`).set(as(editor!))).status,
    ).toBe(403);
    expect(
      (await request(app).delete(`/api/admin/articles/${articleId}`).set(as(moderator!))).status,
    ).toBe(204);
  });

  it('bulk actions follow the same rules and cap the batch', async () => {
    const editor = await tokenFor('editor@t.test');
    const moderator = await tokenFor('moderator@t.test');
    const bulk = (t: string, body: object) =>
      request(app).post('/api/admin/articles/bulk').set(as(t)).send(body);
    expect((await bulk(editor, { ids: [articleId], action: 'hide' })).status).toBe(403);
    expect((await bulk(moderator, { ids: [articleId], action: 'feature' })).status).toBe(403);
    expect((await bulk(editor, { ids: [articleId], action: 'feature' })).body).toMatchObject({
      modified: 1,
    });
    expect((await bulk(moderator, { ids: [articleId], action: 'hide' })).body).toMatchObject({
      modified: 1,
    });
    const hidden = await Article.findById(articleId).lean();
    expect(hidden).toMatchObject({ isHidden: true, isFeatured: false, status: 'hidden' }); // hiding un-features
    expect((await bulk(moderator, { ids: [], action: 'hide' })).status).toBe(400);
    expect(
      (await bulk(moderator, { ids: Array(101).fill(articleId), action: 'hide' })).status,
    ).toBe(400);
  });
});

describe('sessions', () => {
  it('disabling a user or changing their role takes effect on their next request', async () => {
    const admin = await tokenFor('super_admin@t.test');
    const editor = await tokenFor('editor@t.test');
    const id = String((await AdminUser.findOne({ email: 'editor@t.test' }))!._id);
    expect((await request(app).get('/api/admin/articles').set(as(editor))).status).toBe(200);

    await request(app)
      .patch(`/api/admin/users/${id}`)
      .set(as(admin))
      .send({ role: 'ad_manager' })
      .expect(200);
    expect((await request(app).get('/api/admin/articles').set(as(editor))).status).toBe(401); // old token dead

    const fresh = await tokenFor('editor@t.test');
    expect((await request(app).get('/api/admin/articles').set(as(fresh))).status).toBe(403); // new role applies

    await request(app)
      .patch(`/api/admin/users/${id}`)
      .set(as(admin))
      .send({ active: false })
      .expect(200);
    expect((await request(app).get('/api/admin/stats').set(as(fresh))).status).toBe(401);
    expect(await tokenFor('editor@t.test')).toBeUndefined(); // cannot sign in while disabled
  });

  it('changing your own password signs out other sessions but keeps this one', async () => {
    const a = await tokenFor('viewer@t.test');
    const b = await tokenFor('viewer@t.test');
    await request(app)
      .post('/api/admin/me/password')
      .set(as(a))
      .send({ current: 'wrong-password-123', password: 'a-brand-new-password' })
      .expect(400);
    const res = await request(app)
      .post('/api/admin/me/password')
      .set(as(a))
      .send({ current: PW, password: 'a-brand-new-password' })
      .expect(200);
    expect((await request(app).get('/api/admin/me').set(as(res.body.token))).status).toBe(200);
    expect((await request(app).get('/api/admin/me').set(as(a))).status).toBe(401);
    expect((await request(app).get('/api/admin/me').set(as(b))).status).toBe(401);
    expect(await tokenFor('viewer@t.test', 'a-brand-new-password')).toBeTruthy();
  });

  it('locks an account after 5 bad passwords, silently, and an admin can unlock it', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/admin/login')
        .send({ email: 'editor@t.test', password: 'nope-nope-nope' })
        .expect(401);
    }
    // even the right password is refused while locked, with the same generic answer
    const locked = await request(app)
      .post('/api/admin/login')
      .send({ email: 'editor@t.test', password: PW });
    expect(locked.status).toBe(401);
    expect(locked.body.error).toBe('invalid credentials');
    const list = await request(app)
      .get('/api/admin/users')
      .set(as(await tokenFor('super_admin@t.test')));
    expect(list.body.items.find((u: { email: string }) => u.email === 'editor@t.test').locked).toBe(
      true,
    );

    const id = String((await AdminUser.findOne({ email: 'editor@t.test' }))!._id);
    await request(app)
      .patch(`/api/admin/users/${id}`)
      .set(as(await tokenFor('super_admin@t.test')))
      .send({ unlock: true })
      .expect(200);
    expect(await tokenFor('editor@t.test')).toBeTruthy();
    expect(await AuditLog.countDocuments({ action: 'auth.locked' })).toBe(1);
  });
});

describe('user management rules', () => {
  const create = (t: string, body: object) =>
    request(app).post('/api/admin/users').set(as(t)).send(body);
  const newUser = (role: Role) => ({
    email: `new-${role}@t.test`,
    name: 'N',
    role,
    password: 'a-long-enough-password',
  });

  it('admins can create lower roles only; super admins can create anyone', async () => {
    const admin = await tokenFor('admin@t.test');
    const superAdmin = await tokenFor('super_admin@t.test');
    expect((await create(admin, newUser('editor'))).status).toBe(201);
    expect((await create(admin, { ...newUser('admin'), email: 'x1@t.test' })).status).toBe(403);
    expect((await create(admin, { ...newUser('super_admin'), email: 'x2@t.test' })).status).toBe(
      403,
    );
    expect(
      (await create(superAdmin, { ...newUser('super_admin'), email: 'x3@t.test' })).status,
    ).toBe(201);
    expect((await create(admin, { ...newUser('viewer'), password: 'short' })).status).toBe(400);
    expect((await create(admin, newUser('editor'))).status).toBe(409); // duplicate email
    expect((await create(await tokenFor('editor@t.test'), newUser('viewer'))).status).toBe(403);
  });

  it('nobody edits, resets or deletes accounts of equal or higher rank', async () => {
    const admin = await tokenFor('admin@t.test');
    const superId = String((await AdminUser.findOne({ email: 'super_admin@t.test' }))!._id);
    const editorId = String((await AdminUser.findOne({ email: 'editor@t.test' }))!._id);
    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${superId}`)
          .set(as(admin))
          .send({ active: false })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/admin/users/${superId}/reset-password`)
          .set(as(admin))
          .send({ password: 'another-long-password' })
      ).status,
    ).toBe(403);
    expect((await request(app).delete(`/api/admin/users/${superId}`).set(as(admin))).status).toBe(
      403,
    );
    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${editorId}`)
          .set(as(admin))
          .send({ role: 'admin' })
      ).status,
    ).toBe(403); // no promotion to own level
    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${editorId}`)
          .set(as(admin))
          .send({ role: 'moderator' })
      ).status,
    ).toBe(200);
  });

  it('you cannot change your own role, disable or delete yourself', async () => {
    const t = await tokenFor('admin@t.test');
    const id = String((await AdminUser.findOne({ email: 'admin@t.test' }))!._id);
    expect(
      (await request(app).patch(`/api/admin/users/${id}`).set(as(t)).send({ role: 'viewer' }))
        .status,
    ).toBe(400);
    expect(
      (await request(app).patch(`/api/admin/users/${id}`).set(as(t)).send({ active: false }))
        .status,
    ).toBe(400);
    expect((await request(app).delete(`/api/admin/users/${id}`).set(as(t))).status).toBe(400);
  });

  it('super admins are only manageable by super admins, and one always remains active', async () => {
    const sa = await addUser('second-super@t.test', 'super_admin');
    const a = await tokenFor('super_admin@t.test');
    // two super admins: one may be demoted
    await request(app)
      .patch(`/api/admin/users/${sa._id}`)
      .set(as(a))
      .send({ role: 'admin' })
      .expect(200);
    // now only one remains: the other super admin account is the caller, so use a third to test the guard
    const b = await addUser('third-super@t.test', 'super_admin');
    const tokenB = await tokenFor('third-super@t.test');
    await request(app)
      .patch(
        `/api/admin/users/${String((await AdminUser.findOne({ email: 'super_admin@t.test' }))!._id)}`,
      )
      .set(as(tokenB))
      .send({ active: false })
      .expect(200);
    // third-super is now the only active super admin; nobody (but themselves, who is blocked) can remove them
    const other = await addUser('admin2@t.test', 'admin');
    expect(
      (
        await request(app)
          .delete(`/api/admin/users/${b._id}`)
          .set(as(await tokenFor('admin2@t.test')))
      ).status,
    ).toBe(403);
    void other;
    expect(await AdminUser.countDocuments({ role: 'super_admin', active: true })).toBe(1);
  });

  it('records user changes in the audit log', async () => {
    const t = await tokenFor('super_admin@t.test');
    await create(t, newUser('viewer'));
    const log = await request(app).get('/api/admin/audit?action=user.').set(as(t)).expect(200);
    expect(log.body.items[0]).toMatchObject({
      action: 'user.create',
      target: 'new-viewer@t.test',
      actor: 'super_admin@t.test',
    });
    expect(JSON.stringify(log.body)).not.toMatch(/passwordHash|a-long-enough-password/);
  });
});

describe('subscribers, settings and public config', () => {
  it('exports subscribers as CSV with formula-injection protection and audits it', async () => {
    await NewsletterSubscriber.create([{ email: 'a@b.co' }, { email: '=cmd@evil.co' }]);
    const t = await tokenFor('admin@t.test');
    const res = await request(app).get('/api/admin/subscribers/export.csv').set(as(t)).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('"a@b.co"');
    expect(res.text).toContain(`"'=cmd@evil.co"`);
    expect(await AuditLog.countDocuments({ action: 'subscribers.export' })).toBe(1);
  });

  it('validates and saves settings, and exposes only the public subset', async () => {
    const t = await tokenFor('super_admin@t.test');
    const ads = (await request(app).get('/api/admin/settings/ads').set(as(t))).body;
    const bad = { ...ads, adsenseClientId: 'not-an-id' };
    expect((await request(app).put('/api/admin/settings/ads').set(as(t)).send(bad)).status).toBe(
      400,
    );
    expect(
      (
        await request(app)
          .put('/api/admin/settings/ads')
          .set(as(t))
          .send({ ...ads, scriptHosts: ['http://insecure.example'] })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .put('/api/admin/settings/ads')
          .set(as(t))
          .send({ ...ads, scriptHosts: ['https://x.example/path'] })
      ).status,
    ).toBe(400);

    const good = {
      ...ads,
      enabled: true,
      adsenseClientId: 'ca-pub-1234567890123456',
      placements: {
        ...ads.placements,
        headerBanner: { enabled: true, slotId: '1234567890', html: '' },
        sidebar: { enabled: true, slotId: '', html: '' },
      },
    };
    await request(app).put('/api/admin/settings/ads').set(as(t)).send(good).expect(200);
    const site = (await request(app).get('/api/admin/settings/site').set(as(t))).body;
    await request(app)
      .put('/api/admin/settings/site')
      .set(as(t))
      .send({
        ...site,
        announcement: {
          enabled: true,
          text: 'Hello',
          href: '/latest',
          tone: 'info',
          expiresAt: '',
        },
        analytics: { ga4Id: 'G-ABCDEF1234' },
      })
      .expect(200);

    clearCache();
    const pub = (await request(app).get('/api/site-config')).body;
    expect(pub.ads.enabled).toBe(true);
    expect(pub.ads.clientId).toBe('ca-pub-1234567890123456');
    expect(Object.keys(pub.ads.placements)).toEqual(['headerBanner']); // sidebar has no slot id, so it is dropped
    expect(pub.announcement).toMatchObject({ text: 'Hello', href: '/latest' });
    expect(pub.ga4Id).toBe('G-ABCDEF1234');
    expect(JSON.stringify(pub)).not.toMatch(/passwordHash|jwt/i);
  });

  it('expired announcements and disabled ads disappear from the public config', async () => {
    const t = await tokenFor('super_admin@t.test');
    const site = (await request(app).get('/api/admin/settings/site').set(as(t))).body;
    await request(app)
      .put('/api/admin/settings/site')
      .set(as(t))
      .send({
        ...site,
        announcement: {
          enabled: true,
          text: 'Old news',
          href: '',
          tone: 'info',
          expiresAt: '2020-01-01T00:00:00.000Z',
        },
      })
      .expect(200);
    clearCache();
    const pub = (await request(app).get('/api/site-config')).body;
    expect(pub.announcement).toBeNull();
    expect(pub.ads.enabled).toBe(false);
  });

  it('an ad manager can save ads but not site settings', async () => {
    const t = await tokenFor('ad_manager@t.test');
    const ads = (await request(app).get('/api/admin/settings/ads').set(as(t)).expect(200)).body;
    await request(app).put('/api/admin/settings/ads').set(as(t)).send(ads).expect(200);
    await request(app).get('/api/admin/settings/site').set(as(t)).expect(403);
  });
});
