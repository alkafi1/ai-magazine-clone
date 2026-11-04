import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'e2e-password-12345';
export const API = 'http://localhost:4010';

/** Collects console errors / page exceptions (this includes CSP violations) so tests can assert none. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

export async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
  return raw.map((r) => JSON.parse(r));
}

export const meta = (page: Page, sel: string) =>
  page.locator(`head meta${sel}`).getAttribute('content');

export async function login(page: Page, email = 'admin@e2e.test', password = PASSWORD) {
  await page.goto('/admin/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button:has-text("Sign in")');
}

export async function loginOk(page: Page, email = 'admin@e2e.test') {
  await login(page, email);
  await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
}

/** Bearer token for calling the API directly, as a given user. */
export async function apiToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
  password = PASSWORD,
) {
  const res = await request.post(`${API}/api/admin/login`, { data: { email, password } });
  return (await res.json()).token as string;
}

export const navLinks = (page: Page) =>
  page.getByRole('navigation', { name: 'Admin' }).first().getByRole('link');
