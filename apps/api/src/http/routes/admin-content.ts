import express, { Router } from 'express';
import { z } from 'zod';
import { Article, Author, Category, Media, Page, SiteSetting, Tag } from '../../models/index.js';
import { revalidateWeb } from '../../scheduler/revalidate.js';
import { slugify } from '../../scraper/normalizer.js';
import { audit } from '../audit.js';
import { adminOf, requirePermission } from '../middleware/auth.js';
import { clearCache } from '../middleware/cache.js';
import { HttpError, parse } from '../middleware/error.js';
import { objectId } from '../validators.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugField = z.string().trim().regex(SLUG, 'lowercase letters, digits and dashes').max(120);
const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => u.startsWith('https://'), 'must be an https URL');
const seoInput = z
  .object({
    metaTitle: z.string().trim().max(70).nullable(),
    metaDescription: z.string().trim().max(200).nullable(),
    noindex: z.boolean(),
  })
  .partial();

/** Find a free slug: base, base-2, base-3, ... (ignoring the document being edited). */
async function freeSlug(
  model: typeof Article | typeof Page | typeof Category,
  base: string,
  selfId?: string,
) {
  const root = base || 'untitled';
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const clash = await (model as typeof Article).findOne({ slug: candidate }, '_id').lean();
    if (!clash || String(clash._id) === selfId) return candidate;
  }
  throw new HttpError(409, 'could not find a free slug');
}

