# Tempo — Time Tracker

A local-first time tracking app. Log sessions, organise by project, see where your hours go.

Built with **NestJS** · **TypeORM + SQLite** · **React + Vite** · **Docker**

---

## Table of Contents

- [Architecture](#architecture)
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
Browser → nginx:80 → /api/* → backend:3000
                   → /*     → React SPA (static)
```

Sessions are cookie-based (express-session). The SQLite database is stored in a named Docker volume and persists across container restarts and re-deploys.

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
   - Docker: `http://localhost/api/auth/google/callback`
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

> **Note on SQLite:** The backend uses `sqlite3` which requires native compilation. Running `npm install` inside Docker works automatically (build tools are installed in the Dockerfile). For local development on macOS or Windows, `sqlite3` prebuilt binaries are available for common platforms and should install without issues.

---

## Docker Deployment

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with production values
```

Minimum required for Docker:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost/api/auth/google/callback
SESSION_SECRET=<output of: openssl rand -hex 32>
FRONTEND_URL=http://localhost
```

### 2. Build and start

```bash
docker compose up --build -d
```

Open [http://localhost](http://localhost).

### 3. View logs

```bash
docker compose logs -f backend    # backend logs
docker compose logs -f frontend   # nginx logs
```

### 4. Stop

```bash
docker compose down               # keeps data volume
docker compose down -v            # also deletes data (⚠️ irreversible)
```

### Deploying to a VPS

1. Point your domain's DNS A record to the VPS IP
2. Update `.env`:
   ```env
   GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
   FRONTEND_URL=https://yourdomain.com
   ```
3. Add your domain to Google Cloud Console's authorised redirect URIs
4. Put a TLS-terminating reverse proxy (Caddy or nginx) in front of port 80, or update the Docker port mapping
5. `docker compose up --build -d`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | ✅ | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | ✅ | — | Full URL of the OAuth callback endpoint |
| `SESSION_SECRET` | ✅ | — | Secret for signing session cookies |
| `FRONTEND_URL` | ✅ | `http://localhost` | Frontend origin (for CORS + post-login redirect) |
| `DATABASE_PATH` | | `./data/time-tracker.sqlite` | Path to the SQLite file |
| `PORT` | | `80` | Host port for the nginx container |
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
│
├── backend/
│   ├── Dockerfile
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.ts           # Bootstrap: sessions, CORS, Passport
│       ├── app.module.ts     # Root module
│       ├── auth/             # Google OAuth, guards, session serializer
│       ├── projects/         # Projects CRUD
│       ├── tracking/         # Tracking events CRUD
│       ├── database/
│       │   ├── entities/     # TypeORM entities (User, Project, TrackingEvent)
│       │   └── repositories/ # Repository interfaces + SQLite implementations
│       └── common/           # Guards, decorators, health controller
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
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

For sessions, swap `memorystore` for `connect-pg-simple` and point it at the same Postgres instance.
