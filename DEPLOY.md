# Deployment (Full Stack)

## Prerequisites

- Docker + Docker Compose v2
- External Docker network `nginx-network` already created

```bash
docker network ls | grep nginx-network || docker network create --subnet=10.200.0.0/24 nginx-network
```

## Configure Frontend API Endpoint

Frontend API base URL is bundled at build time from:

`frontend/src/config/config.json`

Set `storage.baseUrl` to your public API URL (for example `https://api.24swim.de`) before building.

## Manual Deploy

From repository root:

```bash
docker compose -f docker-compose.yml up -d --build
```

Use only the repository-root `docker-compose.yml` for server deployments. Do not run `backend/docker-compose.yml` or `frontend/docker-compose.yml` on the same host.

## Services

- Frontend: `10.200.0.8`
- Backend API: `10.200.0.9:5000`

Both are attached to external `nginx-network` network for reverse proxy routing.

## Update

```bash
git pull --ff-only
docker compose -f docker-compose.yml up -d --build
```

## Stop

```bash
docker compose -f docker-compose.yml down
```

## CI/CD (GitHub Actions)

Two workflows are included:

- `CI` in `.github/workflows/ci.yml`
  - Backend syntax + smoke test
  - Frontend tests + build
  - Docker image build check for frontend and backend
- `Deploy` in `.github/workflows/deploy.yml`
  - Triggered after successful CI on `main`/`master`
  - Can also be triggered manually (`workflow_dispatch`)
  - Deploys on server via SSH and runs `docker compose up -d --build`

### Required GitHub Secrets

Configure these in repository Settings -> Secrets and variables -> Actions:

- `DEPLOY_HOST`: SSH host/IP of your deployment server
- `DEPLOY_USER`: SSH user
- `DEPLOY_SSH_KEY`: private key (PEM/OpenSSH) for `DEPLOY_USER`
- `DEPLOY_PATH`: absolute path to the checked-out repository on the server

## Email Delivery (Mailgun)

Password-reset emails are sent via the Mailgun HTTP API directly from the
backend container. Credentials live in a `.env` file on the deploy server
next to `docker-compose.yml` — Docker Compose loads them automatically.

**Never commit this `.env` file. It is gitignored.**

On the server, create `${DEPLOY_PATH}/.env` with:

```ini
# Required
MAILGUN_API_KEY=key-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
MAILGUN_DOMAIN=mg.24swim.de

# Optional — use api.mailgun.net for US-region accounts.
# Default points to the EU region (most German Mailgun signups).
MAILGUN_BASE_URL=https://api.eu.mailgun.net/v3

# Optional — From header. Defaults to no-reply@${MAILGUN_DOMAIN}.
MAILGUN_FROM="24swim.de <no-reply@mg.24swim.de>"

# Optional — used in email links. Defaults to https://24swim.de.
APP_URL=https://24swim.de
```

After editing, restart the backend container:

```bash
docker compose -f docker-compose.yml up -d --build swimtrack_api
```

Steps to get the credentials:

1. Sign up at <https://signup.mailgun.com> (EU region recommended for GDPR).
2. Add and verify your sending domain (e.g. `mg.24swim.de`) by adding the
   DNS records Mailgun shows you to your DNS provider.
3. From "Sending → API Keys", copy the **Private API key** — this is the
   value for `MAILGUN_API_KEY`. Treat it like a password.
4. From "Sending → Domains", the domain you verified is `MAILGUN_DOMAIN`.

If `MAILGUN_API_KEY` or `MAILGUN_DOMAIN` is unset, the backend logs a
warning when a reset is requested and silently no-ops (the user still
sees a generic success message; no password is changed).

### Server bootstrap (one-time)

On the deployment server:

```bash
mkdir -p /opt/24h_swim
cd /opt/24h_swim
git clone <your-repo-url> .
docker network ls | grep nginx-network || docker network create --subnet=10.200.0.0/24 nginx-network
```

Then set `DEPLOY_PATH=/opt/24h_swim` in GitHub Secrets.
