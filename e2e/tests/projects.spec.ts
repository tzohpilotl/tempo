import { test, expect } from '@playwright/test';

test('creating a new project via the timer flow', async ({ page }) => {
  await page.goto('/dashboard');

  // Switch to the new-project input in the Timer
  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByPlaceholder('New project name…').fill('Playwright Project');

  // Start the timer, wait long enough that stopped_at > started_at, then stop
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop timer' }).click();

  // The timer resets to idle after saving
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 5000 });

  // Sessions can no longer overlap, so leave a real-time gap before whichever
  // test runs next also logs a session via the Timer.
  await page.waitForTimeout(1200);

  // Navigate to Projects and confirm the new project is listed.
  // Wait for the h1 heading before checking the list — the URL changes before
  // React finishes unmounting DashboardPage, so the Timer <select> and EventLog
  // project tags are still in the DOM until the new route's commit phase completes.
  await page.getByRole('button', { name: 'Projects' }).click();
  await expect(page).toHaveURL('/projects');
  await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Playwright Project', { exact: false })).toBeVisible({ timeout: 5000 });
});
