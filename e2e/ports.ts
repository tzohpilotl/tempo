// Dedicated ports for the e2e test run, distinct from the normal dev ports
// (3000/5173) so Playwright never collides with — or has to kill — a dev
// server you're using for manual visual testing.
export const BACKEND_PORT = 3001;
export const FRONTEND_PORT = 5174;
