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
backend container. Credentials flow from **GitHub Actions → Secrets** to
the server via the Deploy workflow, which writes a fresh `.env` next to
`docker-compose.yml` on every deploy (the file is owner-only, `chmod 600`).

**Never commit `.env`. It is gitignored.** You do not edit it manually on
the server — the workflow rewrites it each deploy.

### One-time: add the secrets

In **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Required? | Value |
|---|---|---|
| `MAILGUN_API_KEY` | yes | Private API key from Mailgun |
| `MAILGUN_DOMAIN` | yes | e.g. `mg.24swim.de` |
| `MAILGUN_BASE_URL` | no | `https://api.eu.mailgun.net/v3` (EU) or `https://api.mailgun.net/v3` (US). Defaults to EU. |
| `MAILGUN_FROM` | no | e.g. `24swim.de <no-reply@mg.24swim.de>`. Defaults to `no-reply@${MAILGUN_DOMAIN}`. |
| `APP_URL` | no | Public site URL used in email links. Defaults to `https://24swim.de`. |

Empty/missing secrets are skipped, and the corresponding `${VAR:-default}`
in `docker-compose.yml` falls back automatically.

### Getting the credentials

1. Sign up at <https://signup.mailgun.com> (EU region recommended for GDPR).
2. Add and verify your sending domain (e.g. `mg.24swim.de`) by adding the
   DNS records Mailgun shows you to your DNS provider.
3. From "Sending → API Keys", copy the **Private API key** — this is the
   value for `MAILGUN_API_KEY`. Treat it like a password.
4. From "Sending → Domains", the domain you verified is `MAILGUN_DOMAIN`.

### Rotating a key

1. Edit the secret in GitHub.
2. Re-run the Deploy workflow (manually via `workflow_dispatch`, or push
   a commit). The new `.env` overwrites the old one on the server.

### If Mailgun is unconfigured

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
