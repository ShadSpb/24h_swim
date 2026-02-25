# Deployment (Full Stack)

## Prerequisites

- Docker + Docker Compose v2
- External Docker network `nginx` already created

```bash
docker network ls | grep nginx || docker network create --subnet=10.200.0.0/24 nginx
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

## Services

- Frontend: `10.200.0.8`
- Backend API: `10.200.0.9:5000`

Both are attached to external `nginx` network for reverse proxy routing.

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

### Server bootstrap (one-time)

On the deployment server:

```bash
mkdir -p /opt/24h_swim
cd /opt/24h_swim
git clone <your-repo-url> .
docker network ls | grep nginx || docker network create --subnet=10.200.0.0/24 nginx
```

Then set `DEPLOY_PATH=/opt/24h_swim` in GitHub Secrets.
