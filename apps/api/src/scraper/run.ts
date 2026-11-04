import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';
import { BlockedError, DisallowedError, PoliteFetcher } from './fetcher.js';
import { normalizeArticle } from './normalizer.js';
import { parseArticleHtml } from './parser.js';
import {
  parseArticleSitemap,
  parseSitemapIndex,
  pickArticleSitemaps,
  type SitemapUrl,
} from './sitemap.js';
import type { ScrapedArticle } from '@aimag/shared';

export type ScrapeResult = {
  urlsFound: number;
  articles: ScrapedArticle[];
  skipped: { url: string; reason: string }[];
  failed: { url: string; stage: string; message: string; httpStatus?: number }[];
  stoppedEarly: string | null;
};

/** Discover URLs from the newest monthly sitemaps, then fetch and parse up to `limit` pages. */
export async function scrapeOnce(opts: { limit: number; months?: number }): Promise<ScrapeResult> {
  const fetcher = new PoliteFetcher();
  const result: ScrapeResult = {
    urlsFound: 0,
    articles: [],
    skipped: [],
    failed: [],
    stoppedEarly: null,
  };

  await fetcher.loadRobots();
  const index = parseSitemapIndex(await fetcher.get(`${config.scraper.baseUrl}/sitemap.xml`));
  const monthly = pickArticleSitemaps(index, opts.months ?? 2);
  logger.info({ monthly }, 'article sitemaps selected');

  const entries: SitemapUrl[] = [];
  for (const url of monthly) entries.push(...parseArticleSitemap(await fetcher.get(url)));
  result.urlsFound = entries.length;

  for (const entry of entries) {
    if (result.articles.length >= opts.limit) break;
    if (!fetcher.isAllowed(entry.loc)) {
      result.skipped.push({ url: entry.loc, reason: 'robots' });
      continue;
    }
    try {
      const html = await fetcher.get(entry.loc);
      const raw = parseArticleHtml(html);
      const article = raw && normalizeArticle(raw, entry.loc, entry);
      if (!article) {
        result.failed.push({ url: entry.loc, stage: 'parse', message: 'missing title or date' });
        continue;
      }
      result.articles.push(article);
      logger.info({ url: entry.loc, via: raw.source }, 'article parsed');
    } catch (err) {
      if (err instanceof DisallowedError) {
        result.skipped.push({ url: entry.loc, reason: 'robots' });
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({ url: entry.loc, stage: 'fetch', message });
      if (err instanceof BlockedError) {
        result.stoppedEarly = message;
        break;
      }
    }
  }
  return result;
}
