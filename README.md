# Tempo — Time Tracker

A local-first time tracking app. Log sessions, organise by project, see where your hours go.

Built with **NestJS** · **TypeORM + SQLite** · **React + Vite** · **Docker + Caddy**

---

## Table of Contents

- [Architecture](#architecture)
- [Security](#security)
- [Prerequisites](#prerequisites)
- [Google OAuth Setup](#google-oauth-setup)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)

---

## Architecture

```
┌─────────────────────────────────┐
│  Browser                        │
│  React SPA (Vite)  :5173 (dev) │
└────────────┬────────────────────┘
             │ /api/*  (proxied)
┌────────────▼────────────────────┐
│  NestJS Backend          :3000  │
│  ├── Auth (Google OAuth)        │
│  ├── Projects                   │
│  ├── Tracking Events            │
│  └── TypeORM → SQLite           │
└─────────────────────────────────┘

Production (Docker):
Browser → Caddy:443 (TLS) → /api/* → backend:3000
                           → /*     → React SPA (static, baked into Caddy image)
```

Sessions are cookie-based (express-session, httpOnly, secure), backed by a SQLite session store (`connect-sqlite3`). Both the app database and the session store are stored in the same named Docker volume and persist across container restarts and re-deploys. TLS certificates are provisioned automatically by Caddy via Let's Encrypt and persisted in a separate named volume.

---

## Security

This section documents the security architecture and the decisions behind it. These are active constraints, not aspirations.

### Authentication

- **Google OAuth 2.0 only.** No passwords, no local credentials. Authentication is fully delegated to Google.
- **Session cookies, not JWTs.** Sessions use `express-session` with `httpOnly` and `secure` flags. httpOnly prevents JavaScript from reading the cookie (XSS mitigation). The `secure` flag ensures cookies are only transmitted over HTTPS.
- **Session deserialization on every request.** Only the `user_id` is stored in the session. On each request, the full user record is fetched from the database. This means a deleted/blocked user loses access immediately without waiting for a token to expire.
- **google_id is never returned to the frontend.** The `/api/auth/me` endpoint strips the `google_id` field before responding.

### Access Control

- **Optional single-user allowlist.** Set `ALLOWED_EMAIL` in `.env` to your Google email address to prevent anyone else from creating an account. If unset, any Google account can sign up — appropriate for a shared or team install, but not for a personal deployment.
- **User data isolation.** Every database query filters by `user_id`. A user cannot access another user's projects or tracking events.

### Transport Security

- **TLS everywhere, managed by Caddy.** Caddy obtains and renews TLS certificates automatically from Let's Encrypt. Port 3000 (the NestJS process) is never exposed to the internet — only Caddy's ports 80 and 443 are bound on the host.
- **Reverse proxy trust.** `trust proxy 1` is set in Express so that the `X-Forwarded-Proto` header from Caddy is trusted. This ensures `secure` cookies are set correctly even though NestJS sees HTTP traffic internally.

### HTTP Security Headers

All responses carry the following headers, set by Caddy:

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year |
| `X-Frame-Options` | `DENY` | Block clickjacking |
| `X-Content-Type-Options` | `nosniff` | Block MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Content-Security-Policy` | Restricts to `'self'` with narrow exceptions | Block XSS resource loading |
| `Server` | *(removed)* | Don't reveal server software |

### Rate Limiting

- **Global: 100 requests / 60 s per IP** — applied to all routes via `ThrottlerGuard`.
- **Auth routes: 10 requests / 60 s per IP** — stricter limit on `/api/auth/google` and `/api/auth/google/callback` to slow down automated abuse.
- **Health endpoint: exempt** — Docker's own healthcheck would otherwise consume rate limit budget.

### Data

- **SQLite with TypeORM parameterised queries.** No raw SQL; ORM handles escaping.
- **Schema synchronisation is disabled in production.** Only enabled in development (`NODE_ENV !== 'production'`), preventing accidental schema mutation in prod.
- **Database not exposed.** SQLite lives in a Docker named volume, not bind-mounted to a predictable host path.

### Known Limitations

- **No CSRF protection.** The app relies on cookie `SameSite` defaults (`Lax`) rather than explicit CSRF tokens. This is adequate for a same-origin SPA that never accepts cross-origin form posts.
- **Single-replica only.** The SQLite session store and SQLite app database are both plain files and not shareable across multiple instances. Do not run more than one backend container replica.

---

## Prerequisites

- **Node.js** 20+
- **npm** 9+
- **Docker** + **Docker Compose** (for containerised deployment)
- A **Google Cloud** account (for OAuth credentials)

---

## Google OAuth Setup

You need a Google OAuth 2.0 client before the app can authenticate users.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add **Authorised redirect URIs**:
   - Local dev: `http://localhost:3000/api/auth/google/callback`
   - Production VPS: `https://yourdomain.com/api/auth/google/callback`
7. Copy the **Client ID** and **Client Secret** into your `.env`

---

## Local Development

### 1. Clone and install

```bash
git clone <repo-url>
cd time-tracker
npm install          # installs root workspace deps
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET
```

For local dev, set these in `.env`:

```env
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

### 3. Create the data directory

```bash
mkdir -p backend/data
```

### 4. Run both servers

```bash
# From the repo root — starts backend (:3000) and frontend (:5173) concurrently
npm run dev
```

Or run them separately:

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

> **Note on SQLite:** `better-sqlite3` requires native compilation. Running `npm install` inside Docker works automatically (build tools are installed in the Dockerfile). For local development on macOS or Windows, prebuilt binaries are available for common platforms and should install without issues.

---

## Docker Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for a full step-by-step guide targeting a DigitalOcean VPS.

### Quick start

```bash
cp .env.example .env
# Edit .env with production values — especially DOMAIN, SESSION_SECRET, and OAuth credentials
```

Minimum required for Docker:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
SESSION_SECRET=<output of: openssl rand -hex 32>
FRONTEND_URL=https://yourdomain.com
DOMAIN=yourdomain.com
```

```bash
docker compose up --build -d
```

Caddy will automatically provision a TLS certificate for the domain in `DOMAIN`.

### Logs

```bash
docker compose logs -f backend    # NestJS logs
docker compose logs -f frontend   # Caddy access + TLS logs
```

### Stop

```bash
docker compose down               # keeps data volumes
docker compose down -v            # also deletes data (⚠️ irreversible)
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | ✅ | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | ✅ | — | Full URL of the OAuth callback endpoint |
| `SESSION_SECRET` | ✅ | — | Secret for signing session cookies — use `openssl rand -hex 32` |
| `DOMAIN` | ✅ | `localhost` | Domain Caddy serves (and gets a TLS cert for) |
| `FRONTEND_URL` | ✅ | — | Frontend origin used for CORS and post-login redirect |
| `ALLOWED_EMAIL` | | *(unset)* | If set, only this Google email can log in |
| `DATABASE_PATH` | | `./data/time-tracker.sqlite` | Path to the SQLite file |
| `NODE_ENV` | | `development` | Set to `production` in Docker |

---

## API Reference

All endpoints are prefixed with `/api`. Protected routes require an active session cookie (set after Google login).

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/google` | — | Initiates Google OAuth flow |
| `GET` | `/auth/google/callback` | — | OAuth callback (handled by Google redirect) |
| `GET` | `/auth/me` | ✅ | Returns current user |
| `GET` | `/auth/logout` | — | Destroys session, redirects to `/login` |

### Projects

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| `GET` | `/projects` | ✅ | — | List all projects for current user |
| `POST` | `/projects` | ✅ | `{ name: string }` | Create a new project |

### Tracking

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| `GET` | `/tracking` | ✅ | — | List all sessions for current user |
| `POST` | `/tracking` | ✅ | See below | Log a completed timer session |

`POST /tracking` body:

```json
{
  "started_at": "2024-01-15T09:00:00.000Z",
  "stopped_at": "2024-01-15T10:30:00.000Z",
  "task_description": "Write tests",
  "project_id": "uuid-optional"
}
```

Response includes computed `duration_seconds` and a flattened `project` summary.

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: 'ok' }` — used by Docker healthcheck |

---

## Project Structure

```
time-tracker/
├── .env.example
├── .gitignore
├── package.json              # Monorepo workspace root
├── docker-compose.yml
├── DEPLOYMENT.md             # VPS deployment guide
│
├── backend/
│   ├── Dockerfile            # Multi-stage: build → runtime (non-root user)
│   ├── .dockerignore
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.ts           # Bootstrap: sessions, CORS, Passport, proxy trust
│       ├── app.module.ts     # Root module: ThrottlerModule, global ThrottlerGuard
│       ├── auth/             # Google OAuth, guards, session serializer
│       ├── projects/         # Projects CRUD
│       ├── tracking/         # Tracking events CRUD
│       ├── database/
│       │   ├── entities/     # TypeORM entities (User, Project, TrackingEvent)
│       │   └── repositories/ # Repository interfaces + SQLite implementations
│       └── common/           # Health controller (throttle-exempt)
│
└── frontend/
    ├── Dockerfile            # Multi-stage: Node build → caddy:alpine
    ├── .dockerignore
    ├── Caddyfile             # TLS, security headers, SPA routing, API proxy
    ├── vite.config.ts        # Proxies /api → backend in dev
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx            # React Router shell
        ├── types.ts           # Shared TypeScript interfaces
        ├── api/client.ts      # Typed API wrappers
        ├── hooks/useAuth.ts   # Session state hook
        ├── styles/global.css  # Design tokens + reset
        ├── pages/             # LoginPage, OnboardingPage, DashboardPage
        └── components/        # Sidebar, Timer, EventLog
```

---

## Swapping the Database

The repository layer is abstracted behind interfaces in `src/database/repositories/repository.interfaces.ts`. To swap SQLite for PostgreSQL on a VPS:

1. Install `pg` and `@types/pg`
2. Change `type: 'sqlite'` to `type: 'postgres'` in `app.module.ts` and add connection params
3. The rest of the application code is unchanged

For sessions, swap `connect-sqlite3` for `connect-pg-simple` and point it at the same Postgres instance — mainly useful if you also want to run more than one backend replica, since a single SQLite-backed session store already survives restarts/redeploys on its own.
