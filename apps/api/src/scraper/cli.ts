import { parseArgs } from 'node:util';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import { scrapeOnce } from './once.js';

const { values } = parseArgs({
  options: { limit: { type: 'string', default: '20' }, json: { type: 'boolean', default: false } },
});
const args = z
  .object({ limit: z.coerce.number().int().min(1).max(500), json: z.boolean() })
  .parse(values);

const started = Date.now();
const result = await scrapeOnce({ limit: args.limit });

if (args.json) {
  console.log(JSON.stringify(result.articles, null, 2));
} else {
  for (const a of result.articles) {
    console.log(`\n${a.title}`);
    console.log(
      `  ${a.category.name} | ${a.authorName ?? 'unknown author'} | ${a.publishedAt.toISOString()}`,
    );
    console.log(`  ${a.excerpt}`);
    console.log(`  img: ${a.imageUrl ?? 'none'}`);
    console.log(`  ${a.sourceUrl}`);
  }
}
logger.info(
  {
    urlsFound: result.urlsFound,
    parsed: result.articles.length,
    failed: result.failed,
    stoppedEarly: result.stoppedEarly,
    seconds: Math.round((Date.now() - started) / 1000),
  },
  'scrape finished',
);
process.exit(result.stoppedEarly ? 2 : 0);
