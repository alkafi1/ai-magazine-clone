import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { HttpError } from './error.js';

export type AdminToken = { sub: string; email: string; role: 'admin' | 'editor' };

export const signAdminToken = (t: AdminToken) =>
  jwt.sign(t, config.jwtSecret, { algorithm: 'HS256', expiresIn: '12h' });

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as AdminToken;
    (req as Request & { admin?: AdminToken }).admin = payload;
    next();
  } catch {
    next(new HttpError(401, 'unauthorized'));
  }
}

export const adminOf = (req: Request) => (req as Request & { admin?: AdminToken }).admin!;

/** Shared-secret guard for server-to-server calls (e.g. revalidate). */
export function requireSecret(header: string, secret: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const a = Buffer.from(req.header(header) ?? '');
    const b = Buffer.from(secret);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      return next(new HttpError(401, 'unauthorized'));
    next();
  };
}
