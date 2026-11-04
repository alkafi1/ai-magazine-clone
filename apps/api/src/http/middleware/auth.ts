import { timingSafeEqual } from 'node:crypto';
import type { Permission } from '@aimag/shared';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { resolveRole } from '../../db/roles.js';
import { AdminUser } from '../../models/index.js';
import { HttpError } from './error.js';

/** JWT payload. Role is deliberately NOT in the token: it is read from the database on every request. */
type TokenPayload = { sub: string; tv: number };

export type Admin = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleName: string;
  rank: number;
  permissions: Permission[];
};

export const signAdminToken = (user: { id: string; tokenVersion: number }) =>
  jwt.sign({ sub: user.id, tv: user.tokenVersion } satisfies TokenPayload, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '12h',
  });

/**
 * Verifies the token AND that the account still exists, is active and has the same tokenVersion.
 * So disabling a user, changing their role or password takes effect on their very next request.
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    return next(new HttpError(401, 'unauthorized'));
  }
  const user = await AdminUser.findById(payload.sub)
    .lean()
    .catch(() => null);
  if (!user || !user.active || user.tokenVersion !== payload.tv)
    return next(new HttpError(401, 'unauthorized'));
  // Role (and its permissions) is resolved fresh each request: edits to a role apply immediately.
  const role = await resolveRole(user.role);
  if (!role) return next(new HttpError(401, 'unauthorized'));
  (req as Request & { admin?: Admin }).admin = {
    id: String(user._id),
    email: user.email,
    name: user.name ?? '',
    role: role.key,
    roleName: role.name,
    rank: role.rank,
    permissions: role.permissions,
  };
  next();
}

export const adminOf = (req: Request) => (req as Request & { admin?: Admin }).admin!;

/** Route guard: the signed-in admin's role must grant every listed permission. */
export const requirePermission =
  (...permissions: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const { permissions: held } = adminOf(req);
    if (!permissions.every((p) => held.includes(p))) return next(new HttpError(403, 'forbidden'));
    next();
  };

/** True when the request carries the shared secret: it comes from our own web server, not a visitor. */
export function isInternal(req: Request): boolean {
  const a = Buffer.from(req.header('x-internal-secret') ?? '');
  const b = Buffer.from(config.revalidateSecret);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

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
