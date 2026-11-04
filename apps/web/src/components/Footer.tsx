import Link from 'next/link';
import { SITE } from '@/lib/site';
import { Logo } from './Logo';
import { NewsletterForm } from './NewsletterForm';

const links = [
  ['/about', 'About'],
  ['/contact', 'Contact'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/dmca', 'DMCA & takedowns'],
  ['/feed.xml', 'RSS'],
] as const;

export function Footer() {
  return (
    <footer className="mt-16 bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-2 [&>div]:min-w-0">
        <div>
          <Logo light />
          <p className="mt-4 max-w-md text-sm text-paper/75">{SITE.description}</p>
          <p className="mt-4 max-w-md rounded border border-paper/20 p-3 text-sm text-paper/80">
            Headlines and short summaries on {SITE.name} are aggregated from{' '}
            <a
              href={SITE.sourceUrl}
              rel="noopener nofollow"
              className="font-semibold text-signal underline"
            >
              {SITE.sourceName}
            </a>
            . Every story links to the original; all rights remain with the publisher.
          </p>
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Get the weekly signal</h2>
          <p className="mt-1 text-sm text-paper/75">
            The week’s biggest AI stories in one email. No spam.
          </p>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-paper/15">
        <nav
          aria-label="Footer"
          className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 text-sm"
        >
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="text-paper/80 hover:text-signal">
              {label}
            </Link>
          ))}
          <span className="ml-auto text-paper/60">
            © {new Date().getFullYear()} {SITE.name}
          </span>
        </nav>
      </div>
    </footer>
  );
}
