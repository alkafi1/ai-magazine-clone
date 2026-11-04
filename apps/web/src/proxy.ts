import { NextResponse, type NextRequest } from 'next/server';

/** Optimistic gate: no cookie, no admin pages. The API still verifies the token on every call. */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();
  if (!req.cookies.get('admin_token')) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
