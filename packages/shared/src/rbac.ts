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
  'scrape.view',
  'scrape.run',
  'subscribers.view',
  'subscribers.manage', // export, delete
  'settings.manage', // site settings: announcement, social, analytics, features
  'ads.manage',
  'users.view',
  'users.manage',
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
  editor: ['dashboard.view', 'articles.view', 'articles.feature', 'articles.seo', 'scrape.view'],
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
