'use client';

import { useEffect, useRef } from 'react';
import { useConsent } from '@/lib/consent';

let adsenseLoaded: Promise<void> | null = null;

/** Load Google's AdSense script once per page. Resolves even on failure (ad blockers are common). */
export function loadAdsense(clientId: string): Promise<void> {
  adsenseLoaded ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return adsenseLoaded;
}

type AdWindow = Window & { adsbygoogle?: unknown[] };

export type AdSlotProps = {
  provider: 'adsense' | 'custom';
  clientId: string;
  slotId: string;
  html: string;
  consentRequired: boolean;
  label: string;
  className?: string;
};

/**
 * One ad placement. The server renders nothing for it (so cached pages never depend on consent);
 * in the browser it appears only if the visitor has accepted (or consent is not required).
 */
export function AdSlot({
  provider,
  clientId,
  slotId,
  html,
  consentRequired,
  label,
  className = '',
}: AdSlotProps) {
  const consent = useConsent();
  const allowed = consent !== undefined && (!consentRequired || consent === 'granted');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!allowed || !el) return;
    if (provider === 'custom') {
      // createContextualFragment makes <script> tags in the pasted ad code actually run.
      el.replaceChildren(document.createRange().createContextualFragment(html));
      return;
    }
    let cancelled = false;
    void loadAdsense(clientId).then(() => {
      const ins = el.querySelector('ins.adsbygoogle');
      if (cancelled || !ins || ins.getAttribute('data-sw-pushed')) return;
      ins.setAttribute('data-sw-pushed', '1');
      try {
        const w = window as AdWindow;
        (w.adsbygoogle = w.adsbygoogle ?? []).push({});
      } catch {
        /* blocked or already filled */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [allowed, provider, clientId, html]);

  if (!allowed) return null;
  return (
    <aside aria-label="Advertisement" className={`text-center ${className}`} data-ad-slot={label}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate">
        Advertisement
      </p>
      <div ref={box} className="min-h-[90px] overflow-hidden">
        {provider === 'adsense' && (
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={clientId}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )}
      </div>
    </aside>
  );
}
