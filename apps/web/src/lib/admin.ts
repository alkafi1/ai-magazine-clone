import 'server-only';
import type { Permission } from '@aimag/shared';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';

const API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const COOKIE = 'admin_token';

export const getToken = async () => (await cookies()).get(COOKIE)?.value;

/** Client IP as set by our reverse proxy, so the API's login rate limit sees the real visitor. */
async function clientIp() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim();
}

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Call the admin API with the cookie's JWT. 401 sends the user to the login page. */
export async function adminApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  if (!token) redirect('/admin/login');
  const res = await fetch(`${API}/api/admin${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'x-internal-secret': process.env.REVALIDATE_SECRET ?? '',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) redirect('/admin/login?expired=1');
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    issues?: { path: string; message: string }[];
  };
  if (!res.ok) {
    // Surface the API's field-level validation messages, e.g. "adsenseClientId: looks like ca-pub-...".
    const detail = body.issues
      ?.slice(0, 3)
      .map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
      .join('; ');
    throw new AdminApiError(res.status, detail || body.error || `API ${res.status}`);
  }
  return body as T;
}

export async function adminLogin(
  email: string,
  password: string,
): Promise<{ token: string } | null> {
  const ip = await clientIp();
  const res = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.REVALIDATE_SECRET ?? '',
      ...(ip ? { 'X-Forwarded-For': ip } : {}),
    },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 429) throw new AdminApiError(429, 'Too many attempts. Try again later.');
  if (!res.ok) return null;
  return (await res.json()) as { token: string };
}

export type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: Permission[];
  roleName: string;
  rank: number;
  assignableRoles: { key: string; name: string; rank: number }[];
};

/** The signed-in admin. Memoised per request, so layout and page share one API call. */
export const getMe = cache(() => adminApi<Me>('/me'));

/** Page guard: sends users without `permission` to the 403 page. Returns the current admin. */
export async function guard(permission: Permission): Promise<Me> {
  const me = await getMe();
  if (!me.permissions.includes(permission)) redirect('/admin/forbidden');
  return me;
}

export const can = (me: Me, permission: Permission) => me.permissions.includes(permission);

/** Upload an image to the media library; returns its id. Throws AdminApiError with a readable message. */
export async function adminUpload(file: File): Promise<string> {
  const token = await getToken();
  if (!token) redirect('/admin/login');
  if (file.size > 2 * 1024 * 1024) throw new AdminApiError(413, 'That image is larger than 2 MB.');
  const res = await fetch(`${API}/api/admin/media`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-internal-secret': process.env.REVALIDATE_SECRET ?? '',
      'Content-Type': file.type || 'application/octet-stream',
      'x-filename': file.name,
    },
    body: await file.arrayBuffer(),
  });
  if (res.status === 401) redirect('/admin/login?expired=1');
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !body.id) throw new AdminApiError(res.status, body.error ?? 'Upload failed');
  return body.id;
}
