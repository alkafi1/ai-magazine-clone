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

/** Slug from the title; on collision with a different article append a short suffix. */
async function uniqueSlug(base: string, sourceUrl: string, sourceSlug: string): Promise<string> {
  const clash = await Article.findOne({ slug: base, sourceUrl: { $ne: sourceUrl } }, '_id').lean();
  if (!clash) return base;
  return `${base}-${slugify(sourceSlug).slice(-6) || Date.now().toString(36)}`;
}

/**
 * Insert or update one article, keyed by sourceUrl. Only re-saves when sourceHash changed.
 * Admin-controlled fields (isFeatured, isHidden, seo, slug) are never overwritten on update.
 */
export async function upsertArticle(
  a: ScrapedArticle,
  runId?: Types.ObjectId,
): Promise<UpsertOutcome> {
  const existing = await Article.findOne({ sourceUrl: a.sourceUrl }, 'sourceHash').lean();
  if (existing && existing.sourceHash === a.sourceHash) return 'unchanged';

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
    return 'updated';
  }
  const slug = await uniqueSlug(a.slug, a.sourceUrl, a.sourceSlug);
  await Article.create({ ...fields, slug, sourceUrl: a.sourceUrl });
  return 'created';
}
