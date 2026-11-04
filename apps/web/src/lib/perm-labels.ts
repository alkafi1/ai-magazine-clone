import type { Permission } from '@aimag/shared';

export const PERM_LABELS: Record<Permission, string> = {
  'dashboard.view': 'View the dashboard',
  'articles.view': 'View articles',
  'articles.write': 'Write, edit and delete our own articles',
  'articles.feature': 'Feature stories on the home page',
  'articles.seo': 'Edit SEO of stories',
  'articles.moderate': 'Hide, restore and take down stories',
  'categories.manage': 'Create, edit and delete categories',
  'pages.manage': 'Manage custom pages',
  'media.manage': 'Upload and delete images',
  'scrape.view': 'View scrape runs',
  'scrape.run': 'Run the scraper',
  'subscribers.view': 'View newsletter subscribers',
  'subscribers.manage': 'Export or delete subscribers',
  'ads.manage': 'Manage ads',
  'settings.manage': 'Site settings (announcement, analytics, social)',
  'appearance.manage': 'Logo, name, theme and menus',
  'users.view': 'View users and roles',
  'users.manage': 'Create and manage users',
  'roles.manage': 'Create and edit custom roles',
  'audit.view': 'View the audit log',
};

/** Groups shown in the role editor, in order. */
export const PERM_GROUPS: { title: string; perms: Permission[] }[] = [
  { title: 'Dashboard', perms: ['dashboard.view'] },
  {
    title: 'Content',
    perms: [
      'articles.view',
      'articles.write',
      'articles.feature',
      'articles.seo',
      'articles.moderate',
      'categories.manage',
      'pages.manage',
      'media.manage',
    ],
  },
  {
    title: 'Scraper & audience',
    perms: ['scrape.view', 'scrape.run', 'subscribers.view', 'subscribers.manage'],
  },
  { title: 'Site', perms: ['ads.manage', 'settings.manage', 'appearance.manage'] },
  { title: 'Administration', perms: ['users.view', 'users.manage', 'roles.manage', 'audit.view'] },
];
