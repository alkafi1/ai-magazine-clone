const fmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
export const formatDate = (iso: string) => fmt.format(new Date(iso));

/** Parse the optional catch-all of `/x/[slug]/[[...page]]`: [] -> 1, ['page','2'] -> 2, else null. */
export function parsePage(segments?: string[]): number | 'redirect' | null {
  if (!segments || segments.length === 0) return 1;
  if (segments.length !== 2 || segments[0] !== 'page' || !/^\d{1,4}$/.test(segments[1]!))
    return null;
  const n = Number(segments[1]);
  if (n === 1) return 'redirect';
  return n >= 2 ? n : null;
}

export const pagePath = (base: string, page: number) => (page <= 1 ? base : `${base}/page/${page}`);
