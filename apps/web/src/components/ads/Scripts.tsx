'use client';

import { useEffect } from 'react';
import { useConsent } from '@/lib/consent';
import { loadAdsense } from './AdSlot';

/** Auto ads: just loading AdSense's script lets Google place ads per your AdSense settings. */
export function AutoAds({
  clientId,
  consentRequired,
}: {
  clientId: string;
  consentRequired: boolean;
}) {
  const consent = useConsent();
  const allowed = consent !== undefined && (!consentRequired || consent === 'granted');
  useEffect(() => {
    if (allowed) void loadAdsense(clientId);
  }, [allowed, clientId]);
  return null;
}

/** Google Analytics 4, loaded only after the visitor accepts. IP anonymisation is on by default in GA4. */
export function GoogleAnalytics({ id }: { id: string }) {
  const consent = useConsent();
  useEffect(() => {
    if (consent !== 'granted') return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
    const w = window as Window & { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer ?? [];
    // gtag() must push the real `arguments` object, not an array.
    function gtag(..._args: unknown[]) {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    }
    gtag('js', new Date());
    gtag('config', id);
  }, [consent, id]);
  return null;
}