// ---- magic-byte checks for uploads ----------------------------------------------------------------
const startsWith = (b: Buffer, ...bytes: number[]) => bytes.every((v, i) => b[i] === v);
function sniffImage(b: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml' | null {
  if (startsWith(b, 0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (startsWith(b, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (
    b.length > 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  const head = b.toString('utf8', 0, Math.min(b.length, 1000)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    const all = b.toString('utf8').toLowerCase();
    // Defence in depth: it is also served with a sandboxing CSP, so scripts could never run anyway.
    if (/<script|<foreignobject|\son[a-z]+\s*=|javascript:|<iframe|<embed|<object/.test(all))
      return null;
    return 'image/svg+xml';
  }
  return null;
}

export function adminContentRouter() {
  const r = Router();
  const actorId = (req: Parameters<typeof adminOf>[0]) => adminOf(req).id;

  // =============================================================================================
  // Original articles (ours): the only articles that have a body.
  // =============================================================================================
  const articleInput = z.object({
    title: z.string().trim().min(3).max(160),
    slug: slugField.optional(),
    excerpt: z.string().trim().min(1).max(300),
    body: z
      .string()
      .min(1)
      .max(100_000)
      .transform((s) => s.replaceAll('\u0000', '')),
    category: objectId,
    tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    authorName: z.string().trim().max(100).optional(),
    coverMediaId: objectId.nullable().optional(),
    coverUrl: httpsUrl.nullable().optional(),
    imageAlt: z.string().trim().max(300).optional(),
    status: z.enum(['draft', 'published', 'scheduled']),
    publishedAt: z.string().datetime().nullable().optional(),
    isFeatured: z.boolean().default(false),
    seo: seoInput.default({}),
  });

  async function saveArticle(
    req: Parameters<typeof adminOf>[0],
    input: z.infer<typeof articleInput>,
    existingId?: string,
  ) {
    const admin = adminOf(req);
    const existing = existingId ? await Article.findById(existingId) : null;
    if (existingId && !existing) throw new HttpError(404, 'not found');
    if (existing && existing.kind !== 'original')
      throw new HttpError(400, 'aggregated stories cannot be edited here');

    const category = await Category.findById(input.category);
    if (!category) throw new HttpError(400, 'unknown category');
    if (
      input.isFeatured !== (existing?.isFeatured ?? false) &&
      !admin.permissions.includes('articles.feature')
    ) {
      throw new HttpError(403, 'forbidden: you cannot feature stories');
    }

    // status resolution: publishing with a future date schedules it; scheduling needs a future date
    const now = new Date();
    const given = input.publishedAt ? new Date(input.publishedAt) : null;
    let status = input.status;
    let publishedAt = given ?? existing?.publishedAt ?? now;
    if (status === 'published' && given && given > now) status = 'scheduled';
    if (status === 'scheduled' && !(given && given > now)) {
      throw new HttpError(400, 'scheduled articles need a publish date in the future');
    }
    if (status === 'published' && !given && existing?.status !== 'published') publishedAt = now;

    const slug = input.slug
      ? (await freeSlug(Article, input.slug, existingId)) === input.slug
        ? input.slug
        : (() => {
            throw new HttpError(409, 'that slug is already used by another article');
          })()
      : (existing?.slug ?? (await freeSlug(Article, slugify(input.title), existingId)));

    const authorName = (
      input.authorName ||
      admin.name ||
      admin.email.split('@')[0] ||
      'Staff'
    ).trim();
    const authorSlug = slugify(authorName) || 'staff';
    const author = await Author.findOneAndUpdate(
      { slug: authorSlug },
      { $setOnInsert: { name: authorName, slug: authorSlug } },
      { upsert: true, returnDocument: 'after' },
    );
    const tags = await Promise.all(
      [...new Set(input.tags.map((t) => t.trim()))].map((name) =>
        Tag.findOneAndUpdate(
          { slug: slugify(name) || name },
          { $setOnInsert: { name, slug: slugify(name) || name } },
          { upsert: true, returnDocument: 'after' },
        ),
      ),
    );

    if (input.coverMediaId && !(await Media.exists({ _id: input.coverMediaId })))
      throw new HttpError(400, 'unknown cover image');
    const words = input.body.split(/\s+/).filter(Boolean).length;
    const fields = {
      kind: 'original' as const,
      title: input.title,
      slug,
      excerpt: input.excerpt,
      body: input.body,
      category: category._id,
      author: author._id,
      tags: tags.map((t) => t._id),
      imageMedia: input.coverMediaId ?? undefined,
      imageUrl: input.coverMediaId ? undefined : (input.coverUrl ?? undefined),
      imageThumbUrl: input.coverMediaId ? undefined : (input.coverUrl ?? undefined),
      imageAlt: input.imageAlt || undefined,
      status,
      publishedAt,
      isFeatured: status === 'published' ? input.isFeatured : false,
      isHidden: false,
      readingTimeMin: Math.max(1, Math.ceil(words / 220)),
      seo: {
        metaTitle: input.seo.metaTitle ?? undefined,
        metaDescription: input.seo.metaDescription ?? undefined,
        noindex: !!input.seo.noindex,
      },
    };

    let doc;
    if (existing) {
      existing.set(fields);
      if (!input.coverMediaId) existing.imageMedia = undefined;
      doc = await existing.save();
    } else {
      doc = await Article.create({ ...fields, createdBy: admin.id, sourceHash: undefined });
    }
    clearCache();
    void revalidateWeb({ articleSlugs: [slug], categorySlugs: [category.slug] });
    return doc;
  }

  r.post('/articles', requirePermission('articles.write'), async (req, res) => {
    const input = parse(articleInput, req.body);
    const doc = await saveArticle(req, input);
    await audit(req, 'article.create', String(doc._id), { title: doc.title, status: doc.status });
    res.status(201).json({ id: String(doc._id), slug: doc.slug, status: doc.status });
  });

  r.put('/articles/:id', requirePermission('articles.write'), async (req, res) => {
    const id = parse(objectId, req.params.id);
    const input = parse(articleInput, req.body);
    const doc = await saveArticle(req, input, id);
    await audit(req, 'article.edit', String(doc._id), { title: doc.title, status: doc.status });
    res.json({ id: String(doc._id), slug: doc.slug, status: doc.status });
  });

  // =============================================================================================
  // Categories
  // =============================================================================================
  const categoryInput = z.object({
    name: z.string().trim().min(2).max(60),
    slug: slugField.optional(),
    description: z.string().trim().max(300).default(''),
    order: z.number().int().min(0).max(10_000).default(100),
    showInMenu: z.boolean().default(true),
    seo: seoInput.default({}),
  });

  r.get('/categories', requirePermission('articles.view'), async (_req, res) => {
    const [cats, counts] = await Promise.all([
      Category.find().sort({ order: 1, name: 1 }).lean(),
      Article.aggregate<{ _id: unknown; n: number }>([
        { $group: { _id: '$category', n: { $sum: 1 } } },
      ]),
    ]);
    const n = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({
      items: cats.map((c) => ({
        id: String(c._id),
        name: c.name,
        slug: c.slug,
        description: c.description ?? '',
        order: c.order,
        showInMenu: c.showInMenu,
        seo: {
          metaTitle: c.seo?.metaTitle ?? null,
          metaDescription: c.seo?.metaDescription ?? null,
          noindex: !!c.seo?.noindex,
        },
        articleCount: n.get(String(c._id)) ?? 0,
      })),
    });
  });

  const refreshCategories = () => {
    clearCache();
    void revalidateWeb({ extraTags: ['categories', 'home'] });
  };

  r.post('/categories', requirePermission('categories.manage'), async (req, res) => {
    const input = parse(categoryInput, req.body);
    const slug = input.slug ?? (await freeSlug(Category, slugify(input.name)));
    try {
      const c = await Category.create({ ...input, slug });
      await audit(req, 'category.create', slug);
      refreshCategories();
      res.status(201).json({ id: String(c._id), slug });
    } catch (err) {
      if ((err as { code?: number }).code === 11000)
        throw new HttpError(409, 'a category with that slug exists');
      throw err;
    }
  });

  r.patch('/categories/:id', requirePermission('categories.manage'), async (req, res) => {
    const id = parse(objectId, req.params.id);
    const input = parse(categoryInput, req.body);
    const c = await Category.findById(id);
    if (!c) throw new HttpError(404, 'not found');
    try {
      c.set({ ...input, slug: input.slug ?? c.slug });
      await c.save();
    } catch (err) {
      if ((err as { code?: number }).code === 11000)
        throw new HttpError(409, 'a category with that slug exists');
      throw err;
    }
    await audit(req, 'category.update', c.slug);
    refreshCategories();
    res.json({ id: String(c._id), slug: c.slug });
  });

  r.delete('/categories/:id', requirePermission('categories.manage'), async (req, res) => {
    const id = parse(objectId, req.params.id);
    const c = await Category.findById(id);
    if (!c) throw new HttpError(404, 'not found');
    const n = await Article.countDocuments({ category: c._id });
    if (n > 0)
      throw new HttpError(409, `${n} article(s) are filed under this category: move them first`);
    await c.deleteOne();
    await audit(req, 'category.delete', c.slug);
    refreshCategories();
    res.status(204).end();
  });

  // =============================================================================================
  // Custom pages
  // =============================================================================================
  const pageInput = z.object({
    slug: slugField.optional(),
    title: z.string().trim().min(2).max(160),
    body: z
      .string()
      .min(1)
      .max(100_000)
      .transform((s) => s.replaceAll('\u0000', '')),
    status: z.enum(['draft', 'published']),
    seo: seoInput.default({}),
  });
  const pageView = (p: InstanceType<typeof Page>) => ({
    id: String(p._id),
    slug: p.slug,
    title: p.title,
    body: p.body,
    status: p.status,
    seo: {
      metaTitle: p.seo?.metaTitle ?? null,
      metaDescription: p.seo?.metaDescription ?? null,
      noindex: !!p.seo?.noindex,
    },
    updatedAt: p.updatedAt,
  });
  const refreshPage = (slug: string) => {
    clearCache();
    void revalidateWeb({ extraTags: ['home', 'settings', `page:${slug}`] }); // 'home' also refreshes the sitemap
  };

  r.get('/pages', requirePermission('pages.manage'), async (_req, res) => {
    const pages = await Page.find().sort({ title: 1 });
    res.json({ items: pages.map((p) => pageView(p)) });
  });
  r.get('/pages/:id', requirePermission('pages.manage'), async (req, res) => {
    const p = await Page.findById(parse(objectId, req.params.id));
    if (!p) throw new HttpError(404, 'not found');
    res.json(pageView(p));
  });
  r.post('/pages', requirePermission('pages.manage'), async (req, res) => {
    const input = parse(pageInput, req.body);
    const slug = input.slug ?? (await freeSlug(Page, slugify(input.title)));
    if (await Page.exists({ slug })) throw new HttpError(409, 'a page with that slug exists');
    const p = await Page.create({ ...input, slug, updatedBy: actorId(req) });
    await audit(req, 'page.create', slug);
    refreshPage(slug);
    res.status(201).json({ id: String(p._id), slug });
  });
  r.put('/pages/:id', requirePermission('pages.manage'), async (req, res) => {
    const id = parse(objectId, req.params.id);
    const input = parse(pageInput, req.body);
    const p = await Page.findById(id);
    if (!p) throw new HttpError(404, 'not found');
    const slug = input.slug ?? p.slug;
    if (slug !== p.slug && (await Page.exists({ slug })))
      throw new HttpError(409, 'a page with that slug exists');
    p.set({ ...input, slug, updatedBy: actorId(req) });
    await p.save();
    await audit(req, 'page.update', slug);
    refreshPage(slug);
    res.json({ id: String(p._id), slug });
  });
  r.delete('/pages/:id', requirePermission('pages.manage'), async (req, res) => {
    const p = await Page.findById(parse(objectId, req.params.id));
    if (!p) throw new HttpError(404, 'not found');
    await p.deleteOne();
    await audit(req, 'page.delete', p.slug);
    refreshPage(p.slug);
    res.status(204).end();
  });

  // =============================================================================================
  // Media (images)
  // =============================================================================================
  r.post(
    '/media',
    requirePermission('media.manage'),
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'], limit: '2mb' }),
    async (req, res) => {
      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.length === 0)
        throw new HttpError(
          415,
          'send the image as the request body (png, jpeg, webp or svg, up to 2 MB)',
        );
      const mime = sniffImage(buf);
      if (!mime)
        throw new HttpError(415, 'that file is not a valid image (or the svg contains scripts)');
      if (mime !== req.header('content-type')?.split(';')[0])
        throw new HttpError(415, 'file contents do not match the declared type');
      const filename =
        (req.header('x-filename') ?? 'image').replace(/[^\w.\- ]+/g, '_').slice(0, 100) || 'image';
      const m = await Media.create({
        filename,
        mime,
        size: buf.length,
        data: buf,
        createdBy: actorId(req),
      });
      await audit(req, 'media.upload', filename, { bytes: buf.length });
      res.status(201).json({ id: String(m._id), filename, mime, size: buf.length });
    },
  );

  r.get('/media', requirePermission('media.manage'), async (_req, res) => {
    const items = await Media.find({}, '-data').sort({ createdAt: -1 }).limit(200).lean();
    res.json({
      items: items.map((m) => ({
        id: String(m._id),
        filename: m.filename,
        mime: m.mime,
        size: m.size,
        createdAt: m.createdAt,
      })),
    });
  });

  r.delete('/media/:id', requirePermission('media.manage'), async (req, res) => {
    const id = parse(objectId, req.params.id);
    const m = await Media.findById(id, '-data');
    if (!m) throw new HttpError(404, 'not found');
    const inArticle = await Article.exists({ imageMedia: m._id });
    const settings = (await SiteSetting.find({ key: /^settings:/ }).lean()).some((s) =>
      JSON.stringify(s.value ?? '').includes(id),
    );
    if (inArticle || settings)
      throw new HttpError(409, 'this image is in use (an article cover, the logo or the favicon)');
    await m.deleteOne();
    await audit(req, 'media.delete', m.filename);
    res.status(204).end();
  });

  return r;
}
