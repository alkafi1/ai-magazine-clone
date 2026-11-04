import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/admin';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** Streams the API's CSV to the browser using the session cookie (the token never reaches page scripts). */
export async function GET(req: Request) {
  const token = /(?:^|;\s*)admin_token=([^;]+)/.exec(req.headers.get('cookie') ?? '')?.[1];
  if (!token) return NextResponse.redirect(new URL('/admin/login', req.url));
  void COOKIE;
  const res = await fetch(`${API}/api/admin/subscribers/export.csv`, {
    headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
    cache: 'no-store',
  });
  if (res.status === 401) return NextResponse.redirect(new URL('/admin/login?expired=1', req.url));
  if (!res.ok) return new NextResponse('Not allowed', { status: res.status });
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="subscribers.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
