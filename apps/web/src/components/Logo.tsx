import Link from 'next/link';
import { getBranding } from '@/lib/api';
import { safeImageUrl } from '@/lib/site';

/** Built-in mark, used until a logo is uploaded under Admin → Appearance. */
function DefaultMark({ light }: { light: boolean }) {
  return (
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
  );
}

/**
 * Site logo. `light` = drawn on an always-dark surface (the footer). With an uploaded logo we use it;
 * if a separate dark-background logo exists it is used in dark mode and on the footer.
 */
export async function Logo({ light = false, large = false }: { light?: boolean; large?: boolean }) {
  const b = await getBranding();
  const main = safeImageUrl(b.logoUrl);
  const dark = safeImageUrl(b.logoDarkUrl);
  const h = large ? 'h-14' : 'h-9';
  const nameCls = `font-display ${large ? 'text-4xl sm:text-5xl' : 'text-2xl'} font-extrabold tracking-tight ${light ? 'text-snow' : 'text-ink'}`;

  return (
    <Link
      href="/"
      className={`flex items-center ${large ? 'justify-center' : ''} gap-2.5`}
      aria-label={`${b.name} home`}
    >
      {main ? (
        <>
          {light ? (
            <img src={dark ?? main} alt="" className={`${h} w-auto max-w-56`} />
          ) : dark ? (
            <>
              <img src={main} alt="" className={`${h} w-auto max-w-56 dark:hidden`} />
              <img src={dark} alt="" className={`${h} hidden w-auto max-w-56 dark:block`} />
            </>
          ) : (
            <img src={main} alt="" className={`${h} w-auto max-w-56`} />
          )}
        </>
      ) : (
        <DefaultMark light={light} />
      )}
      {(b.showName || !main) && <span className={nameCls}>{b.name}</span>}
    </Link>
  );
}
