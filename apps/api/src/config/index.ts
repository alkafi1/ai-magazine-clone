import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/aimag'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3100'),
  JWT_SECRET: z.string().default('dev-only-secret'),
  REVALIDATE_SECRET: z.string().default('dev-only-secret'),
  WEB_URL: z.string().default('http://localhost:3100'),
  SCRAPER_BASE_URL: z.string().url().default('https://aimagazine.com'),
  SCRAPER_CONTACT_EMAIL: z.string().email().default('you@example.com'),
  SCRAPER_DELAY_MS: z.coerce.number().min(1500).max(2000).default(1750),
  SCRAPER_MAX_RETRIES: z.coerce.number().min(0).max(6).default(3),
  SCRAPER_SECTIONS: z.string().default('news,articles'),
  SCHEDULER_ENABLED: z.enum(['true', 'false']).default('true'),
  SCHEDULER_CRON: z.string().default('0 */6 * * *'),
  SCHEDULER_RETRIES: z.coerce.number().min(0).max(5).default(2),
  SCHEDULER_RETRY_DELAY_MS: z.coerce.number().min(0).default(60_000),
  SCHEDULER_RUN_LIMIT: z.coerce.number().int().min(1).default(100),
  ALERT_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  IMAGE_MODE: z.enum(['hotlink', 'placeholder']).default('hotlink'),
});

const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev-only-secret') {
  throw new Error('JWT_SECRET must be set in production');
}

export const config = {
  env: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  mongoUri: env.MONGODB_URI,
  redisUrl: env.REDIS_URL,
  port: env.API_PORT,
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
  jwtSecret: env.JWT_SECRET,
  revalidateSecret: env.REVALIDATE_SECRET,
  webUrl: env.WEB_URL,
  scraper: {
    baseUrl: env.SCRAPER_BASE_URL.replace(/\/$/, ''),
    contactEmail: env.SCRAPER_CONTACT_EMAIL,
    delayMs: env.SCRAPER_DELAY_MS,
    maxRetries: env.SCRAPER_MAX_RETRIES,
    sections: env.SCRAPER_SECTIONS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    userAgent: `AIMagBot/1.0 (+${env.WEB_URL}/about; contact: ${env.SCRAPER_CONTACT_EMAIL})`,
  },
  scheduler: {
    enabled: env.SCHEDULER_ENABLED === 'true',
    cron: env.SCHEDULER_CRON,
    retries: env.SCHEDULER_RETRIES,
    retryDelayMs: env.SCHEDULER_RETRY_DELAY_MS,
    runLimit: env.SCHEDULER_RUN_LIMIT,
  },
  alertWebhookUrl: env.ALERT_WEBHOOK_URL || undefined,
  imageMode: env.IMAGE_MODE,
};
