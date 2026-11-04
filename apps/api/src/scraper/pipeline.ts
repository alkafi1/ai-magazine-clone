import type { Types } from 'mongoose';
import { upsertArticle } from '../db/articles.js';
import { logger } from '../lib/logger.js';
import { Article, ScrapeError, ScrapeRun } from '../models/index.js';
import { BlockedError, FetchError } from './fetcher.js';
import { createFetcher, discoverEntries, fetchArticle, StageError } from './run.js';

export type RunOptions = {
  trigger: 'cron' | 'manual' | 'cli' | 'backfill';
  /** Max new articles to fetch this run. */
  limit?: number;
  /** 'YYYY-MM': backfill every monthly sitemap from this month. */
  since?: string;
  /** Stop fetching (after the current page) when aborted, e.g. on shutdown. */
  signal?: AbortSignal;
};

export type RunSummary = {
  runId: Types.ObjectId;
  status: 'success' | 'partial' | 'failed' | 'blocked';
  urlsFound: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  newSlugs: string[];
  categorySlugs: string[];
  aborted: boolean;
};

/**
 * Full scrape: discover URLs, skip ones we already hold, fetch + upsert the rest,
 * and record everything in ScrapeRun / ScrapeError.
 */
export async function runScrape(opts: RunOptions): Promise<RunSummary> {
  const run = await ScrapeRun.create({ trigger: opts.trigger });
  const t0 = Date.now();
  const s: RunSummary = {
    runId: run._id,
    status: 'success',
    urlsFound: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    newSlugs: [],
    categorySlugs: [],
    aborted: false,
  };
  const logError = (e: {
    url?: string;
    stage: 'discover' | 'fetch' | 'parse' | 'normalize' | 'save';
    message: string;
    httpStatus?: number;
  }) => ScrapeError.create({ run: run._id, ...e });

  try {
    const fetcher = await createFetcher();
    const entries = await discoverEntries(
      fetcher,
      opts.since ? { since: opts.since } : { months: 2 },
    );
    s.urlsFound = entries.length;

    const known = new Set(
      (
        await Article.find({ sourceUrl: { $in: entries.map((e) => e.loc) } }, 'sourceUrl').lean()
      ).map((a) => a.sourceUrl),
    );
    s.skipped = known.size;
    const fresh = entries.filter((e) => !known.has(e.loc));
    // Newest sitemap entries are listed last-month-first by pickArticleSitemaps; cap the fetch count.
    const todo = opts.limit ? fresh.slice(0, opts.limit) : fresh;
    logger.info(
      { found: entries.length, known: known.size, toFetch: todo.length },
      'discovery done',
    );

    for (const entry of todo) {
      if (opts.signal?.aborted) {
        logger.warn('scrape aborted, stopping early');
        s.aborted = true;
        break;
      }
      try {
        const { article } = await fetchArticle(fetcher, entry);
        const outcome = await upsertArticle(article, run._id);
        if (outcome === 'created') {
          s.created++;
          s.newSlugs.push(article.slug);
          s.categorySlugs.push(article.category.slug);
        } else if (outcome === 'updated') s.updated++;
        else s.skipped++;
      } catch (err) {
        s.failed++;
        const message = err instanceof Error ? err.message : String(err);
        await logError({
          url: entry.loc,
          stage:
            err instanceof StageError ? err.stage : err instanceof FetchError ? 'fetch' : 'save',
          message,
          httpStatus: err instanceof FetchError ? err.status : undefined,
        });
        logger.warn({ url: entry.loc, message }, 'article failed');
        if (err instanceof BlockedError) {
          s.status = 'blocked';
          break;
        }
      }
    }
    if (s.status === 'success' && (s.failed > 0 || s.aborted))
      s.status = s.created + s.updated > 0 ? 'partial' : 'failed';
  } catch (err) {
    s.status = err instanceof BlockedError ? 'blocked' : 'failed';
    await logError({
      stage: 'discover',
      message: err instanceof Error ? err.message : String(err),
    });
    logger.error({ err }, 'scrape run failed');
  }

  await ScrapeRun.updateOne(
    { _id: run._id },
    {
      finishedAt: new Date(),
      durationMs: Date.now() - t0,
      status: s.status,
      urlsFound: s.urlsFound,
      created: s.created,
      updated: s.updated,
      skipped: s.skipped,
      failed: s.failed,
    },
  );
  s.categorySlugs = [...new Set(s.categorySlugs)];
  logger.info({ ...s, runId: String(s.runId) }, 'scrape run finished');
  return s;
}
