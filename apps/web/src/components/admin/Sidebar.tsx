'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';

export type NavItem = { href: string; label: string; icon: string; section: string };

const isActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const sections = [...new Set(items.map((i) => i.section))];
  return (
    <nav aria-label="Admin" className="space-y-5">
      {sections.map((section) => (
        <div key={section}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {section}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {items
              .filter((i) => i.section === section)
              .map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-white/10 text-white'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon name={item.icon} className="h-[18px] w-[18px]" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DesktopSidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto bg-slate-900 px-3 py-5 lg:flex">
      <Link href="/admin" className="mb-7 flex items-center gap-2.5 px-3">
        <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="#faf8f3" />
          <path
            d="M8 38h10l6-18 10 28 8-22 4 12h10"
            fill="none"
            stroke="#5b3df5"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="54" cy="38" r="4.5" fill="#ffb703" />
        </svg>
        <span className="font-display text-lg font-extrabold text-white">Synthwire</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Admin
        </span>
      </Link>
      <NavLinks items={items} />
      <a
        href="/"
        target="_blank"
        rel="noopener"
        className="mt-auto flex items-center gap-2 px-3 pt-6 text-sm text-slate-400 hover:text-white"
      >
        <Icon name="external" className="h-4 w-4" /> View public site
      </a>
    </aside>
  );
}

/** Mobile/tablet: a top bar with a disclosure menu (no JS needed beyond <details>). */
export function MobileNav({ items }: { items: NavItem[] }) {
  return (
    <details className="group relative lg:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
        <span aria-hidden="true">☰</span> Menu
      </summary>
      <div className="absolute left-0 top-full z-30 mt-2 max-h-[75vh] w-72 overflow-y-auto rounded-xl bg-slate-900 p-3 shadow-2xl">
        <NavLinks items={items} />
      </div>
    </details>
  );
}
