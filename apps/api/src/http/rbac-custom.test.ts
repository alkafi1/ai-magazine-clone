import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../scheduler/index.js', () => ({ startRun: vi.fn() }));
vi.mock('../scheduler/revalidate.js', () => ({ revalidateWeb: vi.fn().mockResolvedValue(true) }));

const { connectDb, disconnectDb } = await import('../db/connection.js');
const { createApp } = await import('./app.js');
const { clearCache } = await import('./middleware/cache.js');
const { AdminUser, Role } = await import('../models/index.js');

const app = createApp({ loginMax: 1000, newsletterMax: 1000, globalMax: 100000 });
const PW = 'correct-horse-battery';
const hash = bcrypt.hashSync(PW, 4);
const as = (t: string) => ({ Authorization: `Bearer ${t}` });
const tokenFor = async (email: string) =>
  (await request(app).post('/api/admin/login').send({ email, password: PW })).body.token as string;
const mkUser = (email: string, role: string) =>
  AdminUser.create({ email, role, passwordHash: hash });
const newRole = (t: string, body: object) =>
  request(app).post('/api/admin/roles').set(as(t)).send(body);

beforeAll(() => connectDb('mongodb://localhost:27017/aimag_test_rbac_custom'));
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  clearCache();
  await mkUser('super@t.test', 'super_admin');
  await mkUser('admin@t.test', 'admin');
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
});

