import { test, expect } from '@playwright/test';
import { FRONTEND_PORT } from '../ports';

// Deliberately does not use the default page fixture — that one is preloaded
// with the shared storageState (.auth/user.json) every other spec relies on.
// Logging out for real destroys the session server-side, so this test opens
// its own isolated browser context with its own test-login session, leaving
// the shared session untouched for every test that runs after it.
//
// @playwright/test's `browser` fixture merges the project's `use` config
// (baseURL, storageState, ...) into any browser.newContext() call, filling in
// whatever you don't explicitly override. storageState must be overridden
// here — otherwise this "isolated" context starts out holding the *shared*
// session cookie, and test-login's req.login() regenerates (destroying) it as
// part of creating this test's own session, permanently breaking every other
// spec's .auth/user.json before this test even gets to its own logout call.
test('logging out destroys the session and returns to the login page', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    storageState: { cookies: [], origins: [] },
  });
  const loginRes = await context.request.get('/api/auth/test-login');
  expect(loginRes.ok()).toBe(true);

  const page = await context.newPage();
  await page.goto('/dashboard');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/login');

  // The session must be gone server-side too, not just the client-side redirect.
  const meRes = await context.request.get('/api/auth/me');
  expect(meRes.status()).toBe(401);

  await context.close();
});
