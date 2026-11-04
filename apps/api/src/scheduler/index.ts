import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { executeRun } from './runner.js';

let task: ScheduledTask | undefined;
const inFlight = new Set<Promise<unknown>>();
const shutdown = new AbortController();

/**
 * Start a run in the background (cron or admin button). Every run shares the shutdown signal and is
 * tracked, so stopScheduler() can let it finish its current page and record its result.
 */
export function startRun(trigger: 'cron' | 'manual'): void {
  const p: Promise<unknown> = executeRun({ trigger, signal: shutdown.signal })
    .catch((err) => logger.error({ err, trigger }, 'scrape run crashed'))
    .finally(() => inFlight.delete(p));
  inFlight.add(p);
}

export function startScheduler(): void {
  if (!config.scheduler.enabled) {
    logger.info('scheduler disabled (SCHEDULER_ENABLED=false)');
    return;
  }
  task = cron.schedule(config.scheduler.cron, () => startRun('cron'));
  logger.info({ cron: config.scheduler.cron }, 'scheduler started');
}

/** Stop scheduling, tell running scrapes to stop after their current page, and wait for them. */
export async function stopScheduler(): Promise<void> {
  task?.stop();
  shutdown.abort();
  await Promise.all(inFlight);
}
