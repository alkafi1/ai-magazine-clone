import { logger } from '../lib/logger.js';
import { AdminUser } from '../models/index.js';

/**
 * Startup safeguard for databases created before RBAC: if nobody is a super admin, promote the
 * oldest active account that has the legacy `admin` role, so the owner is never locked out.
 */
export async function ensureSuperAdmin(): Promise<void> {
  if (await AdminUser.exists({ role: 'super_admin', active: true })) return;
  const oldest = await AdminUser.findOne({ role: 'admin', active: true }).sort({
    createdAt: 1,
    _id: 1,
  });
  if (!oldest) return;
  oldest.role = 'super_admin';
  oldest.tokenVersion += 1;
  await oldest.save();
  logger.warn({ email: oldest.email }, 'no super admin existed: promoted the oldest admin');
}
