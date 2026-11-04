import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AdminUser } from '../models/index.js';
import { connectDb, disconnectDb } from './connection.js';

/** Usage: pnpm --filter @aimag/api create-admin <email> <password> */
const [email, password] = process.argv.slice(2);
const args = z
  .object({ email: z.string().email(), password: z.string().min(12, 'use at least 12 characters') })
  .parse({ email, password });

await connectDb();
await AdminUser.updateOne(
  { email: args.email.toLowerCase() },
  { $set: { passwordHash: await bcrypt.hash(args.password, 12), role: 'admin' } },
  { upsert: true },
);
console.log(`admin ready: ${args.email}`);
await disconnectDb();
