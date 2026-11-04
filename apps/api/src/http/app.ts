import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { errorHandler, notFound } from './middleware/error.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';

export type AppOptions = { loginMax?: number; newsletterMax?: number; globalMax?: number };

export function createApp(opts: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Behind Nginx (and the Next server, which forwards the visitor's IP): trust that many proxy hops so
  // rate limits see the real client IP. Only safe when the API is not directly reachable by clients.
  if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);

  // CORP cross-origin: the web app (another origin) sends view beacons to this API.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, cb) {
        // No Origin header = server-to-server or curl; browsers must be on the allowlist.
        cb(null, !origin || config.corsOrigins.includes(origin));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '50kb' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: opts.globalMax ?? 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/admin', adminRouter({ loginMax: opts.loginMax ?? 10 }));
  app.use('/api', publicRouter({ newsletterMax: opts.newsletterMax ?? 5 }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
