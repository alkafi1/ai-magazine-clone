'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AdminApiError, COOKIE, adminApi, adminLogin } from '@/lib/admin';

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/admin/login?error=1');
  let token: string | undefined;
  try {
    token = (await adminLogin(parsed.data.email, parsed.data.password))?.token;
  } catch (err) {
    if (err instanceof AdminApiError && err.status === 429) redirect('/admin/login?error=rate');
    throw err;
  }
  if (!token) redirect('/admin/login?error=1');
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: 12 * 3600, // matches the API token lifetime
  });
  redirect('/admin');
}

export async function logout() {
  (await cookies()).delete({ name: COOKIE, path: '/admin' });
  redirect('/admin/login');
}

const idSchema = z.string().regex(/^[a-f0-9]{24}$/);
const flag = z.enum(['true', 'false']).transform((v) => v === 'true');

export async function setHidden(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  const value = flag.parse(formData.get('value'));
  await adminApi(`/articles/${id}`, { method: 'PATCH', body: JSON.stringify({ isHidden: value }) });
  revalidatePath('/admin/articles');
}

export async function setFeatured(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  const value = flag.parse(formData.get('value'));
  await adminApi(`/articles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isFeatured: value }),
  });
  revalidatePath('/admin/articles');
}

export async function takedown(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  await adminApi(`/articles/${id}`, { method: 'DELETE' });
  revalidatePath('/admin/articles');
}

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const seoSchema = z.object({
  id: idSchema,
  metaTitle: z.preprocess(emptyToNull, z.string().max(70).nullable()),
  metaDescription: z.preprocess(emptyToNull, z.string().max(200).nullable()),
  ogImage: z.preprocess(emptyToNull, z.string().url().nullable()),
  noindex: z.preprocess((v) => v === 'on', z.boolean()),
});

export async function saveSeo(formData: FormData) {
  const parsed = seoSchema.safeParse(Object.fromEntries(formData));
  const id = String(formData.get('id') ?? '');
  if (!parsed.success) redirect(`/admin/articles/${id}?error=1`);
  const { id: articleId, ...seo } = parsed.data;
  await adminApi(`/articles/${articleId}`, { method: 'PATCH', body: JSON.stringify({ seo }) });
  revalidatePath('/admin/articles');
  redirect(`/admin/articles/${articleId}?saved=1`);
}

export async function runScrapeNow() {
  await adminApi('/scrape-runs', { method: 'POST' });
  redirect('/admin/scrape-runs?started=1');
}
