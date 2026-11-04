import type { Permission } from '@aimag/shared';
import Link from 'next/link';
import { DesktopSidebar, MobileNav, type NavItem } from '@/components/admin/Sidebar';
import { Badge } from '@/components/admin/ui';
import { getMe } from '@/lib/admin';
import { logout } from '../actions';

const NAV: (NavItem & { perm?: Permission })[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: 'dashboard',
    section: 'Overview',
    perm: 'dashboard.view',
  },
  {
    href: '/admin/articles',
    label: 'Articles',
    icon: 'articles',
    section: 'Content',
    perm: 'articles.view',
  },
  {
    href: '/admin/categories',
    label: 'Categories',
    icon: 'categories',
    section: 'Content',
    perm: 'articles.view',
  },
  { href: '/admin/pages', label: 'Pages', icon: 'pages', section: 'Content', perm: 'pages.manage' },
  { href: '/admin/media', label: 'Media', icon: 'media', section: 'Content', perm: 'media.manage' },
  {
    href: '/admin/scrape-runs',
    label: 'Scrape runs',
    icon: 'runs',
    section: 'Content',
    perm: 'scrape.view',
  },
  {
    href: '/admin/subscribers',
    label: 'Subscribers',
    icon: 'mail',
    section: 'Content',
    perm: 'subscribers.view',
  },
  {
    href: '/admin/appearance',
    label: 'Appearance',
    icon: 'appearance',
    section: 'Site',
    perm: 'appearance.manage',
  },
  { href: '/admin/ads', label: 'Ads', icon: 'ads', section: 'Site', perm: 'ads.manage' },
  {
    href: '/admin/settings',
    label: 'Site settings',
    icon: 'settings',
    section: 'Site',
    perm: 'settings.manage',
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: 'users',
    section: 'Administration',
    perm: 'users.view',
  },
  {
    href: '/admin/roles',
    label: 'Roles',
    icon: 'roles',
    section: 'Administration',
    perm: 'users.view',
  },
  {
    href: '/admin/audit',
    label: 'Audit log',
    icon: 'audit',
    section: 'Administration',
    perm: 'audit.view',
  },
  { href: '/admin/account', label: 'My account', icon: 'account', section: 'Account' },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  // Only show what this role can use. The API enforces the same rules; this just keeps the UI honest.
  const items = NAV.filter((i) => !i.perm || me.permissions.includes(i.perm)).map(
    ({ perm: _perm, ...i }) => i,
  );

  return (
    <>
      <DesktopSidebar items={items} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-8">
          <MobileNav items={items} />
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-900">
                {me.name || me.email}
              </p>
              <p className="text-xs text-slate-500">{me.name ? me.email : ''}</p>
            </div>
            <Badge tone="violet">{me.roleName}</Badge>
            <Link
              href="/admin/account"
              className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline"
            >
              Account
            </Link>
            <form action={logout}>
              <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </>
  );
}
