import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import { Article, Author, Category, NewsletterSubscriber, Tag } from '../../models/index.js';
import { revalidateWeb } from '../../scheduler/revalidate.js';
import { config } from '../../config/index.js';
import { cached } from '../middleware/cache.js';
import { requireSecret } from '../middleware/auth.js';
import { HttpError, parse } from '../middleware/error.js';
import { publicArticle } from '../serializers.js';

/** Only published, non-hidden articles are ever visible to the public. */
const VISIBLE = { isHidden: false, status: 'published' } as const;
const slugParam = z.string().regex(/^[a-z0-9-]{1,120}$/);
const populate = [
  { path: 'category', select: 'name slug' },
  { path: 'author', select: 'name slug' },
  { path: 'tags', select: 'name slug' },
];

const listQuery = z.object({
  category: slugParam.optional(),
  tag: slugParam.optional(),
  author: slugParam.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  sort: z.enum(['latest', 'popular']).default('latest'),
});

/** Resolve slug filters to ids; returns null if a slug does not exist (empty result). */
async function listFilter(q: z.infer<typeof listQuery>) {
  const filter: Record<string, unknown> = { ...VISIBLE };
  if (q.category) {
    const c = await Category.findOne({ slug: q.category }, '_id').lean();
    if (!c) return null;
    filter.category = c._id;
  }
  if (q.tag) {
    const t = await Tag.findOne({ slug: q.tag }, '_id').lean();
    if (!t) return null;
    filter.tags = t._id;
  }
  if (q.author) {
    const a = await Author.findOne({ slug: q.author }, '_id').lean();
    if (!a) return null;
    filter.author = a._id;
  }
  return filter;
}

const latest = (filter: Record<string, unknown>, limit: number, skip = 0) =>
  Article.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).populate(populate).lean();

async function trending(limit: number) {
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const hot = await Article.find({ ...VISIBLE, publishedAt: { $gte: since } })
    .sort({ viewCount: -1, publishedAt: -1 })
    .limit(limit)
    .populate(populate)
    .lean();
  return hot.map(publicArticle);
}

