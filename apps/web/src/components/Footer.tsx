import { getSiteConfig } from '@/lib/api';
import { SITE } from '@/lib/site';
import { NavLink } from './NavLink';
import { CookieSettingsButton } from './ConsentBanner';
import { Logo } from './Logo';
import { NewsletterForm } from './NewsletterForm';

const links = [
  ['/topics', 'Topics'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/dmca', 'DMCA & takedowns'],
  ['/feed.xml', 'RSS'],
] as const;

const socialNames = {
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  facebook: 'Facebook',
  instagram: 'Instagram',
} as const;

export async function Footer() {
  const cfg = await getSiteConfig();
  const b = cfg.branding;
  const footerLinks =
    cfg.navigation.footer.length > 0
      ? cfg.navigation.footer
      : links.map(([href, label]) => ({ href, label }));
  const social = (Object.keys(socialNames) as (keyof typeof socialNames)[]).filter(
    (k) => cfg.social[k],
  );
  return (
    <footer className="mt-16 bg-night text-snow">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-2 [&>div]:min-w-0">
        <div>
          <Logo light />
          <p className="mt-4 max-w-md text-sm text-snow/75">{b.description}</p>
          <p className="mt-4 max-w-md rounded border border-snow/20 p-3 text-sm text-snow/80">
            Headlines and short summaries on {b.name} are aggregated from{' '}
            <a
              href={SITE.sourceUrl}
              rel="noopener nofollow"
              className="font-semibold text-signal underline"
            >
              {SITE.sourceName}
            </a>
            . Every story links to the original; all rights remain with the publisher.
          </p>
          {cfg.footerNote && <p className="mt-4 max-w-md text-sm text-snow/75">{cfg.footerNote}</p>}
          {social.length > 0 && (
            <ul aria-label="Follow us" className="mt-5 flex flex-wrap gap-2">
              {social.map((k) => (
                <li key={k}>
                  <a
                    href={cfg.social[k]}
                    target="_blank"
                    rel="noopener me"
                    className="rounded-full border border-snow/30 px-3 py-1 text-sm font-semibold text-snow hover:border-signal hover:text-signal"
                  >
                    {socialNames[k]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {cfg.features.newsletter && (
          <div>
            <h2 className="font-display text-xl font-bold">Get the weekly signal</h2>
            <p className="mt-1 text-sm text-snow/75">
              The week’s biggest AI stories in one email. No spam.
            </p>
            <NewsletterForm />
          </div>
        )}
      </div>
      <div className="border-t border-snow/15">
        <nav
          aria-label="Footer"
          className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 text-sm"
        >
          {footerLinks.map((l) => (
            <NavLink
              key={l.href + l.label}
              href={l.href}
              className="text-snow/80 hover:text-signal"
            >
              {l.label}
            </NavLink>
          ))}
          {(cfg.ads.enabled || cfg.ga4Id) && (
            <CookieSettingsButton className="text-snow/80 hover:text-signal" />
          )}
          <span className="ml-auto text-snow/60">
            © {new Date().getFullYear()} {b.name}
          </span>
        </nav>
      </div>
    </footer>
  );
}
