import Link from 'next/link';
import { pagePath } from '@/lib/format';

export function Pagination({
  base,
  page,
  totalPages,
}: {
  base: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const window = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  const cell = 'rounded border border-mist px-3 py-2 text-sm font-semibold';
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={pagePath(base, page - 1)} rel="prev" className={`${cell} hover:bg-mist/60`}>
          ← Newer
        </Link>
      )}
      {window.map((n, i) => (
        <span key={n} className="contents">
          {i > 0 && n - window[i - 1]! > 1 && <span aria-hidden="true">…</span>}
          {n === page ? (
            <span aria-current="page" className={`${cell} bg-ink text-paper`}>
              {n}
            </span>
          ) : (
            <Link href={pagePath(base, n)} className={`${cell} hover:bg-mist/60`}>
              {n}
            </Link>
          )}
        </span>
      ))}
      {page < totalPages && (
        <Link href={pagePath(base, page + 1)} rel="next" className={`${cell} hover:bg-mist/60`}>
          Older →
        </Link>
      )}
    </nav>
  );
}