export function publicRouter(opts: { newsletterMax: number }) {
  const r = Router();

  r.get('/articles', cached(60), async (req, res) => {
    const q = parse(listQuery, req.query);
    const filter = await listFilter(q);
    if (!filter)
      return res.json({ items: [], page: q.page, limit: q.limit, total: 0, totalPages: 0 });
    const sort = q.sort === 'popular' ? { viewCount: -1, publishedAt: -1 } : { publishedAt: -1 };
    const [items, total] = await Promise.all([
      Article.find(filter)
        .sort(sort as Record<string, 1 | -1>)
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate(populate)
        .lean(),
      Article.countDocuments(filter),
    ]);
    res.json({
      items: items.map(publicArticle),
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    });
  });

  r.get('/articles/:slug', cached(60), async (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    const a = await Article.findOne({ slug }).populate(populate).lean();
    if (!a) throw new HttpError(404, 'not found');
    // Taken-down articles answer 410 so search engines drop them.
    if (a.isHidden || a.status !== 'published') throw new HttpError(410, 'gone');
    res.json(publicArticle(a));
  });

  // Counts a view without being cached; called by the web app when rendering an article page.
  r.post('/articles/:slug/view', async (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    await Article.updateOne({ slug, ...VISIBLE }, { $inc: { viewCount: 1 } });
    res.status(204).end();
  });

  r.get('/articles/:slug/related', cached(300), async (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    const a = await Article.findOne({ slug, ...VISIBLE }, 'category tags').lean();
    if (!a) throw new HttpError(404, 'not found');
    const related = await Article.find({
      ...VISIBLE,
      _id: { $ne: a._id },
      $or: [{ category: a.category }, ...(a.tags?.length ? [{ tags: { $in: a.tags } }] : [])],
    })
      .sort({ publishedAt: -1 })
      .limit(6)
      .populate(populate)
      .lean();
    res.json({ items: related.map(publicArticle) });
  });

  r.get('/home', cached(60), async (_req, res) => {
    const featured = await Article.find({ ...VISIBLE, isFeatured: true })
      .sort({ publishedAt: -1 })
      .limit(5)
      .populate(populate)
      .lean();
    const recent = await latest(VISIBLE, 14);
    const hero = featured[0] ?? recent[0] ?? null;
    const heroId = hero ? String(hero._id) : null;
    const featuredRest = featured.filter((a) => String(a._id) !== heroId).slice(0, 4);
    const used = new Set([heroId, ...featuredRest.map((a) => String(a._id))]);
    const latestList = recent.filter((a) => !used.has(String(a._id))).slice(0, 10);

    const cats = await Category.find({ showInMenu: true }).sort({ order: 1 }).limit(8).lean();
    const sections = (
      await Promise.all(
        cats.map(async (c) => ({
          category: { name: c.name, slug: c.slug },
          items: (await latest({ ...VISIBLE, category: c._id }, 4)).map(publicArticle),
        })),
      )
    ).filter((s) => s.items.length > 0);

    res.json({
      hero: hero ? publicArticle(hero) : null,
      featured: featuredRest.map(publicArticle),
      latest: latestList.map(publicArticle),
      sections,
      trending: await trending(5),
    });
  });

  r.get('/categories', cached(300), async (_req, res) => {
    const counts = await Article.aggregate<{ _id: unknown; n: number }>([
      { $match: VISIBLE },
      { $group: { _id: '$category', n: { $sum: 1 } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    const cats = await Category.find().sort({ order: 1, name: 1 }).lean();
    res.json({
      items: cats.map((c) => ({
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        showInMenu: c.showInMenu,
        articleCount: byId.get(String(c._id)) ?? 0,
      })),
    });
  });

  r.get('/tags', cached(300), async (_req, res) => {
    const tags = await Tag.find().sort({ name: 1 }).limit(200).lean();
    res.json({ items: tags.map((t) => ({ name: t.name, slug: t.slug })) });
  });

  r.get('/authors/:slug', cached(300), async (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    const a = await Author.findOne({ slug }).lean();
    if (!a) throw new HttpError(404, 'not found');
    const articleCount = await Article.countDocuments({ ...VISIBLE, author: a._id });
    res.json({
      name: a.name,
      slug: a.slug,
      bio: a.bio ?? null,
      avatarUrl: a.avatarUrl ?? null,
      articleCount,
    });
  });

  r.get('/search', cached(60), async (req, res) => {
    const q = parse(
      z.object({
        q: z.string().trim().min(2).max(100),
        page: z.coerce.number().int().min(1).max(100).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(12),
      }),
      req.query,
    );
    const filter = { ...VISIBLE, $text: { $search: q.q } };
    const [items, total] = await Promise.all([
      Article.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate(populate)
        .lean(),
      Article.countDocuments(filter),
    ]);
    res.json({ items: items.map(publicArticle), page: q.page, limit: q.limit, total, query: q.q });
  });

  r.get('/trending', cached(300), async (_req, res) => {
    res.json({ items: await trending(10) });
  });

  r.post(
    '/newsletter',
    rateLimit({
      windowMs: 3600_000,
      limit: opts.newsletterMax,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
    async (req, res) => {
      const { email } = parse(
        z.object({ email: z.string().trim().toLowerCase().email().max(254) }),
        req.body,
      );
      await NewsletterSubscriber.updateOne(
        { email },
        { $setOnInsert: { email } },
        { upsert: true },
      );
      // Same answer whether or not the address already existed.
      res.status(202).json({ ok: true });
    },
  );

  // Server-to-server: ask the web app to refresh given tags.
  r.post(
    '/revalidate',
    requireSecret('x-revalidate-secret', config.revalidateSecret),
    async (req, res) => {
      const body = parse(
        z.object({
          articleSlugs: z.array(slugParam).max(200).default([]),
          categorySlugs: z.array(slugParam).max(50).default([]),
        }),
        req.body ?? {},
      );
      logger.info({ ...body }, 'revalidate requested');
      res.json({ ok: await revalidateWeb(body) });
    },
  );

  return r;
}
