import Link from 'next/link';
import { getCategories, getSiteConfig } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Logo } from './Logo';
import { NavLink } from './NavLink';
import { SearchBox } from './SearchBox';
import { ThemeToggle } from './ThemeToggle';

const navLink =
  'whitespace-nowrap rounded px-3 py-2 text-sm font-semibold text-ink hover:bg-mist/60 hover:text-wire-dark';

export async function Header() {
  const cfg = await getSiteConfig();
  const { branding: b, navigation: nav, theme } = cfg;
  const categories = (await getCategories().catch(() => [])).filter(
    (c) => c.showInMenu && c.articleCount > 0,
  );
  const custom = nav.header.mode === 'custom' && nav.header.items.length > 0;
  const primary = categories.slice(0, 4); // the rest live under "Topics"
  const toggle = cfg.features.darkModeToggle ? <ThemeToggle /> : null;

  // The main navigation: automatic (categories) or the links the admin chose.
  const links = custom ? (
    nav.header.items.map((i) => (
      <NavLink key={i.label + i.href} href={i.href} className={navLink}>
        {i.label}
      </NavLink>
    ))
  ) : (
    <>
      <Link href="/latest" className={navLink}>
        Latest
      </Link>
      <Link href="/saved" className={navLink}>
        Saved
      </Link>
      {primary.map((c) => (
        <Link key={c.slug} href={`/category/${c.slug}`} className={navLink}>
          {c.name}
        </Link>
      ))}
      <details className="group relative">
        <summary className={`${navLink} cursor-pointer list-none`}>Topics ▾</summary>
        <div className="absolute left-0 top-full z-50 mt-2 w-[640px] max-w-[90vw] rounded-lg border border-mist bg-card p-5 shadow-xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate">
            Browse by topic
          </p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="block rounded p-2 hover:bg-paper">
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span className="ml-2 text-xs text-slate">{c.articleCount} stories</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/topics"
            className="mt-4 inline-block text-sm font-semibold text-wire-dark hover:underline"
          >
            All topics →
          </Link>
        </div>
      </details>
    </>
  );

  const mobileMenu = (
    <details className="relative lg:hidden">
      <summary
        className="cursor-pointer list-none rounded border border-mist px-3 py-2 text-sm font-semibold"
        aria-label="Menu"
      >
        Menu ☰
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-mist bg-card p-4 shadow-xl">
        <SearchBox />
        <ul className="mt-3 space-y-1">
          {custom ? (
            nav.header.items.map((i) => (
              <li key={i.label + i.href}>
                <NavLink href={i.href} className={`${navLink} block`}>
                  {i.label}
                </NavLink>
              </li>
            ))
          ) : (
            <>
              <li>
                <Link href="/latest" className={`${navLink} block`}>
                  Latest
                </Link>
              </li>
              <li>
                <Link href="/saved" className={`${navLink} block`}>
                  Saved
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className={`${navLink} block`}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </>
          )}
        </ul>
      </div>
    </details>
  );

  const topBar = (
    <div className="bg-night text-xs text-snow/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5">
        <span>{formatDate(new Date().toISOString())}</span>
        <span className="hidden sm:inline">{b.tagline}</span>
      </div>
    </div>
  );

  // Classic newspaper: centred masthead, then a ruled navigation bar.
  if (theme === 'broadsheet') {
    return (
      <>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {topBar}
        <header className="border-b-4 border-double border-ink bg-paper">
          <div className="mx-auto max-w-7xl px-4 pb-4 pt-6 text-center">
            <Logo large />
            {b.tagline && (
              <p className="mt-2 font-display text-sm italic text-slate">{b.tagline}</p>
            )}
          </div>
          <div className="sticky top-0 z-40 border-y border-ink bg-paper/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-1.5">
              <nav aria-label="Main" className="hidden flex-1 items-center justify-center lg:flex">
                {links}
              </nav>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <div className="hidden w-52 md:block">
                  <SearchBox />
                </div>
                {toggle}
                {mobileMenu}
              </div>
            </div>
          </div>
        </header>
      </>
    );
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {topBar}
      <header className="sticky top-0 z-40 border-b border-mist bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Logo />
          <nav aria-label="Main" className="ml-4 hidden items-center lg:flex">
            {links}
          </nav>
          {toggle && <div className="ml-auto md:order-last md:ml-0">{toggle}</div>}
          <div className="ml-auto hidden w-64 md:block">
            <SearchBox />
          </div>
          <div className="ml-auto lg:hidden">{mobileMenu}</div>
        </div>
      </header>
    </>
  );
}
