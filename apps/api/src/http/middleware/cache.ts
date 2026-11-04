import type { NextFunction, Request, Response } from 'express';

type Entry = { body: unknown; status: number; expires: number };
const MAX_ENTRIES = 500;
const store = new Map<string, Entry>();

export const clearCache = () => store.clear();

/**
 * In-memory response cache for public GET routes. Also sets Cache-Control so a CDN/Nginx can cache.
 * (Swap the Map for Redis later if the API runs on several instances.)
 */
export function cached(ttlSeconds: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds * 5}`);
    const key = req.originalUrl;
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      res.status(hit.status).json(hit.body);
      return;
    }
    res.setHeader('X-Cache', 'MISS');
    const json = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200) {
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value!);
        store.set(key, { body, status: 200, expires: Date.now() + ttlSeconds * 1000 });
      } else {
        res.setHeader('Cache-Control', 'no-store');
      }
      return json(body);
    };
    next();
  };
}
