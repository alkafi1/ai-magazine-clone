import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

const TAG = /^[a-z0-9:_-]{1,140}$/;
/** Tags implied by new/changed articles, so lists, menus and sitemaps refresh together. */
const WITH_HOME = ['categories', 'latest', 'search'];

function authorized(given: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET ?? '';
  const a = Buffer.from(given ?? '');
  const b = Buffer.from(secret);
  return secret.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req.headers.get('x-revalidate-secret'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string' && TAG.test(t)).slice(0, 300)
    : [];
  const all = new Set(tags);
  if (all.has('home')) WITH_HOME.forEach((t) => all.add(t));
  // expire: 0 = drop the cached entry now, so the next request renders fresh data.
  for (const tag of all) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: [...all].length });
}
