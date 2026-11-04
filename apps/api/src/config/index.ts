import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/aimag'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().default('dev-only-secret'),
  REVALIDATE_SECRET: z.string().default('dev-only-secret'),
  WEB_URL: z.string().default('http://localhost:3000'),
  SCRAPER_BASE_URL: z.string().url().default('https://aimagazine.com'),
  SCRAPER_CONTACT_EMAIL: z.string().email().default('you@example.com'),
  SCRAPER_DELAY_MS: z.coerce.number().min(1500).max(2000).default(1750),
  SCRAPER_MAX_RETRIES: z.coerce.number().min(0).max(6).default(3),
  SCRAPER_SECTIONS: z.string().default('news,articles'),
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
  imageMode: env.IMAGE_MODE,
};
