import { test, expect } from '@playwright/test';

test('starting and stopping the timer logs a session', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByPlaceholder('What are you working on?').fill('E2E test session');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop timer' }).click();

  // Timer resets to idle once the session is saved
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 5000 });

  // Navigate to Sessions and expand the collapsible sessions drawer
  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page).toHaveURL('/sessions');

  await page.locator('button[aria-expanded="false"]').click();

  // The saved task description should appear in the list
  await expect(page.getByText('E2E test session')).toBeVisible({ timeout: 5000 });
});
