import Image from 'next/image';
import { safeHttpsUrl } from '@/lib/site';

/**
 * Article picture. Default: hotlinked straight from the source (IMAGE_OPTIMIZE unset) — the browser
 * loads the source's own file. With IMAGE_OPTIMIZE=true, Next resizes/converts it to WebP and caches
 * that derivative on our server (faster, but it means we store resized copies).
 */
const OPTIMIZE = process.env.IMAGE_OPTIMIZE === 'true';

export function Cover({
  src,
  alt,
  label,
  priority = false,
  className = '',
  width = 668,
  sizes = '(min-width: 1024px) 400px, 100vw',
}: {
  src: string | null;
  alt: string | null;
  label: string;
  priority?: boolean;
  className?: string;
  width?: number;
  sizes?: string;
}) {
  const safeSrc = safeHttpsUrl(src);
  if (!safeSrc) {
    return (
      <div
        aria-hidden="true"
        className={`flex aspect-[16/9] items-end bg-gradient-to-br from-night via-night-soft to-wire p-4 ${className}`}
      >
        <span className="font-display text-lg font-bold text-snow/90">{label}</span>
      </div>
    );
  }
  return (
    <Image
      src={safeSrc}
      alt={alt ?? ''}
      width={width}
      height={Math.round((width * 9) / 16)}
      sizes={sizes}
      priority={priority}
      unoptimized={!OPTIMIZE}
      referrerPolicy="no-referrer"
      className={`aspect-[16/9] w-full bg-mist object-cover ${className}`}
    />
  );
}
