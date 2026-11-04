/**
 * Roles and permissions, shared by the API (enforcement) and the admin UI (hiding what you cannot use).
 * The API is the source of truth: the UI only mirrors it for a cleaner experience.
 */
export const PERMISSIONS = [
  'dashboard.view',
  'articles.view',
  'articles.moderate', // hide, restore, takedown
  'articles.feature',
  'articles.seo',
  'articles.write', // create / edit / delete your own (original) articles
  'categories.manage',
  'pages.manage', // custom pages
  'media.manage', // upload images (logo, covers)
  'scrape.view',
  'scrape.run',
  'subscribers.view',
  'subscribers.manage', // export, delete
  'settings.manage', // site settings: announcement, social, analytics, features
  'ads.manage',
  'appearance.manage', // logo, name, theme, navigation
  'users.view',
  'users.manage',
  'roles.manage', // create and edit custom roles
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  'super_admin',
  'admin',
  'editor',
  'moderator',
  'ad_manager',
  'viewer',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  editor: 'Editor',
  moderator: 'Moderator',
  ad_manager: 'Ad manager',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: 'Everything, including managing other super admins. Keep this to the site owner(s).',
  admin: 'Everything except managing super admins. Can create and manage lower roles.',
  editor: 'Features stories and edits their SEO. Read-only on scrape runs.',
  moderator: 'Hides, restores and takes down stories. Read-only on scrape runs.',
  ad_manager: 'Manages ads and the dashboard. No access to content or users.',
  viewer: 'Read-only: dashboard, articles and scrape runs.',
};

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: PERMISSIONS,
  editor: [
    'dashboard.view',
    'articles.view',
    'articles.feature',
    'articles.seo',
    'articles.write',
    'media.manage',
    'scrape.view',
  ],
  moderator: ['dashboard.view', 'articles.view', 'articles.moderate', 'scrape.view'],
  ad_manager: ['dashboard.view', 'ads.manage'],
  viewer: ['dashboard.view', 'articles.view', 'scrape.view'],
};

/** Higher rank = more authority. Equal-rank roles cannot manage each other. */
export const ROLE_RANK: Record<Role, number> = {
  super_admin: 100,
  admin: 80,
  editor: 50,
  moderator: 50,
  ad_manager: 50,
  viewer: 10,
};

export const isRole = (v: unknown): v is Role =>
  typeof v === 'string' && (ROLES as readonly string[]).includes(v);

export const can = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].includes(permission);

/** Can `actor` create, edit, disable or delete an account that has role `target`? */
export const canManageRole = (actor: Role, target: Role): boolean =>
  actor === 'super_admin' || ROLE_RANK[actor] > ROLE_RANK[target];

/** Roles `actor` may hand out. Super admins can create other super admins; everyone else only lower roles. */
export const assignableRoles = (actor: Role): Role[] =>
  ROLES.filter((r) => canManageRole(actor, r));

// ---- Custom roles --------------------------------------------------------------------------------
// Built-in roles above are fixed in code. Admins can also create custom roles (stored in the database):
// a name, a set of permissions and a rank. The rules below keep that safe.

export type RoleDef = {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  /** Higher = more authority. You can only manage accounts whose role ranks below yours. */
  rank: number;
  builtin: boolean;
};

export const BUILTIN_ROLE_DEFS: RoleDef[] = ROLES.map((key) => ({
  key,
  name: ROLE_LABELS[key],
  description: ROLE_DESCRIPTIONS[key],
  permissions: [...ROLE_PERMISSIONS[key]],
  rank: ROLE_RANK[key],
  builtin: true,
}));

export const isPermission = (v: unknown): v is Permission =>
  typeof v === 'string' && (PERMISSIONS as readonly string[]).includes(v);

/** A custom role can never outrank a built-in admin (80) unless made by a super admin, and never reaches 100. */
export const CUSTOM_ROLE_MAX_RANK = 79;

/** Keys of custom roles: lowercase letters, digits, dashes. Built-in keys are reserved. */
export const ROLE_KEY = /^[a-z][a-z0-9-]{1,39}$/;
export const roleKeyFromName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** The authority of an acting admin, as resolved from their role. */
export type Actor = { role: string; rank: number; permissions: readonly Permission[] };

/** May `actor` create, edit, disable or delete an account (or role) of rank `targetRank`? */
export const outranks = (actor: Actor, targetRank: number): boolean =>
  actor.role === 'super_admin' || actor.rank > targetRank;

/**
 * Privilege-escalation guard for custom roles: you may only grant permissions you hold yourself, and
 * only up to a rank below your own. Returns an error message, or null if the definition is allowed.
 */
export function checkRoleGrant(
  actor: Actor,
  role: { permissions: readonly Permission[]; rank: number },
): string | null {
  const sup = actor.role === 'super_admin';
  const extra = role.permissions.filter((p) => !actor.permissions.includes(p));
  if (!sup && extra.length)
    return `you cannot grant permissions you do not have: ${extra.join(', ')}`;
  if (role.rank > CUSTOM_ROLE_MAX_RANK) return `rank must be ${CUSTOM_ROLE_MAX_RANK} or lower`;
  if (!sup && role.rank >= actor.rank) return 'the role must rank below your own role';
  return null;
}
