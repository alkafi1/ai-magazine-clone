import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import * as models from '../models/index.js';

export async function connectDb(uri = config.mongoUri): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  // Build declared indexes (unique, text, TTL) up front.
  await Promise.all(Object.values(models).map((m) => m.init()));
  logger.info({ db: mongoose.connection.name }, 'mongo connected');
}

export const disconnectDb = () => mongoose.disconnect();
