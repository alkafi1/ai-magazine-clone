import { parseArgs } from 'node:util';
import { z } from 'zod';
import { connectDb, disconnectDb } from '../db/connection.js';
import { seedCategories } from '../db/seed.js';
import { runScrape } from './pipeline.js';

const { values } = parseArgs({
  options: {
    limit: { type: 'string' },
    since: { type: 'string' },
    trigger: { type: 'string', default: 'cli' },
    refresh: { type: 'boolean', default: false },
  },
});
const args = z
  .object({
    limit: z.coerce.number().int().min(1).optional(),
    since: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'use YYYY-MM')
      .optional(),
    trigger: z.enum(['cli', 'manual']),
    refresh: z.boolean(),
  })
  .parse(values);

await connectDb();
await seedCategories();
const summary = await runScrape({
  trigger: args.since ? 'backfill' : args.trigger,
  limit: args.limit,
  since: args.since,
  refresh: args.refresh,
});
await disconnectDb();
process.exit(summary.status === 'blocked' || summary.status === 'failed' ? 2 : 0);
