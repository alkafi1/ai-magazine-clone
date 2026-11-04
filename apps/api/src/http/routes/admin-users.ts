import { ROLES, ROLE_RANK, assignableRoles, canManageRole, isRole, type Role } from '@aimag/shared';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { AdminUser } from '../../models/index.js';
import { audit } from '../audit.js';
import { adminOf, requirePermission } from '../middleware/auth.js';
import { HttpError, parse } from '../middleware/error.js';
import { objectId } from '../validators.js';

const password = z.string().min(12, 'at least 12 characters').max(200);
const roleSchema = z.enum(ROLES);

const view = (u: {
  _id: unknown;
  email: string;
  name?: string | null;
  role: string;
  active: boolean;
  lastLoginAt?: Date | null;
  lockedUntil?: Date | null;
  createdAt?: Date;
}) => ({
  id: String(u._id),
  email: u.email,
  name: u.name ?? '',
  role: u.role,
  active: u.active,
  locked: !!u.lockedUntil && u.lockedUntil > new Date(),
  lastLoginAt: u.lastLoginAt ?? null,
  createdAt: u.createdAt ?? null,
});

/** The last active super admin can never be demoted, disabled or deleted. */
async function wouldRemoveLastSuperAdmin(target: { role: string; active: boolean; _id: unknown }) {
  if (target.role !== 'super_admin' || !target.active) return false;
  return (
    (await AdminUser.countDocuments({
      role: 'super_admin',
      active: true,
      _id: { $ne: target._id },
    })) === 0
  );
}

export function adminUsersRouter() {
  const r = Router();

  r.get('/', requirePermission('users.view'), async (_req, res) => {
    const users = await AdminUser.find().sort({ createdAt: 1, _id: 1 }).lean();
    res.json({ items: users.map(view) });
  });

  r.post('/', requirePermission('users.manage'), async (req, res) => {
    const actor = adminOf(req);
    const body = parse(
      z.object({
        email: z.string().trim().toLowerCase().email().max(254),
        name: z.string().trim().max(100).default(''),
        role: roleSchema,
        password,
      }),
      req.body,
    );
    if (!assignableRoles(actor.role).includes(body.role)) {
      throw new HttpError(403, 'you cannot create an account with that role');
    }
    try {
      const user = await AdminUser.create({
        email: body.email,
        name: body.name,
        role: body.role,
        passwordHash: await bcrypt.hash(body.password, 12),
        passwordChangedAt: new Date(),
        createdBy: actor.id,
      });
      await audit(req, 'user.create', body.email, { role: body.role });
      res.status(201).json(view(user));
    } catch (err) {
      if ((err as { code?: number }).code === 11000)
        throw new HttpError(409, 'an account with that email exists');
      throw err;
    }
  });

  r.patch('/:id', requirePermission('users.manage'), async (req, res) => {
    const actor = adminOf(req);
    const id = parse(objectId, req.params.id);
    const body = parse(
      z
        .object({
          name: z.string().trim().max(100),
          role: roleSchema,
          active: z.boolean(),
          unlock: z.literal(true),
        })
        .partial()
        .strict(),
      req.body,
    );
    const target = await AdminUser.findById(id);
    if (!target) throw new HttpError(404, 'not found');
    if (String(target._id) === actor.id && (body.role !== undefined || body.active !== undefined)) {
      throw new HttpError(400, 'you cannot change your own role or disable yourself');
    }
    if (!isRole(target.role) || !canManageRole(actor.role, target.role)) {
      throw new HttpError(403, 'you cannot manage this account');
    }
    if (body.role !== undefined && !assignableRoles(actor.role).includes(body.role)) {
      throw new HttpError(403, 'you cannot assign that role');
    }
    const demoting = body.role !== undefined && body.role !== 'super_admin';
    const disabling = body.active === false;
    if ((demoting || disabling) && (await wouldRemoveLastSuperAdmin(target))) {
      throw new HttpError(400, 'there must always be at least one active super admin');
    }

    const changes: Record<string, unknown> = {};
    if (body.name !== undefined) target.name = body.name;
    if (body.role !== undefined && body.role !== target.role) {
      changes.role = { from: target.role, to: body.role };
      target.role = body.role;
      target.tokenVersion += 1; // their sessions pick up the new role immediately
    }
    if (body.active !== undefined && body.active !== target.active) {
      changes.active = body.active;
      target.active = body.active;
      target.tokenVersion += 1;
    }
    if (body.unlock) {
      target.failedLogins = 0;
      target.lockedUntil = undefined;
      changes.unlocked = true;
    }
    await target.save();
    await audit(req, 'user.update', target.email, changes);
    res.json(view(target));
  });

  r.post('/:id/reset-password', requirePermission('users.manage'), async (req, res) => {
    const actor = adminOf(req);
    const id = parse(objectId, req.params.id);
    const body = parse(z.object({ password }), req.body);
    const target = await AdminUser.findById(id);
    if (!target) throw new HttpError(404, 'not found');
    if (String(target._id) === actor.id)
      throw new HttpError(400, 'change your own password from My account');
    if (!isRole(target.role) || !canManageRole(actor.role, target.role)) {
      throw new HttpError(403, 'you cannot manage this account');
    }
    target.passwordHash = await bcrypt.hash(body.password, 12);
    target.passwordChangedAt = new Date();
    target.tokenVersion += 1; // signs them out everywhere
    target.failedLogins = 0;
    target.lockedUntil = undefined;
    await target.save();
    await audit(req, 'user.reset_password', target.email);
    res.json({ ok: true });
  });

  r.delete('/:id', requirePermission('users.manage'), async (req, res) => {
    const actor = adminOf(req);
    const id = parse(objectId, req.params.id);
    const target = await AdminUser.findById(id);
    if (!target) throw new HttpError(404, 'not found');
    if (String(target._id) === actor.id)
      throw new HttpError(400, 'you cannot delete your own account');
    if (!isRole(target.role) || !canManageRole(actor.role, target.role)) {
      throw new HttpError(403, 'you cannot manage this account');
    }
    if (await wouldRemoveLastSuperAdmin(target)) {
      throw new HttpError(400, 'there must always be at least one active super admin');
    }
    await target.deleteOne();
    await audit(req, 'user.delete', target.email, {
      role: target.role as Role,
      rank: ROLE_RANK[target.role as Role],
    });
    res.status(204).end();
  });

  return r;
}
