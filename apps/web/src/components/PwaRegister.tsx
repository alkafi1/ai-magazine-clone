'use client';

import { useEffect } from 'react';

/** PWA registration (installable, offline-ish for saved pages). */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
