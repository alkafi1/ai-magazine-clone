'use client';

import Link from 'next/link';
import { setConsent, useConsent } from '@/lib/consent';

/** Asks once, only when something on the site (ads, analytics) needs consent. */
export function ConsentBanner({ needed }: { needed: boolean }) {
  const consent = useConsent();
  if (!needed || consent !== null) return null; // undefined = still hydrating, otherwise already decided
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-mist bg-card p-4 shadow-2xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-ink">
          We use cookies for advertising and to understand how the site is used. You can say no and
          still read everything.{' '}
          <Link href="/privacy" className="font-semibold text-wire-dark underline">
            Privacy policy
          </Link>
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConsent('denied')}
            className="rounded-md border border-mist px-4 py-2 text-sm font-semibold text-ink hover:bg-mist/50"
          >
            Decline
          </button>
          <button
            onClick={() => setConsent('granted')}
            className="rounded-md bg-wire px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer link that lets visitors change their mind. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => setConsent(null)} className={className}>
      Cookie settings
    </button>
  );
}
