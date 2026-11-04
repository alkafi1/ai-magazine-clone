import Link from 'next/link';
import type { PublicConfig } from '@aimag/shared';

const tones = {
  info: 'bg-wire text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-signal text-night',
  breaking: 'bg-red-600 text-white',
} as const;

export function AnnouncementBar({ a }: { a: PublicConfig['announcement'] }) {
  if (!a) return null;
  const inner = (
    <>
      {a.tone === 'breaking' && <strong className="mr-2 uppercase tracking-wider">Breaking</strong>}
      {a.text}
      {a.href && <span aria-hidden="true"> →</span>}
    </>
  );
  const cls = `block px-4 py-2 text-center text-sm font-medium ${tones[a.tone]}`;
  return (
    <div role="region" aria-label="Announcement">
      {!a.href ? (
        <p className={cls}>{inner}</p>
      ) : a.href.startsWith('/') ? (
        <Link href={a.href} className={`${cls} hover:underline`}>
          {inner}
        </Link>
      ) : (
        <a href={a.href} target="_blank" rel="noopener" className={`${cls} hover:underline`}>
          {inner}
        </a>
      )}
    </div>
  );
}
