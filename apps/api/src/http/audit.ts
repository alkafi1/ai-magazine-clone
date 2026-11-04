import type { Request } from 'express';
import { logger } from '../lib/logger.js';
import { AuditLog } from '../models/index.js';
import { adminOf } from './middleware/auth.js';

/** Records who did what. Never throws: a failing audit write must not break the action itself. */
export async function audit(
  req: Request,
  action: string,
  target?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = adminOf(req);
    await AuditLog.create({
      admin: admin.id,
      actorEmail: admin.email,
      action,
      target,
      meta,
      ip: req.ip,
    });
  } catch (err) {
    logger.error({ err, action }, 'audit write failed');
  }
}

/** For events with no signed-in admin (failed or locked logins). */
export async function auditAnonymous(
  req: Request,
  action: string,
  email: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditLog.create({ actorEmail: email, action, meta, ip: req.ip });
  } catch (err) {
    logger.error({ err, action }, 'audit write failed');
  }
}
