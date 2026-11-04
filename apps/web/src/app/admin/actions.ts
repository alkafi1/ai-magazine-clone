'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AdminApiError, COOKIE, adminApi, adminLogin } from '@/lib/admin';

const SESSION_HOURS = 12;

async function setSession(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: SESSION_HOURS * 3600, // matches the API token lifetime
  });
}

/**
 * Run an admin action, then redirect back with ?ok= or ?err=. API errors become messages the user can
 * read; anything unexpected is rethrown. (redirect() throws, so it must be called outside the try.)
 */
async function act(back: string, ok: string, fn: () => Promise<unknown>): Promise<never> {
  let error: string | null = null;
  try {
    await fn();
  } catch (e) {
    if (e instanceof AdminApiError) error = e.message;
    else throw e;
  }
  const url = new URL(back, 'http://x');
  url.searchParams.delete('ok');
  url.searchParams.delete('err');
  url.searchParams.set(error ? 'err' : 'ok', error ?? ok);
  redirect(url.pathname + url.search);
}

// ---- session ---------------------------------------------------------------------------------
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
  await setSession(token);
  redirect('/admin');
}

export async function logout() {
  (await cookies()).delete({ name: COOKIE, path: '/admin' });
  redirect('/admin/login');
}

// ---- articles --------------------------------------------------------------------------------
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);
const flag = z.enum(['true', 'false']).transform((v) => v === 'true');
const BACK_ARTICLES = '/admin/articles';

export async function setHidden(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  const value = flag.parse(formData.get('value'));
  await act(
    String(formData.get('back') || BACK_ARTICLES),
    value ? 'Story hidden.' : 'Story restored.',
    async () => {
      await adminApi(`/articles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: value }),
      });
      revalidatePath('/admin/articles');
    },
  );
}

export async function setFeatured(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  const value = flag.parse(formData.get('value'));
  await act(
    String(formData.get('back') || BACK_ARTICLES),
    value ? 'Story featured.' : 'Story unfeatured.',
    async () => {
      await adminApi(`/articles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFeatured: value }),
      });
      revalidatePath('/admin/articles');
    },
  );
}

export async function takedown(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  await act(
    String(formData.get('back') || BACK_ARTICLES),
    'Story taken down (it now returns 410).',
    async () => {
      await adminApi(`/articles/${id}`, { method: 'DELETE' });
      revalidatePath('/admin/articles');
    },
  );
}

