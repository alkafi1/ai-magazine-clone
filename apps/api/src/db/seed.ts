import { Category } from '../models/index.js';
import { slugify } from '../scraper/normalizer.js';

/** Categories seen on the source site; menu order follows this list. */
const SEED = [
  'Artificial Intelligence (AI)',
  'AI Strategy',
  'AI Applications',
  'Robotics',
  'Responsible AI',
  'Start Ups',
  'Technology',
  'People & Skills',
];

export async function seedCategories(): Promise<void> {
  await Promise.all(
    SEED.map((name, i) =>
      Category.updateOne(
        { slug: slugify(name) },
        { $setOnInsert: { name, slug: slugify(name), order: i + 1 } },
        { upsert: true },
      ),
    ),
  );
}
