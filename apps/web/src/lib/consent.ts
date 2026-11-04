'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'sw_consent';
const EVENT = 'sw-consent';
export type Consent = 'granted' | 'denied' | null;

function read(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null; // storage blocked: treat as undecided
  }
}

export function setConsent(value: Consent) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the choice only lasts until reload */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** `undefined` during server render / first paint, then the stored choice (null = not decided yet). */
export function useConsent(): Consent | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}
