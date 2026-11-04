import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import * as models from '../models/index.js';

/**
 * Indexes whose definition changed in a later version cannot be rebuilt in place by Mongoose
 * (IndexOptionsConflict). Drop the old ones first; init() below recreates them with the new options.
 */
async function migrateIndexes() {
  const existing = await models.Article.collection.indexes().catch(() => []);
  for (const idx of existing) {
    const oldSourceUrl = idx.name === 'sourceUrl_1' && !idx.partialFilterExpression;
    const oldText = idx.name === 'title_text_excerpt_text';
    if (oldSourceUrl || oldText) {
      await models.Article.collection.dropIndex(idx.name!);
      logger.warn(
        { index: idx.name },
        'dropped outdated index; it is recreated with the new definition',
      );
    }
  }
}

export async function connectDb(uri = config.mongoUri): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  await migrateIndexes();
  // Build declared indexes (unique, text, TTL) up front.
  await Promise.all(Object.values(models).map((m) => m.init()));
  logger.info({ db: mongoose.connection.name }, 'mongo connected');
}

export const disconnectDb = () => mongoose.disconnect();
