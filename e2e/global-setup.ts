import { request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export default async function globalSetup() {
  const authFile = path.join(__dirname, '.auth/user.json');
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Call the test-login endpoint through the Vite proxy so the session cookie
  // is scoped to localhost:5173 (the same origin the browser tests run against).
  const context = await request.newContext({ baseURL: 'http://localhost:5173' });
  const res = await context.get('/api/auth/test-login');
  if (!res.ok()) {
    throw new Error(`Test login failed: ${res.status()} — ${await res.text()}`);
  }
  await context.storageState({ path: authFile });
  await context.dispose();
}
