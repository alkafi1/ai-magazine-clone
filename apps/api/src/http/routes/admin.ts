import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import {
  AdminUser,
  Article,
  AuditLog,
  Category,
  NewsletterSubscriber,
  ScrapeError,
  ScrapeRun,
} from '../../models/index.js';
import { revalidateWeb } from '../../scheduler/revalidate.js';
import { startRun } from '../../scheduler/index.js';
import { adminOf, requireAdmin, signAdminToken } from '../middleware/auth.js';
import { clearCache } from '../middleware/cache.js';
import { HttpError, parse } from '../middleware/error.js';

const page = z.coerce.number().int().min(1).max(10_000).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);
const objectId = z.string().refine(isValidObjectId, 'invalid id');

// A real hash to compare against when the user does not exist, so timing doesn't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

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
      const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok) throw new HttpError(401, 'invalid credentials');
      user.lastLoginAt = new Date();
      await user.save();
      const token = signAdminToken({ sub: String(user._id), email: user.email, role: user.role });
      res.json({ token, user: { email: user.email, role: user.role } });
    },
  );

  r.use(requireAdmin);

  const audit = (req: Parameters<typeof adminOf>[0], action: string, target?: string) =>
    AuditLog.create({ admin: adminOf(req).sub, action, target });

  r.get('/articles', async (req, res) => {
    const q = parse(
      z.object({
        page,
        limit,
        q: z.string().trim().max(100).optional(),
        hidden: z.enum(['true', 'false']).optional(),
        featured: z.enum(['true', 'false']).optional(),
      }),
      req.query,
    );
    const filter: Record<string, unknown> = {};
    if (q.q) filter.$text = { $search: q.q };
    if (q.hidden) filter.isHidden = q.hidden === 'true';
    if (q.featured) filter.isFeatured = q.featured === 'true';
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
        title: a.title,
        slug: a.slug,
        category: (a.category as unknown as { name?: string })?.name ?? null,
        publishedAt: a.publishedAt,
        sourceUrl: a.sourceUrl,
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

  r.get('/articles/:id', async (req, res) => {
    const id = parse(objectId, req.params.id);
    const a = await Article.findById(id)
      .populate('category', 'name slug')
      .populate('author', 'name slug')
      .lean();
    if (!a) throw new HttpError(404, 'not found');
    res.json({
      id: String(a._id),
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      category: (a.category as unknown as { name?: string })?.name ?? null,
      author: (a.author as unknown as { name?: string })?.name ?? null,
      publishedAt: a.publishedAt,
      scrapedAt: a.scrapedAt,
      sourceUrl: a.sourceUrl,
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
    await audit(req, 'article.update', String(a._id));
    clearCache();
    void revalidateWeb({ articleSlugs: [a.slug], categorySlugs: [] });
    res.json({
      id: String(a._id),
      isHidden: a.isHidden,
      isFeatured: a.isFeatured,
      status: a.status,
      seo: a.seo,
    });
  });

  // Takedown, not a hard delete: the row stays (hidden, 410) so the scraper does not re-import it.
  r.delete('/articles/:id', async (req, res) => {
    const id = parse(objectId, req.params.id);
    const a = await Article.findByIdAndUpdate(
      id,
      { $set: { isHidden: true, isFeatured: false, status: 'hidden' } },
      { returnDocument: 'after' },
    ).lean();
    if (!a) throw new HttpError(404, 'not found');
    await audit(req, 'article.takedown', String(a._id));
    clearCache();
    void revalidateWeb({ articleSlugs: [a.slug], categorySlugs: [] });
    res.status(204).end();
  });

  r.get('/scrape-runs', async (req, res) => {
    const q = parse(z.object({ page, limit }), req.query);
    const [runs, total] = await Promise.all([
      ScrapeRun.find()
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

  r.post('/scrape-runs', async (req, res) => {
    await audit(req, 'scrape.manual');
    startRun('manual');
    res.status(202).json({ accepted: true });
  });

  r.get('/stats', async (_req, res) => {
    const day = new Date(Date.now() - 24 * 3600 * 1000);
    const [articles, hidden, featured, categories, last24h, subscribers, lastRun, byCategory] =
      await Promise.all([
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
      ]);
    const names = new Map(
      (await Category.find({}, 'name').lean()).map((c) => [String(c._id), c.name]),
    );
    res.json({
      articles,
      hidden,
      featured,
      categories,
      scrapedLast24h: last24h,
      subscribers,
      lastRun,
      topCategories: byCategory.map((c) => ({
        name: names.get(String(c._id)) ?? 'Unknown',
        count: c.n,
      })),
    });
  });

  return r;
}
