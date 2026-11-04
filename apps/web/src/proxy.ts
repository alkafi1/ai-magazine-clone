import { NextResponse, type NextRequest } from 'next/server';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const SLUG = /^\/article\/([a-z0-9-]{1,120})$/;

/**
 * 1. /admin/*: optimistic gate. No cookie, no admin pages (the API still verifies the token on every call).
 * 2. /article/<slug>: if the API says the story was taken down (410), answer 410 instead of a plain 404,
 *    so search engines remove it. Fails open: if the API is slow or down, the page renders as normal.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login' || req.cookies.get('admin_token')) return NextResponse.next();
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  const slug = SLUG.exec(pathname)?.[1];
  if (slug) {
    try {
      const res = await fetch(`${API}/api/articles/${slug}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(1500),
      });
      if (res.status === 410)
        return NextResponse.rewrite(new URL('/gone', req.url), { status: 410 });
    } catch {
      // fail open
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/article/:slug'] };
