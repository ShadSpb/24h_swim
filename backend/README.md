# SwimTrack 24 — Backend API

Flask/SQLite REST API for a 24-hour swimming competition management system.

## Quick Start

```bash
pip install flask
python app.py
# API available at http://localhost:5001
```

## Configuration (environment variables)

| Variable | Default | Description |
|---|---|---|
| `SWIMTRACK_DB` | `swimtrack.db` | SQLite database file path |
| `SWIMTRACK_HOST` | `127.0.0.1` | Bind address (localhost by default for safety) |
| `SWIMTRACK_PORT` | `5001` | Port |
| `SWIMTRACK_API_KEY` | *(none)* | Optional `X-API-Key` auth header |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `FLASK_DEBUG` | `0` | Set `1` for debug mode |

## Docker

```bash
docker build -t swimtrack-api .
docker run -p 5000:5000 -v $(pwd)/data:/data -e SWIMTRACK_DB=/data/swimtrack.db swimtrack-api
```

## Security Notes

- SQLite DB file is hardened to owner-only permissions (`0600`) at runtime.
- API does not serve static files, and common DB filename paths are explicitly blocked.
- If you bind to a public interface (`0.0.0.0`), set `SWIMTRACK_API_KEY` and send `X-API-Key` from clients.

## Frontend Integration

In the frontend `config.json`, set:
```json
{
  "storage": { "type": "remote", "baseUrl": "http://your-server:5000" }
}
```

## API Endpoints (30 total)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/auth/register` | Register organizer |
| POST | `/auth/login` | Login (organizer or referee) |
| POST | `/auth/logout` | Logout |
| GET | `/auth/users` | List users |
| POST | `/auth/reset-password` | Reset user password |
| GET/POST | `/competitions` | List / create |
| GET/PUT/DELETE | `/competitions/<id>` | Read / update / delete |
| GET | `/competitions/<id>/stats` | Full leaderboard |
| GET | `/competitions/<id>/team-stats` | Team stats only |
| GET | `/competitions/<id>/swimmer-stats` | Swimmer stats only |
| GET/POST | `/teams` | List / create |
| PUT/DELETE | `/teams/<id>` | Update / delete |
| GET/POST | `/swimmers` | List / create |
| PUT/DELETE | `/swimmers/<id>` | Update / delete |
| GET/POST | `/referees` | List / create |
| DELETE | `/referees/<id>` | Delete |
| POST | `/referees/<id>/reset-password` | Reset referee password |
| GET/POST | `/swim-sessions` | List / start session |
| PUT | `/swim-sessions/<id>` | Update / end session |
| GET/POST | `/lap-counts` | List / record lap |

## Business Rules Enforced

- **Same color + same lane** → `400` (different lanes OK per RULES.md)
- **Under-12 swimmers** require `parentName` + `parentContact` → `400` if missing
- **One swimmer per team** in water simultaneously → `409` if violated
- **Competition must be active** to start sessions or count laps → `422`
- **Double-count timeout** per team (configurable, default 15s) → `429` with `Retry-After` header
- **Session check before double-count**: wrong lane/swimmer → `422`, not `429`
- **Cascade delete**: deleting a competition removes all teams, swimmers, referees, sessions, laps in correct FK order
- **Referee delete**: associated `lap_counts` rows are deleted first to respect FK constraint

## Password System

- **Storage**: backend stores only strong one-way password hashes (PBKDF2/scrypt), never cleartext.
- **Organizers**: password is hashed server-side on registration and reset.
- **Referees**: auto-generated `ref_#####` login ID + human-friendly password (e.g. `SwiftDolphin42`). Password is returned **once** on creation/reset; only its hash is stored.

## Running Tests

```bash
python test_e2e.py   # 147/147 tests, ~24s
```
