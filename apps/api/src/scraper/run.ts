import type { ScrapedArticle } from '@aimag/shared';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import * as cheerio from 'cheerio';
import { BlockedError, DisallowedError, FetchError, PoliteFetcher } from './fetcher.js';
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

/** `sitemap-articles-<M>-<YYYY>.xml` URLs for the current month and the `count - 1` before it, newest first. */
export function monthlySitemapUrls(
  now: Date,
  count: number,
  baseUrl = config.scraper.baseUrl,
): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return `${baseUrl}/sitemap-articles-${d.getUTCMonth() + 1}-${d.getUTCFullYear()}.xml`;
  });
}

/** Newest-first sort key of a monthly sitemap URL (YYYYMM), or 0 if it is not one. */
const monthKey = (url: string) => {
  const m = url.match(/sitemap-articles-(\d{1,2})-(\d{4})\.xml$/);
  return m ? Number(m[2]) * 100 + Number(m[1]) : 0;
};

/** Degraded discovery: the newest stories embedded in the homepage's __NEXT_DATA__. */
export function parseHomepageLatest(html: string, baseUrl = config.scraper.baseUrl): SitemapUrl[] {
  const text = cheerio.load(html)('script#__NEXT_DATA__').first().text();
  try {
    const latest = (JSON.parse(text) as { props?: { pageProps?: { latestArticles?: unknown } } })
      .props?.pageProps?.latestArticles;
    if (!Array.isArray(latest)) return [];
    return latest
      .map((a) =>
        typeof a?.fullUrlPath === 'string' && a.fullUrlPath.startsWith('/') ? a.fullUrlPath : null,
      )
      .filter((p): p is string => p !== null)
      .map((p) => ({ loc: `${baseUrl}${p}`, lastmod: null, imageUrl: null, imageCaption: null }));
  } catch {
    return [];
  }
}

export type Discovery = { entries: SitemapUrl[]; warnings: string[] };

/**
 * Find article URLs. Sources, in order:
 *  1. monthly article sitemaps: those listed in the index plus the computed current/previous months
 *     (the index has been seen to omit them, and a not-yet-created month is a normal 404);
 *  2. if that yields nothing, the homepage's embedded latest stories.
 * `months`: newest N months. `since` ('YYYY-MM'): every month from then until now, oldest first.
 */
export async function discoverEntries(
  fetcher: PoliteFetcher,
  opts: { months?: number; since?: string },
  now = new Date(),
): Promise<Discovery> {
  const warnings: string[] = [];
  const base = config.scraper.baseUrl;

  let listed: string[] = [];
  try {
    listed = parseSitemapIndex(await fetcher.get(`${base}/sitemap.xml`));
  } catch (err) {
    if (err instanceof BlockedError || err instanceof DisallowedError) throw err;
    warnings.push(
      `sitemap index unavailable (${err instanceof Error ? err.message : err}); using computed month URLs`,
    );
  }

  let months = opts.months ?? 2;
  let sinceKey = 0;
  if (opts.since) {
    const [y, m] = opts.since.split('-').map(Number) as [number, number];
    sinceKey = y * 100 + m;
    months = (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m) + 1;
  }
  const candidates = [
    ...new Set([
      ...monthlySitemapUrls(now, Math.max(months, 1), base),
      ...pickArticleSitemaps(listed, opts.since ? 1000 : months),
    ]),
  ]
    .filter((u) => monthKey(u) >= sinceKey)
    .sort((a, b) => (opts.since ? monthKey(a) - monthKey(b) : monthKey(b) - monthKey(a)));
  if (!listed.some((u) => monthKey(u) > 0)) {
    warnings.push(
      'sitemap index lists no monthly article sitemaps; relying on computed month URLs',
    );
  }
  logger.info({ candidates }, 'article sitemaps to read');

  const seen = new Set<string>();
  const entries: SitemapUrl[] = [];
  for (const url of candidates) {
    try {
      for (const e of parseArticleSitemap(await fetcher.get(url))) {
        if (!seen.has(e.loc)) {
          seen.add(e.loc);
          entries.push(e);
        }
      }
    } catch (err) {
      if (err instanceof BlockedError) throw err;
      // A missing month (e.g. early in a new month) is normal; anything else is worth a warning.
      if (!(err instanceof FetchError && err.status === 404)) {
        warnings.push(`could not read ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  let usable = entries.filter((e) => inConfiguredSection(e.loc) && fetcher.isAllowed(e.loc));
  if (usable.length === 0) {
    warnings.push(
      'no URLs from sitemaps; fell back to the homepage latest-stories list (only the newest few)',
    );
    try {
      usable = parseHomepageLatest(await fetcher.get(`${base}/`), base).filter(
        (e) => inConfiguredSection(e.loc) && fetcher.isAllowed(e.loc),
      );
    } catch (err) {
      if (err instanceof BlockedError) throw err;
      warnings.push(`homepage fallback failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { entries: usable, warnings };
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
