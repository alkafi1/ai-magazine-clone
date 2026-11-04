import type { ScrapedArticle } from '@aimag/shared';
import { logger } from '../lib/logger.js';
import { BlockedError } from './fetcher.js';
import { createFetcher, discoverEntries, fetchArticle } from './run.js';

export type OnceResult = {
  urlsFound: number;
  articles: ScrapedArticle[];
  failed: { url: string; message: string }[];
  stoppedEarly: string | null;
};

/** Dry run used by `pnpm scrape:once`: fetch and parse, never touches the database. */
export async function scrapeOnce(opts: { limit: number }): Promise<OnceResult> {
  const fetcher = await createFetcher();
  const { entries, warnings } = await discoverEntries(fetcher, { months: 2 });
  warnings.forEach((w) => logger.warn(w));
  const result: OnceResult = {
    urlsFound: entries.length,
    articles: [],
    failed: [],
    stoppedEarly: null,
  };

  for (const entry of entries) {
    if (result.articles.length >= opts.limit) break;
    try {
      const { article, via } = await fetchArticle(fetcher, entry);
      result.articles.push(article);
      logger.info({ url: entry.loc, via }, 'article parsed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({ url: entry.loc, message });
      if (err instanceof BlockedError) {
        result.stoppedEarly = message;
        break;
      }
    }
  }
  return result;
}
