import { config } from './config/index.js';
import { connectDb, disconnectDb } from './db/connection.js';
import { ensureSuperAdmin } from './db/admins.js';
import { seedCategories } from './db/seed.js';
import { createApp } from './http/app.js';
import { logger } from './lib/logger.js';
import { startScheduler, stopScheduler } from './scheduler/index.js';
import { recoverStaleRuns } from './scheduler/runner.js';

await connectDb();
await seedCategories();
await recoverStaleRuns();
await ensureSuperAdmin();
const server = createApp().listen(config.port, () =>
  logger.info({ port: config.port }, 'api listening'),
);
startScheduler();

let closing = false;
async function close(signal: string) {
  if (closing) return;
  closing = true;
  logger.info({ signal }, 'shutting down');
  server.close();
  await stopScheduler();
  await disconnectDb();
  process.exit(0);
}
process.on('SIGINT', () => void close('SIGINT'));
process.on('SIGTERM', () => void close('SIGTERM'));
