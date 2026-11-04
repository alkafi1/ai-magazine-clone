import bcrypt from 'bcryptjs';
import mongoose, { type Types } from 'mongoose';
import { AdminUser, Article, Author, Category } from '../models/index.js';
import { connectDb, disconnectDb } from './connection.js';

/**
 * Deterministic data for the Playwright suite. Wipes the target database first, so it refuses to
 * run against anything that is not clearly a test database.
 */
const uri = process.env.MONGODB_URI ?? '';
if (!/aimag_e2e/.test(uri))
  throw new Error('seed-e2e only runs against a database named aimag_e2e');

await connectDb(uri);
await mongoose.connection.dropDatabase();
await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

const [robotics, strategy, apps] = await Category.create([
  {
    name: 'Robotics',
    slug: 'robotics',
    order: 1,
    description: 'Robots, humanoids and physical AI.',
  },
  { name: 'AI Strategy', slug: 'ai-strategy', order: 2 },
  { name: 'AI Applications', slug: 'ai-applications', order: 3 },
]);
const [ada, grace] = await Author.create([
  { name: 'Ada Example', slug: 'ada-example' },
  { name: 'Grace Sample', slug: 'grace-sample' },
]);

const hour = 3600_000;
const make = (
  slug: string,
  title: string,
  category: Types.ObjectId,
  author: Types.ObjectId,
  hoursAgo: number,
  over = {},
) => ({
  title,
  slug,
  excerpt: `Summary of ${title}. Short excerpt only, never the full text.`,
  category,
  author,
  sourceUrl: `https://aimagazine.com/news/${slug}`,
  sourceSlug: slug,
  sourceHash: `hash-${slug}`,
  publishedAt: new Date(Date.now() - hoursAgo * hour),
  ...over,
});

await Article.create([
  // 14 robotics stories -> two pages at 12 per page
  ...Array.from({ length: 14 }, (_, i) =>
    make(
      `robot-story-${i + 1}`,
      `Robot story number ${i + 1}`,
      robotics!._id,
      i % 2 ? ada!._id : grace!._id,
      i + 1,
    ),
  ),
  make('strategy-sovereign-ai', 'Sovereign AI strategy for nations', strategy!._id, ada!._id, 2, {
    isFeatured: true,
    viewCount: 40,
  }),
  make('apps-drug-discovery', 'Drug discovery with predictive models', apps!._id, grace!._id, 3, {
    viewCount: 10,
  }),
  make('hidden-story', 'This story was taken down', apps!._id, ada!._id, 4, {
    isHidden: true,
    status: 'hidden',
  }),
]);

const passwordHash = await bcrypt.hash('e2e-password-12345', 10);
await AdminUser.create(
  (['super_admin', 'editor', 'moderator', 'ad_manager', 'viewer'] as const).map((role) => ({
    email: role === 'super_admin' ? 'admin@e2e.test' : `${role}@e2e.test`,
    name: role.replace('_', ' '),
    role,
    passwordHash,
  })),
);
await AdminUser.create({ email: 'lockme@e2e.test', role: 'viewer', passwordHash }); // used by the lockout test
console.log('e2e data seeded');
await disconnectDb();
