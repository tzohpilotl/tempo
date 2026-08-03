import { test, expect } from '@playwright/test';

/** Formats a Date as the local `datetime-local` input value (YYYY-MM-DDTHH:mm:ss). */
function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

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

test('editing and deleting a session', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByPlaceholder('What are you working on?').fill('Editable session');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop timer' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page).toHaveURL('/sessions');
  await page.locator('button[aria-expanded="false"]').click();

  const item = page.getByText('Editable session').locator('..').locator('..');
  await item.getByRole('button', { name: 'Edit session' }).click();

  await page.getByPlaceholder('Task description').fill('Edited session');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Edited session')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Editable session')).not.toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const editedItem = page.getByText('Edited session').locator('..').locator('..');
  await editedItem.getByRole('button', { name: 'Delete session' }).click();

  await expect(page.getByText('Edited session')).not.toBeVisible({ timeout: 5000 });
});

test('creating an overlapping session via the API is rejected', async ({ page }) => {
  await page.goto('/dashboard');

  // Anchored well in the past so this synthetic window can't collide with
  // real-time sessions created by other tests in this run.
  const now = Date.now() - 24 * 60 * 60_000;
  const base = await page.request.post('/api/tracking', {
    data: {
      started_at: new Date(now).toISOString(),
      stopped_at: new Date(now + 60_000).toISOString(),
      task_description: 'Overlap base',
    },
  });
  expect(base.ok()).toBeTruthy();

  const conflicting = await page.request.post('/api/tracking', {
    data: {
      started_at: new Date(now + 30_000).toISOString(),
      stopped_at: new Date(now + 90_000).toISOString(),
      task_description: 'Overlap conflict',
    },
  });
  expect(conflicting.status()).toBe(409);
});

test('editing a session to overlap another is rejected', async ({ page }) => {
  await page.goto('/dashboard');

  // A different anchor than the previous test, still well clear of real time.
  const now = Date.now() - 48 * 60 * 60_000;
  const first = await page.request.post('/api/tracking', {
    data: {
      started_at: new Date(now).toISOString(),
      stopped_at: new Date(now + 60_000).toISOString(),
      task_description: 'Fixed session',
    },
  });
  expect(first.ok()).toBeTruthy();

  const second = await page.request.post('/api/tracking', {
    data: {
      started_at: new Date(now + 120_000).toISOString(),
      stopped_at: new Date(now + 180_000).toISOString(),
      task_description: 'Movable session',
    },
  });
  expect(second.ok()).toBeTruthy();

  await page.goto('/sessions');
  await page.locator('button[aria-expanded="false"]').click();

  const item = page.getByText('Movable session').locator('..').locator('..');
  await item.getByRole('button', { name: 'Edit session' }).click();

  // Drag "Movable session" back so it starts inside "Fixed session"'s interval.
  const overlappingStart = toLocalInputValue(new Date(now + 30_000));
  await page.locator('input[type="datetime-local"]').first().fill(overlappingStart);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(/overlaps an existing one/i)).toBeVisible({ timeout: 5000 });
  // The edit was rejected — the form stays open with the rejected value, not applied.
  await expect(page.getByPlaceholder('Task description')).toHaveValue('Movable session');
});
