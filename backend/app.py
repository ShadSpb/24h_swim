"""
app.py - SwimTrack 24 API Server

Endpoints:
  POST /auth/login         POST /auth/register
  GET/POST/PUT/DELETE /competitions
  GET /competitions/<id>/stats   /team-stats   /swimmer-stats
  GET/POST/PUT/DELETE /teams
  GET/POST/PUT/DELETE /swimmers
  GET/POST/DELETE /referees      POST /referees/<id>/reset-password
  GET/POST/PUT /swim-sessions
  GET/POST /lap-counts
  GET /health
"""

import os
import re
import logging
from flask import Flask, jsonify, request, g
from database import init_db
import response_cache
from auth import auth_bp
from competitions import competitions_bp
from teams import teams_bp
from swimmers import swimmers_bp
from referees import referees_bp
from swim_sessions import sessions_bp
from lap_counts import lap_counts_bp
from stats import stats_bp
from feedback import feedback_bp
import authz

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> Flask:
    # Disable Flask static file serving to avoid accidental file exposure.
    app = Flask(__name__, static_folder=None)
    init_db()

    for bp in (auth_bp, competitions_bp, teams_bp, swimmers_bp,
               referees_bp, sessions_bp, lap_counts_bp, stats_bp, feedback_bp):
        app.register_blueprint(bp)

    # ── CORS ──────────────────────────────────────────────────────────────────
    allowed_origins = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:8080,https://24swim.de"
    ).split(",")

    @app.after_request
    def add_cors(response):
        origin = request.headers.get("Origin", "")
        if origin in allowed_origins or "*" in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
        else:
            response.headers["Access-Control-Allow-Origin"] = allowed_origins[0]
        response.headers["Access-Control-Allow-Methods"]     = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"]     = "Content-Type, Authorization, X-API-Key"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    @app.before_request
    def handle_options():
        if request.method == "OPTIONS":
            return app.make_default_options_response()

    # ── Basic sensitive-path guard ────────────────────────────────────────────
    # Flask does not expose arbitrary files by default, but block common DB
    # filenames explicitly as defense-in-depth.
    _blocked_suffixes = (".db", ".db-wal", ".db-shm", ".sqlite", ".sqlite3")

    @app.before_request
    def block_sensitive_paths():
        path = request.path.lower()
        if any(path.endswith(sfx) for sfx in _blocked_suffixes):
            return jsonify({"error": "Not found"}), 404

    # ── Optional API key guard ─────────────────────────────────────────────────
    API_KEY = os.environ.get("SWIMTRACK_API_KEY", "")

    @app.before_request
    def check_api_key():
        if request.path == "/health" or request.method == "OPTIONS":
            return None
        if request.path in ("/auth/login", "/auth/register", "/auth/forgot-password", "/faq/question"):
            return None
        if API_KEY and request.headers.get("X-API-Key", "") != API_KEY:
            return jsonify({"error": "Invalid or missing API key"}), 401

    # ── Authentication / authorization ─────────────────────────────────────────
    # Order matters: resolve identity first, then throttle abuse-prone POSTs,
    # then block anonymous access to everything outside the public allowlist.
    # Fine-grained ownership checks live inside the individual handlers.
    @app.before_request
    def _load_identity():
        return authz.load_identity()

    @app.before_request
    def _rate_limit():
        return authz.rate_limit_guard()

    @app.before_request
    def _require_login():
        return authz.require_login_gate()

    # ── Short-TTL response cache for anonymous public reads ─────────────────────
    # The live monitor polls these read endpoints every few seconds from every
    # open spectator screen; the payloads grow all day as lap_counts fills up.
    # Caching the ANONYMOUS response for a couple of seconds collapses all those
    # identical polls into one computation per competition, which is what keeps
    # CPU/memory flat under many viewers. Authenticated callers (organizers /
    # referees) are never served from cache, so counting stays real-time.
    _CACHE_TTL = float(os.environ.get("SWIMTRACK_CACHE_TTL", "8"))
    _CACHEABLE_GET_RE = [re.compile(r) for r in (
        r"^/competitions$",
        r"^/competitions/[^/]+$",
        r"^/competitions/[^/]+/(stats|team-stats|swimmer-stats)$",
        r"^/teams$",
        r"^/swimmers$",
        r"^/lap-counts$",
    )]

    def _is_cacheable_request() -> bool:
        if _CACHE_TTL <= 0 or request.method != "GET":
            return False
        if getattr(g, "user", None) is not None:  # anonymous spectators only
            return False
        return any(rx.match(request.path) for rx in _CACHEABLE_GET_RE)

    def _cache_key() -> str:
        return request.full_path  # path + '?' + query string

    @app.before_request
    def _serve_from_cache():
        if not _is_cacheable_request():
            return None
        hit = response_cache.get(_cache_key())
        if hit is None:
            return None
        status, content_type, body = hit
        resp = app.response_class(body, status=status, content_type=content_type)
        resp.headers["X-Cache"] = "HIT"
        return resp

    @app.after_request
    def _store_in_cache(response):
        if (_is_cacheable_request()
                and response.status_code == 200
                and "X-Cache" not in response.headers
                and not response.direct_passthrough):
            try:
                response_cache.set(
                    _cache_key(), response.status_code,
                    response.content_type, response.get_data(), _CACHE_TTL,
                )
                response.headers["X-Cache"] = "MISS"
            except Exception:  # never let caching break a response
                logger.exception("response cache store failed")
        return response

    # ── Error handlers ─────────────────────────────────────────────────────────
    @app.errorhandler(404)
    def e404(e): return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def e405(e): return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def e500(e):
        logger.exception("Unhandled exception")
        return jsonify({"error": "Internal server error"}), 500

    @app.route("/api-docs")
    def api_docs():
        return jsonify({"openapi":"3.0.0","info":{"title":"SwimTrack 24 API","version":"1.0.0"}}), 200

    # ── Health ─────────────────────────────────────────────────────────────────
    @app.route("/health")
    def health():
        from database import get_db
        try:
            with get_db() as db:
                db.execute("SELECT 1").fetchone()
            ok = True
        except Exception:
            ok = False
        return jsonify({"status": "ok" if ok else "degraded", "database": "ok" if ok else "error", "version": "1.0.0"}), 200 if ok else 503

    return app


if __name__ == "__main__":
    # Safe default: listen only on localhost unless explicitly configured.
    host  = os.environ.get("SWIMTRACK_HOST", "127.0.0.1")
    port  = int(os.environ.get("SWIMTRACK_PORT", "5001"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    if host not in ("127.0.0.1", "localhost", "::1") and not os.environ.get("SWIMTRACK_API_KEY"):
        logger.warning(
            "API is bound to a non-localhost interface without SWIMTRACK_API_KEY. "
            "Set SWIMTRACK_API_KEY to prevent unauthorized external writes."
        )
    logger.info("Starting SwimTrack API on %s:%d", host, port)
    create_app().run(host=host, port=port, debug=debug)
