import { config } from '../config/index.js';
import { clearCache } from '../http/middleware/cache.js';
import { logger } from '../lib/logger.js';
import { runScrape, type RunOptions, type RunSummary } from '../scraper/pipeline.js';
import { sendAlert } from './alert.js';
import { acquireLock, releaseLock } from './lock.js';
import { revalidateWeb } from './revalidate.js';

const LOCK_NAME = 'scrape';
/** Lock expires on its own if a process dies mid-run. */
const LOCK_TTL_MS = 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ExecuteResult =
  { started: false; reason: 'locked' } | { started: true; summary: RunSummary; attempts: number };

/**
 * One scheduled/manual run: take the lock (skip if a run is already going), scrape with retries,
 * revalidate the site, alert on failure, release the lock.
 */
export async function executeRun(
  opts: Pick<RunOptions, 'trigger' | 'limit' | 'since' | 'signal'>,
): Promise<ExecuteResult> {
  const owner = await acquireLock(LOCK_NAME, LOCK_TTL_MS);
  if (!owner) {
    logger.warn({ trigger: opts.trigger }, 'scrape already running, skipping');
    return { started: false, reason: 'locked' };
  }
  try {
    const maxAttempts = config.scheduler.retries + 1;
    let attempt = 1;
    let summary = await runScrape({ limit: config.scheduler.runLimit, ...opts });
    // Only a hard failure is retried: not a block (stay polite), not a shutdown.
    while (
      summary.status === 'failed' &&
      !summary.aborted &&
      !opts.signal?.aborted &&
      attempt < maxAttempts
    ) {
      const wait = config.scheduler.retryDelayMs * 2 ** (attempt - 1);
      logger.warn({ attempt, waitMs: wait }, 'run failed, retrying');
      await sleep(wait);
      attempt++;
      summary = await runScrape({ limit: config.scheduler.runLimit, ...opts });
    }

    if (summary.created + summary.updated > 0) {
      clearCache(); // so the web app re-fetches fresh data, not our cached responses
      await revalidateWeb({ articleSlugs: summary.newSlugs, categorySlugs: summary.categorySlugs });
    }
    if (!summary.aborted && (summary.status === 'failed' || summary.status === 'blocked')) {
      await sendAlert(`Scrape ${summary.status} after ${attempt} attempt(s)`, {
        runId: String(summary.runId),
        failed: summary.failed,
        trigger: opts.trigger,
      });
    }
    return { started: true, summary, attempts: attempt };
  } finally {
    await releaseLock(LOCK_NAME, owner);
  }
}
