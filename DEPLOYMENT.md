# Deployment Guide — DigitalOcean VPS + GitHub Actions

Pushes to `main` automatically build Docker images (via GitHub Actions) and deploy them to a DigitalOcean Droplet running Docker + Caddy (automatic TLS).

---

## Prerequisites

- A [DigitalOcean](https://digitalocean.com) account
- A domain name with DNS you can manage (e.g. Namecheap, Cloudflare)
- Google OAuth 2.0 credentials ([Google Cloud Console](https://console.cloud.google.com))
- The repository pushed to GitHub

---

## 1. Create a Droplet

In the DigitalOcean dashboard:

- **Image:** Ubuntu 24.04 LTS
- **Size:** Basic, $12/mo (2 GB RAM, 1 vCPU)
- **Region:** closest to you
- **Authentication:** SSH key (recommended)
- **Hostname:** `tempo` or similar

Once created, note the **IPv4 address**.

---

## 2. Point Your Domain at the Droplet

In your DNS provider, add an A record:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` (or subdomain e.g. `tempo`) | `<droplet-ip>` | 300 |

Verify with:

```bash
dig yourdomain.com A +short
```

Caddy cannot obtain a TLS certificate until DNS resolves correctly.

---

## 3. Initial Server Setup

SSH into the droplet:

```bash
ssh root@<droplet-ip>
```

Update packages:

```bash
apt update && apt upgrade -y
```

Set up a firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp   # HTTP/3 (QUIC)
ufw enable
```

---

## 4. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

---

## 5. Update Google Cloud Console

Your OAuth callback URL must use HTTPS and your real domain.

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Open your OAuth 2.0 Client ID
3. Under **Authorised redirect URIs**, add:
   ```
   https://yourdomain.com/api/auth/google/callback
   ```
4. Save

---

## 6. Set Up GitHub Actions

### Create a deploy SSH key

On your **local machine**, generate a dedicated key pair (no passphrase):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/tempo_deploy
```

Copy the public key to the server:

```bash
ssh-copy-id -i ~/.ssh/tempo_deploy.pub root@<droplet-ip>
```

### Add secrets to the GitHub repository

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value |
|--------|-------|
| `SSH_HOST` | Your droplet's IP address |
| `SSH_USERNAME` | `root` (or your deploy user) |
| `SSH_PRIVATE_KEY` | Contents of `~/.ssh/tempo_deploy` (the private key) |

GitHub's built-in `GITHUB_TOKEN` is used automatically to push images to GHCR — no additional secret needed for that.

---

## 7. First Deploy

### Give the server read access to the repository

The server needs to pull from GitHub when the Actions runner triggers a deploy. The simplest approach differs by repo visibility:

**Public repository** — no setup needed, skip to cloning below.

**Private repository** — create a read-only deploy key:

On the **server**, generate a key (no passphrase):

```bash
ssh-keygen -t ed25519 -C "tempo-vps-deploy" -f ~/.ssh/github_deploy
```

Print the public key:

```bash
cat ~/.ssh/github_deploy.pub
```

Add it to GitHub: **Repository → Settings → Deploy keys → Add deploy key**. Paste the public key, leave *Allow write access* unchecked.

Tell SSH to use this key for GitHub:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
    IdentityFile ~/.ssh/github_deploy
    IdentitiesOnly yes
EOF
```

### Clone the repository on the server

```bash
cd /opt
# Public repo:
git clone https://github.com/yourusername/time-tracker.git tempo
# Private repo:
git clone git@github.com:yourusername/time-tracker.git tempo
cd tempo
```

### Configure environment variables

```bash
cp .env.example .env
nano .env
```

Fill in all values:

```env
GITHUB_USERNAME=yourgithubusername

GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback

SESSION_SECRET=<output of: openssl rand -hex 32>

DOMAIN=yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Optional: restrict login to your own Google account
# ALLOWED_EMAIL=you@gmail.com
```

Generate a secure session secret:

```bash
openssl rand -hex 32
```

### Make GHCR images public (or log in on the server)

By default, GHCR packages are private. Either:

**Option A — Make packages public** (simpler): After the first push triggers a build, go to your GitHub profile → **Packages**, open each package (`time-tracker-backend`, `time-tracker-frontend`), and set visibility to **Public**.

**Option B — Authenticate on the server**: Log in with a [Personal Access Token](https://github.com/settings/tokens) (needs `read:packages` scope):

```bash
echo "<your-pat>" | docker login ghcr.io -u yourusername --password-stdin
```

### Pull images and start

Wait for the first GitHub Actions run to complete (check the **Actions** tab in your repo), then:

```bash
docker compose pull
docker compose up -d
```

---

## 8. Verify

Open `https://yourdomain.com` in your browser. You should see:

- A valid TLS certificate (padlock icon)
- The Tempo login page
- Successful Google login → redirect to `/dashboard` or `/onboarding`

Health check:

```bash
curl https://yourdomain.com/api/health
# {"status":"ok"}
```

---

## 9. Ongoing Deployments

Push to `main` and the pipeline handles everything automatically:

1. **build-backend** and **build-frontend** run in parallel — each builds its Docker image and pushes it to GHCR
2. **deploy** (runs after both builds succeed) — SSHes into the VPS, pulls the new images, and restarts containers

You can monitor runs in the **Actions** tab of your GitHub repository.

---

## 10. Operations

### View logs

```bash
docker compose logs -f backend    # NestJS application logs
docker compose logs -f frontend   # Caddy access + TLS logs
```

### Manual deploy (without pushing to main)

```bash
cd /opt/tempo
git pull
docker compose pull
docker compose up -d --remove-orphans
```

### Stop / start

```bash
docker compose stop
docker compose start
```

### Restart a single service

```bash
docker compose restart backend
```

---

## 11. Data Backup

The SQLite database lives in a Docker named volume (`sqlite_data`). Back it up by copying the file out of the volume:

```bash
docker run --rm \
  -v tempo_sqlite_data:/data \
  -v $(pwd)/backups:/backups \
  alpine cp /data/time-tracker.sqlite /backups/time-tracker-$(date +%Y%m%d).sqlite
```

Automate daily backups with cron:

```bash
crontab -e
```

```cron
0 3 * * * cd /opt/tempo && docker run --rm -v tempo_sqlite_data:/data -v /opt/tempo/backups:/backups alpine cp /data/time-tracker.sqlite /backups/time-tracker-$(date +\%Y\%m\%d).sqlite
```

---

## 12. Destroying / Rebuilding

Remove everything including data:

```bash
docker compose down -v   # ⚠️ deletes the SQLite volume — irreversible
```

Remove containers only (keep data):

```bash
docker compose down
```

---

## Security Notes

- TLS certificates are renewed automatically by Caddy — no cron job needed.
- Certificates are persisted in the `caddy_data` Docker volume and survive restarts.
- `SESSION_SECRET` must be a strong random value — never reuse across environments.
- If `ALLOWED_EMAIL` is not set, any Google account can log in.
- Port 3000 (NestJS) is never exposed to the internet — only Caddy's ports 80/443.
- The deploy SSH key should have minimal access (ideally a non-root user with access only to `/opt/tempo`).
