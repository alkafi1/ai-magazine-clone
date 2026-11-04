import { parseArgs } from 'node:util';
import { ROLES } from '@aimag/shared';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AdminUser } from '../models/index.js';
import { connectDb, disconnectDb } from './connection.js';

/**
 * Create or update an admin account (also resets its password and re-enables it).
 *   pnpm --filter @aimag/api create-admin <email> <password> [--role super_admin] [--name "Jane Doe"]
 * The first account should be a super_admin (the default); manage everyone else from the admin panel.
 */
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    role: { type: 'string', default: 'super_admin' },
    name: { type: 'string', default: '' },
  },
});
const args = z
  .object({
    email: z.string().email(),
    password: z.string().min(12, 'use at least 12 characters'),
    role: z.enum(ROLES),
    name: z.string().max(100),
  })
  .parse({ email: positionals[0], password: positionals[1], ...values });

await connectDb();
await AdminUser.updateOne(
  { email: args.email.toLowerCase() },
  {
    $set: {
      passwordHash: await bcrypt.hash(args.password, 12),
      role: args.role,
      name: args.name,
      active: true,
      failedLogins: 0,
      passwordChangedAt: new Date(),
    },
    $unset: { lockedUntil: '' },
    $inc: { tokenVersion: 1 },
  },
  { upsert: true },
);
console.log(`admin ready: ${args.email} (${args.role})`);
await disconnectDb();
