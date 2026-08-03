import { request } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FRONTEND_PORT } from './ports';

export default async function globalSetup() {
  const authFile = path.join(__dirname, '.auth/user.json');
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Call the test-login endpoint through the Vite proxy so the session cookie
  // is scoped to the e2e frontend origin (the same origin the browser tests run against).
  const context = await request.newContext({ baseURL: `http://localhost:${FRONTEND_PORT}` });
  const res = await context.get('/api/auth/test-login');
  if (!res.ok()) {
    throw new Error(`Test login failed: ${res.status()} — ${await res.text()}`);
  }
  await context.storageState({ path: authFile });
  await context.dispose();
}
