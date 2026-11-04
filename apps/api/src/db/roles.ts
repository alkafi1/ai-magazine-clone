import { BUILTIN_ROLE_DEFS, isPermission, type RoleDef } from '@aimag/shared';
import { Role } from '../models/index.js';

const builtin = new Map(BUILTIN_ROLE_DEFS.map((r) => [r.key, r]));

const fromDoc = (d: {
  key: string;
  name: string;
  description?: string | null;
  permissions: string[];
  rank: number;
}): RoleDef => ({
  key: d.key,
  name: d.name,
  description: d.description ?? '',
  permissions: d.permissions.filter(isPermission),
  rank: d.rank,
  builtin: false,
});

/** Resolve a role key to its definition. Read on every request, so edits apply immediately. */
export async function resolveRole(key: string): Promise<RoleDef | null> {
  const b = builtin.get(key);
  if (b) return b;
  const d = await Role.findOne({ key }).lean();
  return d ? fromDoc(d) : null;
}

/** Built-in roles first (highest rank first), then custom roles. */
export async function allRoles(): Promise<RoleDef[]> {
  const custom = (await Role.find().sort({ rank: -1, name: 1 }).lean()).map(fromDoc);
  return [...BUILTIN_ROLE_DEFS, ...custom];
}
