import { logger } from '../lib/logger.js';
import { clearCache } from '../http/middleware/cache.js';
import { Article } from '../models/index.js';
import { revalidateWeb } from './revalidate.js';

/** Turn scheduled articles whose time has come into published ones, then refresh the public site. */
export async function publishDue(now = new Date()): Promise<number> {
  const due = await Article.find(
    { kind: 'original', status: 'scheduled', publishedAt: { $lte: now } },
    'slug category',
  )
    .populate('category', 'slug')
    .lean();
  if (due.length === 0) return 0;
  await Article.updateMany(
    { _id: { $in: due.map((a) => a._id) } },
    { $set: { status: 'published' } },
  );
  clearCache();
  void revalidateWeb({
    articleSlugs: due.map((a) => a.slug),
    categorySlugs: due
      .map((a) => (a.category as unknown as { slug?: string })?.slug)
      .filter((s): s is string => !!s),
  });
  logger.info({ count: due.length }, 'published scheduled articles');
  return due.length;
}

let timer: NodeJS.Timeout | undefined;
export function startPublisher(everyMs = 60_000) {
  timer = setInterval(
    () => void publishDue().catch((err) => logger.error({ err }, 'publisher failed')),
    everyMs,
  );
  timer.unref();
}
export const stopPublisher = () => timer && clearInterval(timer);
