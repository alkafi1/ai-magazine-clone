'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
};
const isDark = () => document.documentElement.classList.contains('dark');

/** The initial theme is set by an inline script in the layout, before first paint (no flash). */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => {
        const next = !isDark();
        document.documentElement.classList.toggle('dark', next);
        try {
          localStorage.setItem('sw_theme', next ? 'dark' : 'light');
        } catch {
          /* ignore */
        }
      }}
      className="rounded-md border border-mist p-2 text-ink hover:bg-mist/60"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 13.5A8.5 8.5 0 0 1 10.5 3 8.5 8.5 0 1 0 21 13.5z" />
        )}
      </svg>
    </button>
  );
}

/** Inline, blocking script: apply the saved (or system) theme before the page paints. */
export const THEME_INIT = `try{var d=document.documentElement,t=localStorage.getItem('sw_theme');if(t==='dark'||(!t&&(d.dataset.theme==='midnight'||matchMedia('(prefers-color-scheme: dark)').matches)))d.classList.add('dark')}catch(e){}`;
