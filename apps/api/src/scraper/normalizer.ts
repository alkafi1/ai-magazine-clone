import { createHash } from 'node:crypto';
import { EXCERPT_MAX, scrapedArticleSchema, type ScrapedArticle } from '@aimag/shared';
import { config } from '../config/index.js';
import type { RawArticle } from './parser.js';
import type { SitemapUrl } from './sitemap.js';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

/** Strip tags/whitespace and cut at a word boundary to at most EXCERPT_MAX characters. */
export function makeExcerpt(text: string | null): string {
  if (!text) return '';
  const clean = decodeEntities(text.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= EXCERPT_MAX) return clean;
  const cut = clean.slice(0, EXCERPT_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (
    (lastSpace > EXCERPT_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:-]+$/, '') + '…'
  );
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);

/**
 * Turn raw parsed fields into the stored shape. Returns null if required fields are missing.
 * `sitemapEntry` supplies a fallback image when the page has none.
 */
export function normalizeArticle(
  raw: RawArticle,
  sourceUrl: string,
  sitemapEntry?: SitemapUrl,
): ScrapedArticle | null {
  if (!raw.title || !raw.publishedAt) return null;
  const title = decodeEntities(raw.title).trim();
  const excerpt = makeExcerpt(raw.description);
  const imageUrl =
    config.imageMode === 'placeholder' ? null : (raw.imageUrl ?? sitemapEntry?.imageUrl ?? null);
  const imageAlt = raw.imageAlt ?? sitemapEntry?.imageCaption ?? null;

  const urlPath = new URL(sourceUrl).pathname.split('/').filter(Boolean);
  const sourceSlug = urlPath[urlPath.length - 1] ?? slugify(title);
  const categoryName =
    raw.categoryName ?? (raw.sectionSlug ? titleCase(raw.sectionSlug.replace(/-/g, ' ')) : 'News');
  const modified = raw.modifiedAt ? new Date(raw.modifiedAt) : null;

  const candidate = {
    title,
    excerpt,
    imageUrl,
    imageAlt: imageAlt ? decodeEntities(imageAlt).slice(0, 300) : null,
    category: { name: categoryName, slug: slugify(categoryName) },
    authorName: raw.authorName,
    publishedAt: new Date(raw.publishedAt),
    sourceModifiedAt: modified && !isNaN(modified.getTime()) ? modified : null,
    sourceUrl,
    sourceSlug,
    slug: slugify(title) || sourceSlug,
    // Hash of the fields that matter for change detection (PLAN.md section 4).
    sourceHash: sha([title, excerpt, imageUrl ?? '', raw.modifiedAt ?? ''].join('\n')),
  };
  const parsed = scrapedArticleSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
