import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { executeRun } from './runner.js';

let task: ScheduledTask | undefined;
let inFlight: Promise<unknown> | undefined;
const shutdown = new AbortController();

export function startScheduler(): void {
  if (!config.scheduler.enabled) {
    logger.info('scheduler disabled (SCHEDULER_ENABLED=false)');
    return;
  }
  task = cron.schedule(config.scheduler.cron, () => {
    inFlight = executeRun({ trigger: 'cron', signal: shutdown.signal })
      .catch((err) => logger.error({ err }, 'scheduled run crashed'))
      .finally(() => (inFlight = undefined));
  });
  logger.info({ cron: config.scheduler.cron }, 'scheduler started');
}

/** Stop scheduling, tell a running scrape to stop after its current page, and wait for it. */
export async function stopScheduler(): Promise<void> {
  task?.stop();
  shutdown.abort();
  await inFlight;
}
