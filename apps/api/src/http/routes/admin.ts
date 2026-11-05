import type { Permission } from '@aimag/shared';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { allRoles } from '../../db/roles.js';
import { outranks } from '@aimag/shared';
import { startRun } from '../../scheduler/index.js';
import { revalidateWeb } from '../../scheduler/revalidate.js';
import {
  AdminUser,
  Article,
  AuditLog,
  Category,
  NewsletterSubscriber,
  ScrapeError,
  ScrapeRun,
} from '../../models/index.js';
import { audit, auditAnonymous } from '../audit.js';
import { adminOf, requireAdmin, requirePermission, signAdminToken } from '../middleware/auth.js';
import { clearCache } from '../middleware/cache.js';
import { HttpError, parse } from '../middleware/error.js';
import { limit, objectId, page } from '../validators.js';
import { adminMiscRouter } from './admin-misc.js';
import { adminContentRouter } from './admin-content.js';
import { adminRolesRouter } from './admin-roles.js';
import { adminUsersRouter } from './admin-users.js';

// A real hash to compare against when the user does not exist, so timing doesn't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60_000;

const patchBody = z
  .object({
    isHidden: z.boolean(),
    isFeatured: z.boolean(),
    status: z.enum(['published', 'hidden']),
    seo: z
      .object({
        metaTitle: z.string().max(70).nullable(),
        metaDescription: z.string().max(200).nullable(),
        ogImage: z.string().url().nullable(),
        noindex: z.boolean(),
      })
      .partial(),
  })
  .partial()
  .strict();

/** 403 unless the signed-in admin's role grants `permission`. For checks that depend on the request body. */
function need(req: Parameters<typeof adminOf>[0], permission: Permission) {
  if (!adminOf(req).permissions.includes(permission)) throw new HttpError(403, 'forbidden');
}

