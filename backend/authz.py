"""
authz.py - Authentication & authorization layer.

The backend previously trusted any caller: login issued no token and no
endpoint checked identity, so anyone with the API URL could read personal
data, forge lap counts, or spam the email endpoints. This module adds:

  * server-side bearer sessions (issued on login, stored in the `sessions`
    table so they can be revoked on logout / password change),
  * a request-level identity loader (sets `g.user`),
  * a coarse gate that blocks anonymous access to everything except a small
    public allowlist (the live monitor's read endpoints + the public auth
    and FAQ endpoints),
  * fine-grained ownership helpers used inside handlers (organizer owns the
    competition; referee is assigned to it),
  * a small in-process rate limiter for the abuse-prone POST endpoints.

The app runs as a single Werkzeug process (see app.py CMD), so an in-memory
rate-limit store is sufficient.
"""

import re
import time
import secrets
import logging
from flask import g, request, jsonify

from database import get_db

logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days


# ── Session lifecycle ─────────────────────────────────────────────────────────

def create_session(user_id: str, role: str) -> str:
    """Issue and persist a new bearer token for a user."""
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with get_db() as db:
        db.execute(
            "INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?,?,?,?,?)",
            (token, user_id, role, now, now + SESSION_TTL_SECONDS),
        )
        db.commit()
    return token


def delete_session(token: str) -> None:
    if not token:
        return
    with get_db() as db:
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        db.commit()


def delete_sessions_for_user(user_id: str) -> None:
    """Revoke every session for a user (used on password reset/change)."""
    if not user_id:
        return
    with get_db() as db:
        db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        db.commit()


def _bearer_token() -> str | None:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip() or None
    return None


def load_identity() -> None:
    """before_request: resolve the bearer token into g.user (or None)."""
    g.user = None
    g.token = None
    token = _bearer_token()
    if not token:
        return
    with get_db() as db:
        row = db.execute(
            """SELECT s.user_id, s.role, s.expires_at, u.email
               FROM sessions s JOIN users u ON u.id = s.user_id
               WHERE s.token = ?""",
            (token,),
        ).fetchone()
    if not row:
        return
    row = dict(row)
    if int(row["expires_at"]) < int(time.time()):
        delete_session(token)
        return
    g.user = {"id": row["user_id"], "role": row["role"], "email": row["email"]}
    g.token = token


def current_user() -> dict | None:
    return getattr(g, "user", None)


# ── Coarse anonymous gate ─────────────────────────────────────────────────────
# Public, unauthenticated surface: the live monitor reads competition metadata
# and the aggregate /stats endpoints; the auth + FAQ POSTs are public by design.
_PUBLIC_POST = {
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/faq/question",
}
_PUBLIC_GET_RE = [
    re.compile(r) for r in (
        r"^/health$",
        r"^/api-docs$",
        r"^/competitions$",
        r"^/competitions/[^/]+$",
        r"^/competitions/[^/]+/(stats|team-stats|swimmer-stats)$",
        # The public live monitor aggregates standings client-side from these
        # reads. The handlers still require a competition scope (no whole-table
        # dump) and strip swimmer PII (DOB / parent contact) for non-owners.
        r"^/teams$",
        r"^/swimmers$",
        r"^/lap-counts$",
    )
]


def is_public_request() -> bool:
    if request.method == "OPTIONS":
        return True
    # HEAD is a bodyless GET — used by the container healthcheck
    # (`wget --spider /health`) and by caches. Treat it like GET against the
    # public allowlist so the healthcheck isn't gated to a 401.
    if request.method in ("GET", "HEAD"):
        return any(rx.match(request.path) for rx in _PUBLIC_GET_RE)
    if request.method == "POST":
        return request.path in _PUBLIC_POST
    return False


def require_login_gate():
    """before_request: block anonymous callers outside the public allowlist."""
    if is_public_request():
        return None
    if current_user() is None:
        return jsonify({"error": "Authentication required"}), 401
    return None


# ── Ownership / membership helpers (called inside handlers) ────────────────────

def _competition_owner(cid: str) -> str | None:
    with get_db() as db:
        row = db.execute("SELECT organizer_id FROM competitions WHERE id = ?", (cid,)).fetchone()
    return dict(row)["organizer_id"] if row else None


def is_owner(cid: str) -> bool:
    u = current_user()
    return bool(u and u["role"] == "organizer" and _competition_owner(cid) == u["id"])


def referee_record(cid: str) -> dict | None:
    """The referee row linking the current user to this competition, if any."""
    u = current_user()
    if not u or u["role"] != "referee":
        return None
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM referees WHERE competition_id = ? AND user_id = ?",
            (cid, u["id"]),
        ).fetchone()
    return dict(row) if row else None


def is_member(cid: str) -> bool:
    """Organizer who owns the competition, or a referee assigned to it."""
    return is_owner(cid) or referee_record(cid) is not None


def require_owner(cid: str):
    """Return a 401/403 response, or None when the caller owns the competition."""
    if current_user() is None:
        return jsonify({"error": "Authentication required"}), 401
    if not is_owner(cid):
        return jsonify({"error": "Forbidden"}), 403
    return None


def require_member(cid: str):
    if current_user() is None:
        return jsonify({"error": "Authentication required"}), 401
    if not is_member(cid):
        return jsonify({"error": "Forbidden"}), 403
    return None


# ── Rate limiting (in-process, per client) ────────────────────────────────────

_rl_store: dict[str, list[float]] = {}

# path -> (max_calls, window_seconds)
_RATE_LIMITS = {
    "/auth/login":           (30, 300),
    "/auth/register":        (5, 3600),
    "/auth/forgot-password": (5, 3600),
    "/auth/reset-password":  (10, 3600),
    "/faq/question":         (5, 3600),
}


def _client_ip() -> str:
    # Behind the nginx frontend; trust the first X-Forwarded-For hop if present.
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _allow(key: str, max_calls: int, window: float) -> bool:
    now = time.time()
    bucket = _rl_store.setdefault(key, [])
    cutoff = now - window
    while bucket and bucket[0] < cutoff:
        bucket.pop(0)
    if len(bucket) >= max_calls:
        return False
    bucket.append(now)
    return True


def rate_limit_guard():
    """before_request: throttle abuse-prone POST endpoints per client IP."""
    if request.method != "POST":
        return None
    limit = _RATE_LIMITS.get(request.path)
    if not limit:
        return None
    max_calls, window = limit
    if not _allow(f"{request.path}:{_client_ip()}", max_calls, window):
        logger.warning("Rate limit hit: %s from %s", request.path, _client_ip())
        return jsonify({"error": "Too many requests. Please try again later."}), 429
    return None
