import { createHash } from 'node:crypto';
import type { ScrapedArticle } from '@aimag/shared';
import type { Types } from 'mongoose';
import { Article, Author, Category } from '../models/index.js';
import { slugify } from '../scraper/normalizer.js';

export type UpsertOutcome = 'created' | 'updated' | 'unchanged';

async function categoryId(cat: ScrapedArticle['category']): Promise<Types.ObjectId> {
  const doc = await Category.findOneAndUpdate(
    { slug: cat.slug },
    { $setOnInsert: { name: cat.name, slug: cat.slug } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc._id;
}

async function authorId(name: string | null): Promise<Types.ObjectId | undefined> {
  if (!name) return undefined;
  const slug = slugify(name);
  if (!slug) return undefined;
  const doc = await Author.findOneAndUpdate(
    { slug },
    { $setOnInsert: { name, slug } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc._id;
}

/**
 * Slug from the title. If another article already has it (titles that share their first 80 characters,
 * like "This week's top five stories in AI: week 1 / 2 / 3 October"), add a suffix derived from the
 * source URL's hash: stable (the same URL always gets the same slug) and different for every URL.
 */
async function uniqueSlug(base: string, sourceUrl: string): Promise<string> {
  const taken = async (slug: string) =>
    !!(await Article.exists({ slug, sourceUrl: { $ne: sourceUrl } }));
  if (!(await taken(base))) return base;
  const hash = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 6);
  let candidate = `${base.slice(0, 72)}-${hash}`;
  for (let i = 2; await taken(candidate); i++) candidate = `${base.slice(0, 68)}-${hash}-${i}`;
  return candidate;
}

export type UpsertResult = { outcome: UpsertOutcome; slug: string };

/**
 * Insert or update one article, keyed by sourceUrl. Only re-saves when sourceHash changed.
 * Admin-controlled fields (isFeatured, isHidden, seo, slug) are never overwritten on update.
 */
export async function upsertArticleDetailed(
  a: ScrapedArticle,
  runId?: Types.ObjectId,
): Promise<UpsertResult> {
  const existing = await Article.findOne({ sourceUrl: a.sourceUrl }, 'sourceHash slug').lean();
  if (existing && existing.sourceHash === a.sourceHash)
    return { outcome: 'unchanged', slug: existing.slug };

  const [category, author] = await Promise.all([categoryId(a.category), authorId(a.authorName)]);
  const fields = {
    title: a.title,
    excerpt: a.excerpt,
    imageUrl: a.imageUrl ?? undefined,
    imageThumbUrl: a.imageThumbUrl ?? undefined,
    imageAlt: a.imageAlt ?? undefined,
    category,
    author,
    sourceSlug: a.sourceSlug,
    sourceHash: a.sourceHash,
    publishedAt: a.publishedAt,
    sourceModifiedAt: a.sourceModifiedAt ?? undefined,
    scrapedAt: new Date(),
    lastRun: runId,
  };

  if (existing) {
    await Article.updateOne({ sourceUrl: a.sourceUrl }, { $set: fields });
    return { outcome: 'updated', slug: existing.slug };
  }
  // Two articles being saved at the same moment could still pick the same slug: retry once with a new one.
  for (let attempt = 0; ; attempt++) {
    const slug = await uniqueSlug(attempt === 0 ? a.slug : `${a.slug}-${attempt + 1}`, a.sourceUrl);
    try {
      await Article.create({ ...fields, slug, sourceUrl: a.sourceUrl });
      return { outcome: 'created', slug };
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code !== 11000 || !/slug/.test(e.message ?? '') || attempt >= 3) throw err;
    }
  }
}

export async function upsertArticle(
  a: ScrapedArticle,
  runId?: Types.ObjectId,
): Promise<UpsertOutcome> {
  return (await upsertArticleDetailed(a, runId)).outcome;
}
