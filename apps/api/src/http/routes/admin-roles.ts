import {
  BUILTIN_ROLE_DEFS,
  PERMISSIONS,
  ROLE_KEY,
  checkRoleGrant,
  outranks,
  roleKeyFromName,
  type Actor,
} from '@aimag/shared';
import { Router } from 'express';
import { z } from 'zod';
import { allRoles } from '../../db/roles.js';
import { AdminUser, Role } from '../../models/index.js';
import { audit } from '../audit.js';
import { adminOf, requirePermission } from '../middleware/auth.js';
import { HttpError, parse } from '../middleware/error.js';

const builtinKeys = new Set(BUILTIN_ROLE_DEFS.map((r) => r.key));

const body = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).default(''),
  permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length),
  rank: z.number().int().min(1),
});

const asActor = (a: ReturnType<typeof adminOf>): Actor => a;

/** Custom roles. Built-in roles are listed here too but can never be changed. */
export function adminRolesRouter() {
  const r = Router();

  r.get('/', requirePermission('users.view'), async (_req, res) => {
    const [roles, counts] = await Promise.all([
      allRoles(),
      AdminUser.aggregate<{ _id: string; n: number }>([
        { $group: { _id: '$role', n: { $sum: 1 } } },
      ]),
    ]);
    const inUse = new Map(counts.map((c) => [c._id, c.n]));
    res.json({ items: roles.map((x) => ({ ...x, users: inUse.get(x.key) ?? 0 })) });
  });

  r.post('/', requirePermission('roles.manage'), async (req, res) => {
    const actor = adminOf(req);
    const data = parse(body, req.body);
    const key = roleKeyFromName(data.name);
    if (!ROLE_KEY.test(key)) throw new HttpError(400, 'the name must contain letters or digits');
    if (builtinKeys.has(key) || (await Role.exists({ key })))
      throw new HttpError(409, 'a role with that name exists');
    const problem = checkRoleGrant(asActor(actor), data);
    if (problem) throw new HttpError(403, problem);
    const role = await Role.create({ ...data, key, createdBy: actor.id });
    await audit(req, 'role.create', key, { permissions: data.permissions.length, rank: data.rank });
    res.status(201).json({ key: role.key });
  });

  r.patch('/:key', requirePermission('roles.manage'), async (req, res) => {
    const actor = adminOf(req);
    const key = req.params.key as string;
    if (builtinKeys.has(key)) throw new HttpError(400, 'built-in roles cannot be changed');
    const existing = await Role.findOne({ key });
    if (!existing) throw new HttpError(404, 'not found');
    if (!outranks(asActor(actor), existing.rank))
      throw new HttpError(403, 'you cannot manage this role');
    const data = parse(body, req.body);
    const problem = checkRoleGrant(asActor(actor), data);
    if (problem) throw new HttpError(403, problem);
    existing.name = data.name;
    existing.description = data.description;
    existing.permissions = data.permissions;
    existing.rank = data.rank;
    await existing.save();
    await audit(req, 'role.update', key, { permissions: data.permissions.length, rank: data.rank });
    res.json({ key });
  });

  r.delete('/:key', requirePermission('roles.manage'), async (req, res) => {
    const actor = adminOf(req);
    const key = req.params.key as string;
    if (builtinKeys.has(key)) throw new HttpError(400, 'built-in roles cannot be deleted');
    const existing = await Role.findOne({ key });
    if (!existing) throw new HttpError(404, 'not found');
    if (!outranks(asActor(actor), existing.rank))
      throw new HttpError(403, 'you cannot manage this role');
    const users = await AdminUser.countDocuments({ role: key });
    if (users > 0)
      throw new HttpError(
        409,
        `${users} account(s) still use this role: move them to another role first`,
      );
    await existing.deleteOne();
    await audit(req, 'role.delete', key);
    res.status(204).end();
  });

  return r;
}
