import { test, expect, type Locator } from '@playwright/test';

/** Formats a Date as the local `datetime-local` input value (YYYY-MM-DDTHH:mm:ss). */
function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

/**
 * A random point far in the past so a synthetic session's time window can't
 * collide with real-time sessions from other tests — or, on retry, with
 * leftover events from a previous failed attempt of the *same* test (whose
 * "now" would otherwise be only seconds away from this run's "now").
 */
function randomPastAnchor(): number {
  const oneDayMs = 24 * 60 * 60_000;
  return Date.now() - oneDayMs - Math.random() * 365 * oneDayMs;
}

/**
 * locator.fill() on `datetime-local` inputs is brittle across Chromium
 * versions (throws "Malformed value" even for well-formed strings in some
 * environments) — set the value directly instead.
 *
 * React overrides the native `value` setter on input elements to track
 * changes, so a plain `el.value = v` gets silently absorbed by React's
 * tracker before the dispatched event fires and onChange never runs. Calling
 * the native prototype setter first bypasses that override, so React sees a
 * real mismatch when the `input` event arrives and fires onChange as usual.
 */
async function setDateTimeLocal(locator: Locator, value: string): Promise<void> {
  await locator.evaluate((el: HTMLInputElement, v: string) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    nativeSetter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test('starting and stopping the timer logs a session', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByPlaceholder('What are you working on?').fill('E2E test session');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop timer' }).click();

  // Timer resets to idle once the session is saved
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 5000 });

  // Sessions can no longer overlap, so leave a real-time gap before whichever
  // test runs next also logs a session via the Timer.
  await page.waitForTimeout(1200);

  // Navigate to Sessions — the events drawer is expanded by default
  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page).toHaveURL('/sessions');

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

  // Sessions can no longer overlap, so leave a real-time gap before whichever
  // test runs next also logs a session via the Timer.
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: 'Sessions' }).click();
  await expect(page).toHaveURL('/sessions');

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

  const now = randomPastAnchor();
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

  const now = randomPastAnchor();
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

  const item = page.getByText('Movable session').locator('..').locator('..');
  await item.getByRole('button', { name: 'Edit session' }).click();

  // Drag "Movable session" back so it starts inside "Fixed session"'s interval.
  const overlappingStart = toLocalInputValue(new Date(now + 30_000));
  await setDateTimeLocal(page.locator('input[type="datetime-local"]').first(), overlappingStart);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(/overlaps an existing one/i)).toBeVisible({ timeout: 5000 });
  // The edit was rejected — the form stays open with the rejected value, not applied.
  await expect(page.getByPlaceholder('Task description')).toHaveValue('Movable session');
});