export function adminRouter(opts: { loginMax: number }) {
  const r = Router();

  r.post(
    '/login',
    rateLimit({
      windowMs: 15 * 60_000,
      limit: opts.loginMax,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
    async (req, res) => {
      const { email, password } = parse(
        z.object({
          email: z.string().trim().toLowerCase().email(),
          password: z.string().min(1).max(200),
        }),
        req.body,
      );
      const user = await AdminUser.findOne({ email });
      const locked = !!user?.lockedUntil && user.lockedUntil > new Date();
      const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

      if (!user || !user.active || locked || !ok) {
        if (user?.active && !locked && !ok) {
          user.failedLogins += 1;
          if (user.failedLogins >= MAX_FAILED_LOGINS) {
            user.failedLogins = 0;
            user.lockedUntil = new Date(Date.now() + LOCK_MS);
            await auditAnonymous(req, 'auth.locked', email, { minutes: LOCK_MS / 60_000 });
          } else {
            await auditAnonymous(req, 'auth.login_failed', email);
          }
          await user.save();
        } else if (locked) {
          await auditAnonymous(req, 'auth.login_while_locked', email);
        }
        // Same answer for unknown account, wrong password, disabled and locked: no account enumeration.
        throw new HttpError(401, 'invalid credentials');
      }

      user.failedLogins = 0;
      user.lockedUntil = undefined;
      user.lastLoginAt = new Date();
      await user.save();
      await AuditLog.create({
        admin: user._id,
        actorEmail: user.email,
        action: 'auth.login',
        ip: req.ip,
      });
      res.json({
        token: signAdminToken({ id: String(user._id), tokenVersion: user.tokenVersion }),
        user: { id: String(user._id), email: user.email, name: user.name, role: user.role },
      });
    },
  );

  r.use(requireAdmin);

  // ---- who am I / change own password -------------------------------------------------------
  r.get('/me', async (req, res) => {
    const me = adminOf(req);
    const roles = await allRoles();
    res.json({
      ...me,
      assignableRoles: roles
        .filter((r) => outranks(me, r.rank))
        .map(({ key, name, rank }) => ({ key, name, rank })),
    });
  });

  r.patch('/me', async (req, res) => {
    const { name } = parse(z.object({ name: z.string().trim().max(100) }), req.body);
    await AdminUser.updateOne({ _id: adminOf(req).id }, { name });
    await audit(req, 'account.rename');
    res.json({ ok: true });
  });

  r.post('/me/password', async (req, res) => {
    const body = parse(
      z.object({ current: z.string().min(1).max(200), password: z.string().min(12).max(200) }),
      req.body,
    );
    const user = await AdminUser.findById(adminOf(req).id);
    if (!user || !(await bcrypt.compare(body.current, user.passwordHash))) {
      throw new HttpError(400, 'current password is incorrect');
    }
    if (body.password === body.current) throw new HttpError(400, 'choose a different password');
    user.passwordHash = await bcrypt.hash(body.password, 12);
    user.passwordChangedAt = new Date();
    user.tokenVersion += 1; // signs out every other session
    await user.save();
    await audit(req, 'account.password_changed');
    // The caller gets a fresh token so their own session continues.
    res.json({ token: signAdminToken({ id: String(user._id), tokenVersion: user.tokenVersion }) });
  });

  r.use('/users', adminUsersRouter());
  r.use('/roles', adminRolesRouter());
  r.use(adminContentRouter());
  r.use(adminMiscRouter());

  // ---- articles -----------------------------------------------------------------------------
  r.get('/articles', requirePermission('articles.view'), async (req, res) => {
    const q = parse(
      z.object({
        page,
        limit,
        q: z.string().trim().max(100).optional(),
        hidden: z.enum(['true', 'false']).optional(),
        featured: z.enum(['true', 'false']).optional(),
        kind: z.enum(['scraped', 'original']).optional(),
        status: z.enum(['draft', 'scheduled', 'published', 'hidden']).optional(),
        category: z
          .string()
          .regex(/^[a-z0-9-]{1,120}$/)
          .optional(),
      }),
      req.query,
    );
    const filter: Record<string, unknown> = {};
    if (q.q) filter.$text = { $search: q.q };
    if (q.hidden) filter.isHidden = q.hidden === 'true';
    if (q.featured) filter.isFeatured = q.featured === 'true';
    if (q.kind) filter.kind = q.kind;
    if (q.status) filter.status = q.status;
    if (q.category) {
      const c = await Category.findOne({ slug: q.category }, '_id').lean();
      filter.category = c?._id ?? null;
    }
    const [items, total] = await Promise.all([
      Article.find(filter)
        .sort({ publishedAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate('category', 'name slug')
        .lean(),
      Article.countDocuments(filter),
    ]);
    res.json({
      items: items.map((a) => ({
        id: String(a._id),
        kind: a.kind ?? 'scraped',
        title: a.title,
        slug: a.slug,
        category: (a.category as unknown as { name?: string })?.name ?? null,
        publishedAt: a.publishedAt,
        sourceUrl: a.sourceUrl ?? null,
        isHidden: a.isHidden,
        isFeatured: a.isFeatured,
        status: a.status,
        viewCount: a.viewCount,
        seo: a.seo,
      })),
      page: q.page,
      limit: q.limit,
      total,
    });
  });

  r.get('/articles/:id', requirePermission('articles.view'), async (req, res) => {
    const id = parse(objectId, req.params.id);
    const a = await Article.findById(id)
      .populate('category', 'name slug')
      .populate('author', 'name slug')
      .populate('tags', 'name')
      .lean();
    if (!a) throw new HttpError(404, 'not found');
    const original = a.kind === 'original';
    res.json({
      id: String(a._id),
      kind: a.kind ?? 'scraped',
      ...(original
        ? {
            body: a.body ?? '',
            categoryId: String((a.category as unknown as { _id?: unknown })?._id ?? ''),
            tags: ((a.tags ?? []) as unknown as { name: string }[]).map((t) => t.name),
            coverMediaId: a.imageMedia ? String(a.imageMedia) : null,
            coverUrl: a.imageUrl ?? null,
            imageAlt: a.imageAlt ?? '',
          }
        : {}),
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      category: (a.category as unknown as { name?: string })?.name ?? null,
      author: (a.author as unknown as { name?: string })?.name ?? null,
      publishedAt: a.publishedAt,
      scrapedAt: a.scrapedAt,
      sourceUrl: a.sourceUrl ?? null,
      isHidden: a.isHidden,
      isFeatured: a.isFeatured,
      status: a.status,
      viewCount: a.viewCount,
      seo: {
        metaTitle: a.seo?.metaTitle ?? null,
        metaDescription: a.seo?.metaDescription ?? null,
        ogImage: a.seo?.ogImage ?? null,
        noindex: !!a.seo?.noindex,
      },
    });
  });

  r.patch('/articles/:id', async (req, res) => {
    const id = parse(objectId, req.params.id);
    const body = parse(patchBody, req.body);
    // Each kind of change needs its own permission, so e.g. an editor cannot hide stories.
    if (body.isHidden !== undefined || body.status !== undefined) need(req, 'articles.moderate');
    if (body.isFeatured !== undefined) need(req, 'articles.feature');
    if (body.seo !== undefined) need(req, 'articles.seo');

    const set: Record<string, unknown> = {};
    if (body.isHidden !== undefined) {
      set.isHidden = body.isHidden;
      set.status = body.isHidden ? 'hidden' : 'published';
    }
    if (body.status !== undefined) {
      set.status = body.status;
      set.isHidden = body.status === 'hidden';
    }
    if (body.isFeatured !== undefined) set.isFeatured = body.isFeatured;
    for (const [k, v] of Object.entries(body.seo ?? {})) set[`seo.${k}`] = v;
    if (!Object.keys(set).length) throw new HttpError(400, 'nothing to update');

    const a = await Article.findByIdAndUpdate(
      id,
      { $set: set },
      { returnDocument: 'after' },
    ).lean();
    if (!a) throw new HttpError(404, 'not found');
    await audit(req, 'article.update', String(a._id), {
      title: a.title,
      changes: Object.keys(set),
    });
    clearCache();
    void revalidateWeb({ articleSlugs: [a.slug] });
    res.json({
      id: String(a._id),
      isHidden: a.isHidden,
      isFeatured: a.isFeatured,
      status: a.status,
      seo: a.seo,
    });
  });

  // Several stories at once. Same permissions as the single-article actions.
  r.post('/articles/bulk', async (req, res) => {
    const body = parse(
      z.object({
        ids: z.array(objectId).min(1).max(100),
        action: z.enum(['hide', 'restore', 'feature', 'unfeature']),
      }),
      req.body,
    );
    need(
      req,
      body.action === 'feature' || body.action === 'unfeature'
        ? 'articles.feature'
        : 'articles.moderate',
    );
    const set: Record<string, unknown> =
      body.action === 'hide'
        ? { isHidden: true, status: 'hidden', isFeatured: false }
        : body.action === 'restore'
          ? { isHidden: false, status: 'published' }
          : { isFeatured: body.action === 'feature' };
    const filter: Record<string, unknown> = { _id: { $in: body.ids } };
    if (body.action === 'feature') filter.isHidden = false; // never feature a hidden story

    const slugs = (await Article.find(filter, 'slug').lean()).map((a) => a.slug);
    const result = await Article.updateMany(filter, { $set: set });
    await audit(req, `article.bulk_${body.action}`, undefined, {
      count: result.modifiedCount,
      ids: body.ids,
    });
    clearCache();
    void revalidateWeb({ articleSlugs: slugs });
    res.json({ matched: result.matchedCount, modified: result.modifiedCount });
  });

  // Aggregated stories are taken down, not deleted: the row stays (hidden, 410) so the scraper does not
  // re-import them. Our own articles are deleted for real (needs articles.write).
  r.delete('/articles/:id', async (req, res) => {
    const id = parse(objectId, req.params.id);
    const existing = await Article.findById(id, 'kind slug title').lean();
    if (!existing) throw new HttpError(404, 'not found');
    if (existing.kind === 'original') {
      need(req, 'articles.write');
      await Article.deleteOne({ _id: id });
      await audit(req, 'article.delete', String(id), { title: existing.title });
    } else {
      need(req, 'articles.moderate');
      await Article.updateOne(
        { _id: id },
        { $set: { isHidden: true, isFeatured: false, status: 'hidden' } },
      );
      await audit(req, 'article.takedown', String(id), { title: existing.title });
    }
    clearCache();
    void revalidateWeb({ articleSlugs: [existing.slug] });
    res.status(204).end();
  });

  // ---- scrape runs --------------------------------------------------------------------------
  r.get('/scrape-runs', requirePermission('scrape.view'), async (req, res) => {
    const q = parse(z.object({ page, limit }), req.query);
    const [runs, total] = await Promise.all([
      ScrapeRun.find({}, '-items')
        .sort({ startedAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      ScrapeRun.countDocuments(),
    ]);
    const errors = await ScrapeError.find({ run: { $in: runs.map((x) => x._id) } })
      .sort({ at: -1 })
      .limit(200)
      .lean();
    res.json({
      items: runs.map((x) => ({
        ...x,
        id: String(x._id),
        errors: errors.filter((e) => String(e.run) === String(x._id)).slice(0, 10),
      })),
      page: q.page,
      limit: q.limit,
      total,
    });
  });

  // One run in detail: every article it added, updated or failed on, plus its errors and warnings.
  r.get('/scrape-runs/:id', requirePermission('scrape.view'), async (req, res) => {
    const id = parse(objectId, req.params.id);
    const run = await ScrapeRun.findById(id).lean();
    if (!run) throw new HttpError(404, 'not found');
    const errors = await ScrapeError.find({ run: run._id }).sort({ at: 1 }).limit(200).lean();
    type RunItem = {
      outcome: 'created' | 'updated' | 'failed';
      title?: string | null;
      slug?: string | null;
      url?: string | null;
      category?: string | null;
      stage?: string | null;
      message?: string | null;
    };
    let items: RunItem[] = [...(run.items ?? [])];
    let legacy = false;
    if (items.length === 0 && run.created + run.updated > 0) {
      // Runs from before per-article details were recorded: show the articles that run last touched.
      legacy = true;
      const touched = await Article.find({ lastRun: run._id }, 'title slug sourceUrl category')
        .populate('category', 'name')
        .limit(500)
        .lean();
      items = touched.map((a) => ({
        outcome: 'created' as const,
        title: a.title,
        slug: a.slug,
        url: a.sourceUrl ?? undefined,
        category: (a.category as unknown as { name?: string })?.name,
      }));
    }
    const liveSlugs = new Set(
      (
        await Article.find(
          {
            slug: { $in: items.map((i) => i.slug).filter(Boolean) as string[] },
            isHidden: false,
            status: 'published',
          },
          'slug',
        ).lean()
      ).map((a) => a.slug),
    );
    res.json({
      id: String(run._id),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt ?? null,
      durationMs: run.durationMs ?? null,
      trigger: run.trigger,
      status: run.status,
      urlsFound: run.urlsFound,
      created: run.created,
      updated: run.updated,
      skipped: run.skipped,
      failed: run.failed,
      warnings: run.warnings ?? [],
      notes: run.notes ?? [],
      legacy,
      truncated: run.created + run.updated + run.failed > items.length && !legacy,
      items: items.map((i) => ({ ...i, live: !!i.slug && liveSlugs.has(i.slug) })),
      errors: errors.map((e) => ({
        url: e.url,
        stage: e.stage,
        message: e.message,
        httpStatus: e.httpStatus,
        at: e.at,
      })),
    });
  });

  r.post('/scrape-runs', requirePermission('scrape.run'), async (req, res) => {
    await audit(req, 'scrape.manual');
    startRun('manual');
    res.status(202).json({ accepted: true });
  });

  // ---- dashboard ----------------------------------------------------------------------------
  r.get('/stats', requirePermission('dashboard.view'), async (_req, res) => {
    const day = new Date(Date.now() - 24 * 3600 * 1000);
    const since30 = new Date(Date.now() - 29 * 24 * 3600 * 1000);
    since30.setUTCHours(0, 0, 0, 0);
    const [
      articles,
      hidden,
      featured,
      categories,
      last24h,
      subscribers,
      lastRun,
      byCategory,
      perDay,
      runs,
      views,
      admins,
    ] = await Promise.all([
      Article.countDocuments(),
      Article.countDocuments({ isHidden: true }),
      Article.countDocuments({ isFeatured: true }),
      Category.countDocuments(),
      Article.countDocuments({ scrapedAt: { $gte: day } }),
      NewsletterSubscriber.countDocuments(),
      ScrapeRun.findOne().sort({ startedAt: -1 }).lean(),
      Article.aggregate([
        { $group: { _id: '$category', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 10 },
      ]),
      Article.aggregate<{ _id: string; n: number }>([
        { $match: { publishedAt: { $gte: since30 } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishedAt', timezone: 'UTC' } },
            n: { $sum: 1 },
          },
        },
      ]),
      ScrapeRun.find({}, 'startedAt status created updated failed durationMs warnings')
        .sort({ startedAt: -1 })
        .limit(20)
        .lean(),
      Article.aggregate<{ _id: null; n: number }>([
        { $group: { _id: null, n: { $sum: '$viewCount' } } },
      ]),
      AdminUser.countDocuments({ active: true }),
    ]);
    const names = new Map(
      (await Category.find({}, 'name').lean()).map((c) => [String(c._id), c.name]),
    );
    const counts = new Map(perDay.map((d) => [d._id, d.n]));
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since30.getTime() + i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      return { date: d, count: counts.get(d) ?? 0 };
    });
    res.json({
      articles,
      hidden,
      featured,
      categories,
      scrapedLast24h: last24h,
      subscribers,
      totalViews: views[0]?.n ?? 0,
      activeAdmins: admins,
      lastRun,
      daily,
      recentRuns: runs.reverse(),
      topCategories: byCategory.map((c) => ({
        name: names.get(String(c._id)) ?? 'Unknown',
        count: c.n,
      })),
    });
  });

  return r;
}
