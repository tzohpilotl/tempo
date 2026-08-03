import { defineConfig, devices } from '@playwright/test';
import { BACKEND_PORT, FRONTEND_PORT } from './ports';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    storageState: '.auth/user.json',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // In CI we run the pre-built dist directly (build step happens before this).
      // Locally, nest start compiles on demand — or reuse a running test-mode backend.
      command: process.env.CI ? 'npm run start' : 'npx nest start',
      cwd: '../backend',
      port: BACKEND_PORT,
      // Runs on its own dedicated port (see ports.ts), so this only ever
      // reuses a previous e2e run's server — never a manual dev server.
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        DATABASE_PATH: ':memory:',
        SESSION_SECRET: 'test-secret-do-not-use-in-prod',
        ALLOWED_EMAIL: '',
        PORT: String(BACKEND_PORT),
        FRONTEND_URL: `http://localhost:${FRONTEND_PORT}`,
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
      },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: '../frontend',
      port: FRONTEND_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        BACKEND_PORT: String(BACKEND_PORT),
      },
    },
  ],
});
