import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { logger } from '../../lib/logger.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Validate untrusted input with zod; a failure becomes a 400 via the error handler. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'invalid request',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Errors from the body parser (bad JSON, body too large, ...) carry their own 4xx status.
  const e = err as { type?: string; status?: number };
  if (
    typeof e.status === 'number' &&
    e.status >= 400 &&
    e.status < 500 &&
    e.type?.startsWith('entity.')
  ) {
    res
      .status(e.status)
      .json({ error: e.status === 413 ? 'payload too large' : 'invalid request body' });
    return;
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'internal error' });
}
