import type { ScrapedArticle } from '@aimag/shared';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { PoliteFetcher } from './fetcher.js';
import { normalizeArticle } from './normalizer.js';
import { parseArticleHtml } from './parser.js';
import {
  parseArticleSitemap,
  parseSitemapIndex,
  pickArticleSitemaps,
  type SitemapUrl,
} from './sitemap.js';

/** Stage names match ScrapeError.stage. */
export class StageError extends Error {
  constructor(
    readonly stage: 'parse' | 'normalize',
    message: string,
  ) {
    super(message);
  }
}

export async function createFetcher(): Promise<PoliteFetcher> {
  const fetcher = new PoliteFetcher();
  await fetcher.loadRobots();
  return fetcher;
}

/** True if the URL's first path segment is one of the configured article sections. */
export function inConfiguredSection(url: string): boolean {
  const first = new URL(url).pathname.split('/').filter(Boolean)[0];
  return !!first && config.scraper.sections.includes(first);
}

/**
 * List article entries from monthly sitemaps.
 * `months`: newest N sitemaps. `since` ('YYYY-MM'): every monthly sitemap from that month on.
 */
export async function discoverEntries(
  fetcher: PoliteFetcher,
  opts: { months?: number; since?: string },
): Promise<SitemapUrl[]> {
  const index = parseSitemapIndex(await fetcher.get(`${config.scraper.baseUrl}/sitemap.xml`));
  let monthly = pickArticleSitemaps(index, opts.since ? 1000 : (opts.months ?? 2));
  if (opts.since) {
    const [y, m] = opts.since.split('-').map(Number) as [number, number];
    monthly = monthly.filter((u) => {
      const match = u.match(/sitemap-articles-(\d{1,2})-(\d{4})\.xml$/)!;
      return Number(match[2]) * 100 + Number(match[1]) >= y * 100 + m;
    });
    monthly.reverse(); // oldest first for backfill
  }
  logger.info({ monthly }, 'article sitemaps selected');

  const entries: SitemapUrl[] = [];
  for (const url of monthly) entries.push(...parseArticleSitemap(await fetcher.get(url)));
  return entries.filter((e) => inConfiguredSection(e.loc) && fetcher.isAllowed(e.loc));
}

/** Fetch one article page and return its normalized shape. Throws StageError on bad data. */
export async function fetchArticle(
  fetcher: PoliteFetcher,
  entry: SitemapUrl,
): Promise<{ article: ScrapedArticle; via: string }> {
  const html = await fetcher.get(entry.loc);
  const raw = parseArticleHtml(html);
  if (!raw) throw new StageError('parse', 'no usable title/date in any layer');
  const article = normalizeArticle(raw, entry.loc, entry);
  if (!article) throw new StageError('normalize', 'normalized article failed validation');
  return { article, via: raw.source };
}
