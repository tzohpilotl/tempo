import { test, expect } from '@playwright/test';

test('sidebar navigation buttons navigate to the correct pages', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page).toHaveURL('/sessions');

  await page.getByRole('button', { name: 'Projects' }).click();
  await expect(page).toHaveURL('/projects');

  await page.getByRole('button', { name: 'Timer' }).click();
  await expect(page).toHaveURL('/dashboard');
});
