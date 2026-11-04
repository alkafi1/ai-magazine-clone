import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

/** Ask Next.js to refresh cached pages. Failures are logged, never thrown. */
export async function revalidateWeb(opts: {
  articleSlugs: string[];
  categorySlugs: string[];
}): Promise<boolean> {
  const tags = [
    'home',
    ...opts.categorySlugs.map((s) => `category:${s}`),
    ...opts.articleSlugs.map((s) => `article:${s}`),
  ];
  try {
    await axios.post(
      `${config.webUrl}/api/revalidate`,
      { tags },
      {
        headers: { 'x-revalidate-secret': config.revalidateSecret },
        timeout: 10_000,
        maxRedirects: 0,
      },
    );
    logger.info({ tags: tags.length }, 'web revalidated');
    return true;
  } catch (err) {
    logger.warn({ err: String(err) }, 'web revalidation failed (will refresh via ISR)');
    return false;
  }
}
