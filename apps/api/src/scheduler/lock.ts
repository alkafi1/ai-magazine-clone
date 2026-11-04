import { randomUUID } from 'node:crypto';
import { SiteSetting } from '../models/index.js';

/**
 * Cross-process lock stored in MongoDB. The unique index on SiteSetting.key makes the
 * upsert atomic: if another owner holds an unexpired lock, the upsert hits a duplicate key.
 */
export async function acquireLock(name: string, ttlMs: number): Promise<string | null> {
  const key = `lock:${name}`;
  const owner = randomUUID();
  const now = new Date();
  try {
    await SiteSetting.findOneAndUpdate(
      { key, $or: [{ 'value.until': { $lt: now } }, { 'value.until': { $exists: false } }] },
      { $set: { value: { owner, until: new Date(now.getTime() + ttlMs) } } },
      { upsert: true },
    );
    return owner;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return null;
    throw err;
  }
}

export async function releaseLock(name: string, owner: string): Promise<void> {
  await SiteSetting.deleteOne({ key: `lock:${name}`, 'value.owner': owner });
}
