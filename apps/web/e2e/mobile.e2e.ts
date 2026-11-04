import { devices, expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test.use({ ...devices['Pixel 5'] });

test('mobile: menu opens, navigates, and the page does not scroll sideways', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByText('Menu', { exact: false }).first().click();
  await page.getByRole('banner').getByRole('link', { name: 'Robotics' }).click();
  await expect(page).toHaveURL(/\/category\/robotics$/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
