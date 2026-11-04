import { expect, type Page } from '@playwright/test';

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

export async function login(page: Page) {
  await page.goto('/admin/login');
  await page.fill('#email', 'admin@e2e.test');
  await page.fill('#password', 'e2e-password-12345');
  await page.click('button:has-text("Sign in")');
  await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
}
