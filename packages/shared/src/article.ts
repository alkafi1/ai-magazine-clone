import { z } from 'zod';

/** Max excerpt length we store (PLAN.md section 1). */
export const EXCERPT_MAX = 200;

/** The only article fields we ever store or show. No body text. */
export const scrapedArticleSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().max(EXCERPT_MAX),
  imageUrl: z.string().url().nullable(),
  imageAlt: z.string().nullable(),
  category: z.object({ name: z.string(), slug: z.string() }),
  authorName: z.string().nullable(),
  publishedAt: z.coerce.date(),
  sourceModifiedAt: z.coerce.date().nullable(),
  sourceUrl: z.string().url(),
  sourceSlug: z.string(),
  slug: z.string(),
  sourceHash: z.string(),
});

export type ScrapedArticle = z.infer<typeof scrapedArticleSchema>;
