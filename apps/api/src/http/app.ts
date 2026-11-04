import { timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { executeRun } from '../scheduler/runner.js';

function secretsMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Temporary guard for internal endpoints; Phase 4 adds JWT admin auth on top. */
function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const given = req.header('x-internal-secret') ?? '';
  if (!secretsMatch(given, config.revalidateSecret)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Manual trigger: starts a run in the background and returns immediately.
  app.post('/api/internal/scrape-runs', requireInternalSecret, (_req, res) => {
    void executeRun({ trigger: 'manual' }).catch((err) =>
      logger.error({ err }, 'manual run crashed'),
    );
    res.status(202).json({ accepted: true });
  });

  app.use((_req, res) => res.status(404).json({ error: 'not found' }));
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'unhandled error');
    res.status(500).json({ error: 'internal error' });
  });
  return app;
}
