import type { ScrapedArticle } from '@aimag/shared';

/** Per-run counters for pages we fetched successfully (network errors are not parse problems). */
export type ParseStats = {
  parsed: number;
  parseFailed: number;
  via: { 'next-data': number; 'json-ld': number; meta: number };
  missingExcerpt: number;
  missingImage: number;
  missingAuthor: number;
};

export const emptyStats = (): ParseStats => ({
  parsed: 0,
  parseFailed: 0,
  via: { 'next-data': 0, 'json-ld': 0, meta: 0 },
  missingExcerpt: 0,
  missingImage: 0,
  missingAuthor: 0,
});

export function recordParsed(stats: ParseStats, article: ScrapedArticle, via: string): void {
  stats.parsed++;
  if (via === 'next-data' || via === 'json-ld' || via === 'meta') stats.via[via]++;
  if (!article.excerpt) stats.missingExcerpt++;
  if (!article.imageUrl) stats.missingImage++;
  if (!article.authorName) stats.missingAuthor++;
}

/** Below this many pages a percentage is noise, except "nothing parsed at all". */
const MIN_SAMPLE = 5;

/**
 * Turn run counters into human-readable warnings. An empty list means the source still looks the
 * way the parser expects. These catch the quiet failures: pages still "work" via the fallback
 * layers, or fields vanish, long before the run itself fails.
 */
export function assessHealth(s: ParseStats): string[] {
  const warnings: string[] = [];
  const pages = s.parsed + s.parseFailed;
  const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`;

  if (pages > 0 && s.parsed === 0) {
    warnings.push(
      `None of ${pages} fetched pages could be parsed: the source page format has probably changed.`,
    );
    return warnings;
  }
  if (pages < MIN_SAMPLE) return warnings;

  if (s.parseFailed / pages > 0.3) {
    warnings.push(
      `${pct(s.parseFailed, pages)} of fetched pages failed to parse (${s.parseFailed}/${pages}).`,
    );
  }
  if (s.parsed > 0 && s.via['next-data'] / s.parsed < 0.5) {
    warnings.push(
      `Only ${pct(s.via['next-data'], s.parsed)} of pages were read from __NEXT_DATA__; the rest used JSON-LD/meta fallbacks, so the primary parser may be broken.`,
    );
  }
  if (s.parsed > 0 && s.missingExcerpt / s.parsed > 0.3) {
    warnings.push(`${pct(s.missingExcerpt, s.parsed)} of parsed articles have no excerpt.`);
  }
  if (s.parsed > 0 && s.missingImage / s.parsed > 0.5) {
    warnings.push(`${pct(s.missingImage, s.parsed)} of parsed articles have no image.`);
  }
  if (s.parsed > 0 && s.missingAuthor / s.parsed > 0.5) {
    warnings.push(`${pct(s.missingAuthor, s.parsed)} of parsed articles have no author.`);
  }
  return warnings;
}
