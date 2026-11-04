import type { ZodType } from 'zod';
import { SiteSetting } from '../models/index.js';

/** Read a settings document, falling back to defaults for anything missing or invalid. */
export async function readSettings<T>(
  key: string,
  schema: ZodType<T>,
  defaults: () => T,
): Promise<T> {
  const doc = await SiteSetting.findOne({ key: `settings:${key}` }).lean();
  const base = defaults();
  if (!doc?.value) return base;
  // Merge one level deep so newly added fields get defaults without losing saved values.
  const merged = Object.fromEntries(
    Object.entries(base as Record<string, unknown>).map(([k, v]) => {
      const saved = (doc.value as Record<string, unknown>)[k];
      return [
        k,
        v && typeof v === 'object' && !Array.isArray(v)
          ? { ...v, ...(saved as object) }
          : (saved ?? v),
      ];
    }),
  );
  const parsed = schema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

export async function writeSettings<T>(key: string, value: T): Promise<void> {
  await SiteSetting.updateOne({ key: `settings:${key}` }, { $set: { value } }, { upsert: true });
}
