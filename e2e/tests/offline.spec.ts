import { test, expect } from '@playwright/test';

test('sessions page falls back to cached data when the network fails', async ({ page }) => {
  await page.request.post('/api/tracking', {
    data: {
      started_at: new Date(Date.now() - 30 * 60_000).toISOString(),
      stopped_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      task_description: 'Offline cache check',
    },
  });

  // Visit /sessions online first — this populates the IndexedDB cache for
  // its GET requests (projects list, summary, tracking list).
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page.getByText('Offline cache check')).toBeVisible({ timeout: 5000 });

  // Navigate away (unmounts SessionsPage), then block all API GETs and
  // navigate back — this remounts SessionsPage and forces a fresh fetch
  // that fails at the network level, without needing a full page reload
  // (which would need the service worker, not present in the dev server
  // this test suite runs against).
  await page.getByRole('button', { name: 'Projects' }).click();
  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Sessions' }).click();

  await expect(page.getByText('Offline cache check')).toBeVisible({ timeout: 5000 });
});

test('shows the offline banner when requests fail even though the browser still reports online', async ({ page }) => {
  // Simulates a dead Wi-Fi uplink or throttled cellular data: the OS still
  // reports a healthy network interface (navigator.onLine stays true — this
  // test never touches context.setOffline), but every actual request fails.
  await page.goto('/dashboard');
  await expect(page.getByText('Offline — showing last synced data')).not.toBeVisible();

  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Sessions' }).click();

  await expect(page.getByText('Offline — showing last synced data')).toBeVisible({ timeout: 5000 });
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
});

test('shows a retry message instead of a blank screen when nothing is cached yet', async ({ page }) => {
  // A fresh browser context has empty IndexedDB, so blocking the auth
  // check before the very first visit simulates a first-ever offline load.
  await page.route('**/api/auth/me', (route) => route.abort('internetdisconnected'));

  await page.goto('/dashboard');

  await expect(page.getByText(/can't reach tempo/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
