import { describe, expect, it } from 'vitest';
import { assessHealth, emptyStats, recordParsed, type ParseStats } from './health.js';

const stats = (over: Partial<ParseStats> = {}): ParseStats => ({ ...emptyStats(), ...over });
const healthy = () => stats({ parsed: 20, via: { 'next-data': 20, 'json-ld': 0, meta: 0 } });

describe('assessHealth', () => {
  it('is quiet when everything parses from __NEXT_DATA__', () => {
    expect(assessHealth(healthy())).toEqual([]);
  });
  it('ignores tiny samples, except total failure', () => {
    expect(assessHealth(stats({ parsed: 1, parseFailed: 3 }))).toEqual([]);
    expect(assessHealth(stats({ parsed: 0, parseFailed: 2 }))[0]).toMatch(/None of 2/);
    expect(assessHealth(stats())).toEqual([]); // nothing fetched at all (e.g. everything already known)
  });
  it('flags a high parse-failure rate', () => {
    const w = assessHealth(
      stats({ parsed: 6, parseFailed: 4, via: { 'next-data': 6, 'json-ld': 0, meta: 0 } }),
    );
    expect(w.join(' ')).toMatch(/40% of fetched pages failed/);
  });
  it('flags silent fallback to JSON-LD/meta', () => {
    const w = assessHealth(stats({ parsed: 10, via: { 'next-data': 2, 'json-ld': 6, meta: 2 } }));
    expect(w.join(' ')).toMatch(/Only 20% .* __NEXT_DATA__/);
  });
  it('flags vanishing fields', () => {
    const w = assessHealth({
      ...healthy(),
      missingExcerpt: 10,
      missingImage: 15,
      missingAuthor: 15,
    }).join(' ');
    expect(w).toMatch(/50% .* no excerpt/);
    expect(w).toMatch(/75% .* no image/);
    expect(w).toMatch(/75% .* no author/);
  });
  it('counts what recordParsed sees', () => {
    const s = emptyStats();
    recordParsed(s, { excerpt: '', imageUrl: null, authorName: null } as never, 'meta');
    expect(s).toMatchObject({ parsed: 1, missingExcerpt: 1, missingImage: 1, missingAuthor: 1 });
    expect(s.via.meta).toBe(1);
  });
});
