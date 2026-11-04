import type { Metadata } from 'next';
import Link from 'next/link';
import { getToken } from '@/lib/admin';
import { logout } from './actions';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin' },
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

const link = 'rounded px-3 py-2 text-sm font-semibold hover:bg-ink-soft';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await getToken());
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <span className="mr-4 font-display text-lg font-extrabold">Synthwire admin</span>
          {signedIn && (
            <nav aria-label="Admin" className="flex flex-1 items-center gap-1">
              <Link href="/admin" className={link}>
                Dashboard
              </Link>
              <Link href="/admin/articles" className={link}>
                Articles
              </Link>
              <Link href="/admin/scrape-runs" className={link}>
                Scrape runs
              </Link>
              <form action={logout} className="ml-auto">
                <button className={link}>Sign out</button>
              </form>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