export async function bulkArticles(formData: FormData) {
  const ids = formData.getAll('ids').map((v) => idSchema.parse(v));
  const action = z.enum(['hide', 'restore', 'feature', 'unfeature']).parse(formData.get('action'));
  const back = String(formData.get('back') || BACK_ARTICLES);
  if (ids.length === 0)
    await act(back, '', async () => {
      throw new AdminApiError(400, 'Select at least one story first.');
    });
  await act(back, `${ids.length} stor${ids.length === 1 ? 'y' : 'ies'} updated (${action}).`, () =>
    adminApi('/articles/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) }),
  );
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
  if (!parsed.success)
    redirect(
      `/admin/articles/${id}?err=${encodeURIComponent('Check the values: title up to 70 characters, description up to 200, image must be a full https URL.')}`,
    );
  const { id: articleId, ...seo } = parsed.data;
  await act(
    `/admin/articles/${articleId}`,
    'SEO settings saved. The public page refreshes shortly.',
    async () => {
      await adminApi(`/articles/${articleId}`, { method: 'PATCH', body: JSON.stringify({ seo }) });
      revalidatePath('/admin/articles');
    },
  );
}

// ---- scraping --------------------------------------------------------------------------------
export async function runScrapeNow() {
  await act(
    '/admin/scrape-runs',
    'Run started. If another run is in progress this one is skipped. Reload in a minute.',
    () => adminApi('/scrape-runs', { method: 'POST' }),
  );
}

// ---- subscribers -----------------------------------------------------------------------------
export async function deleteSubscriber(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  await act(String(formData.get('back') || '/admin/subscribers'), 'Subscriber removed.', () =>
    adminApi(`/subscribers/${id}`, { method: 'DELETE' }),
  );
}

// ---- settings --------------------------------------------------------------------------------
const checked = (f: FormData, name: string) => f.get(name) === 'on';
const text = (f: FormData, name: string) => String(f.get(name) ?? '').trim();

export async function saveSiteSettings(formData: FormData) {
  const expires = text(formData, 'ann_expires');
  const body = {
    announcement: {
      enabled: checked(formData, 'ann_enabled'),
      text: text(formData, 'ann_text'),
      href: text(formData, 'ann_href'),
      tone: text(formData, 'ann_tone'),
      expiresAt: expires ? new Date(expires).toISOString() : '',
    },
    social: Object.fromEntries(
      ['x', 'linkedin', 'youtube', 'facebook', 'instagram'].map((k) => [
        k,
        text(formData, `social_${k}`),
      ]),
    ),
    analytics: { ga4Id: text(formData, 'ga4Id') },
    features: {
      newsletter: checked(formData, 'feat_newsletter'),
      darkModeToggle: checked(formData, 'feat_dark'),
    },
    footerNote: text(formData, 'footerNote'),
  };
  await act('/admin/settings', 'Site settings saved. Public pages refresh within a minute.', () =>
    adminApi('/settings/site', { method: 'PUT', body: JSON.stringify(body) }),
  );
}

export async function saveAdsSettings(formData: FormData) {
  const placement = (k: string) => ({
    enabled: checked(formData, `p_${k}_enabled`),
    slotId: text(formData, `p_${k}_slotId`),
    html: String(formData.get(`p_${k}_html`) ?? '').trim(),
  });
  const body = {
    enabled: checked(formData, 'enabled'),
    provider: text(formData, 'provider'),
    adsenseClientId: text(formData, 'adsenseClientId'),
    autoAds: checked(formData, 'autoAds'),
    consentRequired: checked(formData, 'consentRequired'),
    inFeedEvery: Number(text(formData, 'inFeedEvery')) || 6,
    placements: Object.fromEntries(
      ['headerBanner', 'inFeed', 'sidebar', 'articleTop', 'articleBottom'].map((k) => [
        k,
        placement(k),
      ]),
    ),
    scriptHosts: String(formData.get('scriptHosts') ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
    adsTxt: String(formData.get('adsTxt') ?? '').trim(),
  };
  await act('/admin/ads', 'Ad settings saved. Public pages refresh within a minute.', () =>
    adminApi('/settings/ads', { method: 'PUT', body: JSON.stringify(body) }),
  );
}

// ---- users -----------------------------------------------------------------------------------
export async function createUser(formData: FormData) {
  const body = {
    email: text(formData, 'email'),
    name: text(formData, 'name'),
    role: text(formData, 'role'),
    password: String(formData.get('password') ?? ''),
  };
  await act('/admin/users', `Account created for ${body.email}.`, () =>
    adminApi('/users', { method: 'POST', body: JSON.stringify(body) }),
  );
}

export async function updateUser(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  const body: Record<string, unknown> = {};
  const role = text(formData, 'role');
  if (role) body.role = role;
  if (formData.has('name')) body.name = text(formData, 'name');
  if (formData.has('active')) body.active = flag.parse(formData.get('active'));
  if (formData.get('unlock') === 'true') body.unlock = true;
  await act('/admin/users', 'Account updated. Their sessions now use the new settings.', () =>
    adminApi(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  );
}

export async function resetUserPassword(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  await act('/admin/users', 'Password reset. The user has been signed out everywhere.', () =>
    adminApi(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password: String(formData.get('password') ?? '') }),
    }),
  );
}

export async function deleteUser(formData: FormData) {
  const id = idSchema.parse(formData.get('id'));
  await act('/admin/users', 'Account deleted.', () =>
    adminApi(`/users/${id}`, { method: 'DELETE' }),
  );
}

// ---- my account ------------------------------------------------------------------------------
export async function updateProfile(formData: FormData) {
  await act('/admin/account', 'Profile updated.', () =>
    adminApi('/me', { method: 'PATCH', body: JSON.stringify({ name: text(formData, 'name') }) }),
  );
}

export async function changePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  if (password !== String(formData.get('confirm') ?? '')) {
    redirect(`/admin/account?err=${encodeURIComponent('The new passwords do not match.')}`);
  }
  await act('/admin/account', 'Password changed. Other sessions were signed out.', async () => {
    const res = await adminApi<{ token: string }>('/me/password', {
      method: 'POST',
      body: JSON.stringify({ current: String(formData.get('current') ?? ''), password }),
    });
    await setSession(res.token); // keep this browser signed in with the new token
  });
}
