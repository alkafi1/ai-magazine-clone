import Link from 'next/link';
import { SITE } from '@/lib/site';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITE.name} home`}>
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill={light ? '#faf8f3' : '#0c1222'} />
        <path
          d="M8 38h10l6-18 10 28 8-22 4 12h10"
          fill="none"
          stroke={light ? '#5b3df5' : '#a99bff'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="54" cy="38" r="4.5" fill="#ffb703" />
      </svg>
      <span
        className={`font-display text-2xl font-extrabold tracking-tight ${light ? 'text-paper' : 'text-ink'}`}
      >
        {SITE.name}
      </span>
    </Link>
  );
}