describe('custom roles', () => {
  it('creates a role; its holder gets exactly those permissions, and edits apply immediately', async () => {
    const sup = await tokenFor('super@t.test');
    await newRole(sup, {
      name: 'Content Reviewer',
      description: 'Reads articles',
      permissions: ['dashboard.view', 'articles.view'],
      rank: 40,
    }).expect(201);
    await mkUser('rev@t.test', 'content-reviewer');
    const rev = await tokenFor('rev@t.test');

    await request(app).get('/api/admin/articles').set(as(rev)).expect(200);
    await request(app).get('/api/admin/users').set(as(rev)).expect(403);
    await request(app).get('/api/admin/settings/ads').set(as(rev)).expect(403);
    const me = (await request(app).get('/api/admin/me').set(as(rev))).body;
    expect(me).toMatchObject({ role: 'content-reviewer', roleName: 'Content Reviewer', rank: 40 });
    expect(me.permissions).toEqual(['dashboard.view', 'articles.view']);

    // grant one more permission: the SAME token works with it on the next request
    await request(app)
      .patch('/api/admin/roles/content-reviewer')
      .set(as(sup))
      .send({
        name: 'Content Reviewer',
        description: '',
        permissions: ['dashboard.view', 'articles.view', 'ads.manage'],
        rank: 40,
      })
      .expect(200);
    await request(app).get('/api/admin/settings/ads').set(as(rev)).expect(200);
    // and take it away again
    await request(app)
      .patch('/api/admin/roles/content-reviewer')
      .set(as(sup))
      .send({
        name: 'Content Reviewer',
        description: '',
        permissions: ['dashboard.view'],
        rank: 40,
      })
      .expect(200);
    await request(app).get('/api/admin/articles').set(as(rev)).expect(403);
  });

  it('cannot be used to escalate: you only grant what you hold, at a lower rank', async () => {
    const sup = await tokenFor('super@t.test');
    await newRole(sup, {
      name: 'Team Lead',
      permissions: [
        'dashboard.view',
        'articles.view',
        'users.view',
        'users.manage',
        'roles.manage',
      ],
      rank: 60,
    }).expect(201);
    await mkUser('lead@t.test', 'team-lead');
    const lead = await tokenFor('lead@t.test');

    const denied = await newRole(lead, {
      name: 'Sneaky',
      permissions: ['dashboard.view', 'ads.manage'],
      rank: 10,
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toMatch(/ads\.manage/);
    expect(
      (await newRole(lead, { name: 'Peer', permissions: ['dashboard.view'], rank: 60 })).status,
    ).toBe(403); // not below own rank
    expect(
      (await newRole(lead, { name: 'Above', permissions: ['dashboard.view'], rank: 70 })).status,
    ).toBe(403);
    expect(
      (
        await newRole(lead, {
          name: 'Junior',
          permissions: ['dashboard.view', 'articles.view'],
          rank: 30,
        })
      ).status,
    ).toBe(201);

    // the lead cannot edit or hand out a role at/above their own rank
    await request(app)
      .patch('/api/admin/roles/team-lead')
      .set(as(lead))
      .send({ name: 'Team Lead', permissions: ['dashboard.view'], rank: 10 })
      .expect(403);
    const created = await request(app)
      .post('/api/admin/users')
      .set(as(lead))
      .send({ email: 'x@t.test', role: 'admin', password: 'a-long-enough-password' });
    expect(created.status).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/admin/users')
          .set(as(lead))
          .send({ email: 'y@t.test', role: 'junior', password: 'a-long-enough-password' })
      ).status,
    ).toBe(201);
  });

  it('rejects bad definitions, reserved names, built-in edits, and deleting a role in use', async () => {
    const sup = await tokenFor('super@t.test');
    expect((await newRole(sup, { name: 'Editor', permissions: [], rank: 5 })).status).toBe(409); // collides with built-in
    expect((await newRole(sup, { name: 'X', permissions: [], rank: 5 })).status).toBe(400); // too short
    expect(
      (await newRole(sup, { name: 'Bad', permissions: ['not.a.permission'], rank: 5 })).status,
    ).toBe(400);
    expect((await newRole(sup, { name: 'Too High', permissions: [], rank: 95 })).status).toBe(403);
    await request(app)
      .patch('/api/admin/roles/editor')
      .set(as(sup))
      .send({ name: 'E', permissions: [], rank: 1 })
      .expect(400);
    await request(app).delete('/api/admin/roles/admin').set(as(sup)).expect(400);

    await newRole(sup, { name: 'Temp', permissions: ['dashboard.view'], rank: 20 }).expect(201);
    expect((await newRole(sup, { name: 'Temp', permissions: [], rank: 20 })).status).toBe(409);
    await mkUser('t@t.test', 'temp');
    await request(app).delete('/api/admin/roles/temp').set(as(sup)).expect(409);
    await AdminUser.deleteOne({ email: 't@t.test' });
    await request(app).delete('/api/admin/roles/temp').set(as(sup)).expect(204);
    expect(await Role.countDocuments()).toBe(0);
  });

  it('a user whose role was deleted underneath them is signed out, not given power', async () => {
    const sup = await tokenFor('super@t.test');
    await newRole(sup, { name: 'Ghost', permissions: ['dashboard.view'], rank: 20 }).expect(201);
    await mkUser('g@t.test', 'ghost');
    const g = await tokenFor('g@t.test');
    await Role.deleteOne({ key: 'ghost' }); // e.g. removed directly in the database
    await request(app).get('/api/admin/stats').set(as(g)).expect(401);
  });

  it('lists built-in and custom roles with user counts; viewing needs users.view', async () => {
    const sup = await tokenFor('super@t.test');
    await newRole(sup, { name: 'Writer', permissions: ['articles.view'], rank: 25 }).expect(201);
    await mkUser('w@t.test', 'writer');
    const list = (await request(app).get('/api/admin/roles').set(as(sup)).expect(200)).body.items;
    expect(list.map((r: { key: string }) => r.key)).toEqual(
      expect.arrayContaining(['super_admin', 'viewer', 'writer']),
    );
    expect(list.find((r: { key: string }) => r.key === 'writer')).toMatchObject({
      builtin: false,
      users: 1,
    });
    await request(app)
      .get('/api/admin/roles')
      .set(as(await tokenFor('w@t.test')))
      .expect(403);
  });

  it('writes role changes to the audit log', async () => {
    const sup = await tokenFor('super@t.test');
    await newRole(sup, { name: 'Audited', permissions: ['dashboard.view'], rank: 20 }).expect(201);
    const log = (await request(app).get('/api/admin/audit?action=role.').set(as(sup))).body.items;
    expect(log[0]).toMatchObject({ action: 'role.create', target: 'audited' });
  });
});
