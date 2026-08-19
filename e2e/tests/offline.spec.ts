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

test('stopping the timer while offline queues the session and syncs it once reachable again', async ({ page }) => {
  await page.goto('/dashboard');

  // Block every API call (not just tracking) — the more realistic dead-Wi-Fi
  // case, not a browser-level context.setOffline().
  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));

  await page.getByPlaceholder('What are you working on?').fill('Queued offline session');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop timer' }).click();

  // Optimistic UI: the session shows up immediately even though the create
  // request never reached the server, and the banner reflects the queue.
  await expect(page.getByText('Queued offline session')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/offline.*1 change pending sync/i)).toBeVisible({ timeout: 5000 });
  const queuedItem = page.getByTestId('session-item').filter({ hasText: 'Queued offline session' });
  await expect(queuedItem.getByText('Not synced')).toBeVisible();

  // Reconnect — unblock the API, then trigger a request (a client-side nav)
  // so networkFailing flips back to false, which is what wakes QueueSync up
  // (navigator.onLine never changed here, so its 'online' event never fires).
  await page.unroute('**/api/**');
  await page.getByRole('button', { name: 'Sessions' }).click();
  await page.getByRole('button', { name: 'Timer' }).click();

  await expect(page.getByText(/pending sync/i)).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Queued offline session')).toBeVisible();
  // Now a real, server-synced event — the badge should be gone too.
  await expect(page.getByTestId('session-item').filter({ hasText: 'Queued offline session' }).getByText('Not synced')).not.toBeVisible();

  // The session is now a real, server-synced event — reloading (which drops
  // anything still only held in the offline queue) must not lose it.
  await page.reload();
  await expect(page.getByText('Queued offline session')).toBeVisible({ timeout: 5000 });
});

test('editing a session queues the edit while offline and syncs it once reachable again', async ({ page }) => {
  await page.goto('/dashboard');

  const now = Date.now() - 24 * 60 * 60_000; // a day in the past, well clear of any other test's window
  const create = await page.request.post('/api/tracking', {
    data: {
      started_at: new Date(now).toISOString(),
      stopped_at: new Date(now + 15 * 60_000).toISOString(),
      task_description: 'Phase 3 edit target',
    },
  });
  expect(create.ok()).toBeTruthy();

  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page.getByText('Phase 3 edit target')).toBeVisible({ timeout: 5000 });

  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));

  const item = page.getByTestId('session-item').filter({ hasText: 'Phase 3 edit target' });
  await item.getByRole('button', { name: 'Edit session' }).click();
  await page.getByPlaceholder('Task description').fill('Phase 3 edited offline');
  await page.getByRole('button', { name: 'Save' }).click();

  // Optimistic UI: the edit shows immediately even though the PATCH never reached the server.
  await expect(page.getByText('Phase 3 edited offline')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/offline.*1 change pending sync/i)).toBeVisible({ timeout: 5000 });
  const editedItem = page.getByTestId('session-item').filter({ hasText: 'Phase 3 edited offline' });
  await expect(editedItem.getByText('Not synced')).toBeVisible();

  await page.unroute('**/api/**');
  await page.getByRole('button', { name: 'Timer' }).click();
  await page.getByRole('button', { name: 'Sessions' }).click();

  await expect(page.getByText(/pending sync/i)).not.toBeVisible({ timeout: 5000 });

  // Reloading (which drops anything still only held in the offline queue) must not lose the edit.
  await page.reload();
  await expect(page.getByText('Phase 3 edited offline')).toBeVisible({ timeout: 5000 });
});

test('deleting a session queues the delete while offline and it stays gone after syncing', async ({ page }) => {
  await page.goto('/dashboard');

  const now = Date.now() - 25 * 60 * 60_000;
  const create = await page.request.post('/api/tracking', {
    data: {
      started_at: new Date(now).toISOString(),
      stopped_at: new Date(now + 15 * 60_000).toISOString(),
      task_description: 'Phase 3 delete target',
    },
  });
  expect(create.ok()).toBeTruthy();

  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page.getByText('Phase 3 delete target')).toBeVisible({ timeout: 5000 });

  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));

  page.once('dialog', (dialog) => dialog.accept());
  const item = page.getByTestId('session-item').filter({ hasText: 'Phase 3 delete target' });
  await item.getByRole('button', { name: 'Delete session' }).click();

  // Optimistic UI: gone immediately even though the DELETE never reached the server.
  await expect(page.getByText('Phase 3 delete target')).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/offline.*1 change pending sync/i)).toBeVisible({ timeout: 5000 });

  await page.unroute('**/api/**');
  await page.getByRole('button', { name: 'Timer' }).click();
  await page.getByRole('button', { name: 'Sessions' }).click();

  await expect(page.getByText(/pending sync/i)).not.toBeVisible({ timeout: 5000 });

  await page.reload();
  await expect(page.getByText('Phase 3 delete target')).not.toBeVisible({ timeout: 5000 });
});

test('editing a session that is itself still an unsynced offline creation updates the queued creation in place', async ({ page }) => {
  await page.goto('/dashboard');

  await page.route('**/api/**', (route) => route.abort('internetdisconnected'));

  await page.getByPlaceholder('What are you working on?').fill('Still queued session');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop timer' }).click();
  await expect(page.getByText('Still queued session')).toBeVisible({ timeout: 5000 });

  // Edit it while its creation is still only queued (never reached the server).
  const item = page.getByTestId('session-item').filter({ hasText: 'Still queued session' });
  await item.getByRole('button', { name: 'Edit session' }).click();
  await page.getByPlaceholder('Task description').fill('Still queued, now edited');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Still queued, now edited')).toBeVisible({ timeout: 5000 });
  // Still just one pending change — the edit folded into the queued creation
  // rather than adding a second op.
  await expect(page.getByText(/offline.*1 change pending sync/i)).toBeVisible({ timeout: 5000 });

  await page.unroute('**/api/**');
  await page.getByRole('button', { name: 'Timer', exact: true }).click();
  await page.getByRole('button', { name: 'Sessions' }).click();

  await expect(page.getByText(/pending sync/i)).not.toBeVisible({ timeout: 5000 });

  // The session is now a real, server-synced event with the edited
  // description — reloading (which drops anything still only held in the
  // offline queue) must not lose it or revert the edit.
  await page.reload();
  await expect(page.getByText('Still queued, now edited')).toBeVisible({ timeout: 5000 });
});

test('shows a retry message instead of a blank screen when nothing is cached yet', async ({ page }) => {
  // A fresh browser context has empty IndexedDB, so blocking the auth
  // check before the very first visit simulates a first-ever offline load.
  await page.route('**/api/auth/me', (route) => route.abort('internetdisconnected'));

  await page.goto('/dashboard');

  await expect(page.getByText(/can't reach tempo/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
