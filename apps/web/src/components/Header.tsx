import Link from 'next/link';
import { getCategories } from '@/lib/api';
import { SITE } from '@/lib/site';
import { formatDate } from '@/lib/format';
import { Logo } from './Logo';
import { SearchBox } from './SearchBox';

const navLink =
  'rounded px-3 py-2 text-sm font-semibold text-ink hover:bg-mist/60 hover:text-wire-dark';

export async function Header() {
  const categories = (await getCategories().catch(() => [])).filter(
    (c) => c.showInMenu && c.articleCount > 0,
  );
  const primary = categories.slice(0, 5);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="bg-ink text-xs text-paper/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
          <span>{formatDate(new Date().toISOString())}</span>
          <span className="hidden sm:inline">{SITE.tagline}</span>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-mist bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Logo />
          <nav aria-label="Main" className="ml-4 hidden items-center lg:flex">
            <Link href="/latest" className={navLink}>
              Latest
            </Link>
            {primary.map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className={navLink}>
                {c.name}
              </Link>
            ))}
            <details className="group relative">
              <summary className={`${navLink} cursor-pointer list-none`}>Topics ▾</summary>
              <div className="absolute left-0 top-full mt-2 w-[640px] rounded-lg border border-mist bg-card p-5 shadow-xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate">
                  Browse by topic
                </p>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/category/${c.slug}`}
                        className="block rounded p-2 hover:bg-paper"
                      >
                        <span className="font-semibold text-ink">{c.name}</span>
                        <span className="ml-2 text-xs text-slate">{c.articleCount} stories</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </nav>
          <div className="ml-auto hidden w-64 md:block">
            <SearchBox />
          </div>
          <details className="relative ml-auto lg:hidden">
            <summary
              className="cursor-pointer list-none rounded border border-mist px-3 py-2 text-sm font-semibold"
              aria-label="Menu"
            >
              Menu ☰
            </summary>
            <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-mist bg-card p-4 shadow-xl">
              <SearchBox />
              <ul className="mt-3 space-y-1">
                <li>
                  <Link href="/latest" className={`${navLink} block`}>
                    Latest
                  </Link>
                </li>
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/category/${c.slug}`} className={`${navLink} block`}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}
