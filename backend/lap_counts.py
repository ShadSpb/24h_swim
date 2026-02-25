"""
lap_counts.py - Lap counting endpoints
GET  /lap-counts
POST /lap-counts   — session check first, then double-count (429), then insert
"""

import logging
from datetime import datetime, timezone
from flask import Blueprint, request
from database import get_db
from utils import new_uuid, ok, created, error, too_many_requests, serialize_lap_count

lap_counts_bp = Blueprint("lap_counts", __name__)
logger        = logging.getLogger(__name__)


def _parse_utc(ts: str):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


@lap_counts_bp.route("/lap-counts", methods=["GET"])
def list_lap_counts():
    competition_id = request.args.get("competitionId")
    team_id        = request.args.get("teamId")
    swimmer_id     = request.args.get("swimmerId")

    query  = "SELECT * FROM lap_counts WHERE 1=1"
    params = []
    if competition_id:
        query += " AND competition_id = ?"; params.append(competition_id)
    if team_id:
        query += " AND team_id = ?";        params.append(team_id)
    if swimmer_id:
        query += " AND swimmer_id = ?";     params.append(swimmer_id)
    query += " ORDER BY timestamp ASC"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()
    return ok([serialize_lap_count(dict(r)) for r in rows])


@lap_counts_bp.route("/lap-counts", methods=["POST"])
def record_lap():
    """
    Record a lap. Validation order:
      1. Required fields present             → 400
      2. Competition exists & is active      → 404 / 422
      3. Active swim session exists          → 422  (BEFORE double-count)
      4. Double-count timeout per team       → 429 with Retry-After
      5. Insert + sync session lap_count
    """
    data = request.get_json(silent=True) or {}

    required = ["competitionId", "laneNumber", "teamId", "swimmerId", "refereeId"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    competition_id = data["competitionId"]
    lane_number    = int(data["laneNumber"])
    team_id        = data["teamId"]
    swimmer_id     = data["swimmerId"]
    referee_id     = data["refereeId"]

    # 1. Competition status
    with get_db() as db:
        comp = db.execute(
            "SELECT status, double_count_timeout FROM competitions WHERE id=?",
            (competition_id,)
        ).fetchone()

    if not comp:
        return error("Competition not found", 404)
    comp = dict(comp)
    if comp["status"] != "active":
        return error(f"Counting not allowed — competition is {comp['status']}", 422)

    timeout_s = int(comp["double_count_timeout"])

    # 2. Active session must exist (check BEFORE double-count so we return 422, not 429)
    with get_db() as db:
        session = db.execute(
            """SELECT id FROM swim_sessions
               WHERE competition_id=? AND team_id=? AND swimmer_id=? AND lane_number=? AND is_active=1""",
            (competition_id, team_id, swimmer_id, lane_number)
        ).fetchone()
    if not session:
        return error("No active swim session found for this swimmer/team/lane", 422)

    # 3. Double-count protection
    if timeout_s > 0:
        with get_db() as db:
            last = db.execute(
                "SELECT timestamp FROM lap_counts WHERE competition_id=? AND team_id=? ORDER BY timestamp DESC LIMIT 1",
                (competition_id, team_id)
            ).fetchone()
        if last:
            last_ts = _parse_utc(dict(last)["timestamp"])
            if last_ts:
                elapsed = (datetime.now(timezone.utc) - last_ts).total_seconds()
                if elapsed < timeout_s:
                    retry_after = int(timeout_s - elapsed) + 1
                    logger.warning("Double count blocked: team=%s elapsed=%.1fs timeout=%ds",
                                   team_id, elapsed, timeout_s)
                    return too_many_requests("Double count detected", retry_after)

    # 4. Auto-calculate lap number if not provided
    with get_db() as db:
        total = db.execute(
            "SELECT COUNT(*) FROM lap_counts WHERE competition_id=? AND team_id=?",
            (competition_id, team_id)
        ).fetchone()[0]
    lap_number = int(data["lapNumber"]) if data.get("lapNumber") else (total + 1)

    # 5. Insert lap and sync session counter atomically
    lap_id  = new_uuid()
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    with get_db() as db:
        db.execute(
            "INSERT INTO lap_counts (id, competition_id, lane_number, team_id, swimmer_id, referee_id, lap_number, timestamp) VALUES (?,?,?,?,?,?,?,?)",
            (lap_id, competition_id, lane_number, team_id, swimmer_id, referee_id, lap_number, now_iso)
        )
        db.execute(
            "UPDATE swim_sessions SET lap_count=lap_count+1 WHERE competition_id=? AND team_id=? AND is_active=1",
            (competition_id, team_id)
        )
        db.commit()
        row = db.execute("SELECT * FROM lap_counts WHERE id=?", (lap_id,)).fetchone()

    logger.info("Lap %d: team=%s swimmer=%s lane=%d", lap_number, team_id, swimmer_id, lane_number)
    return created(serialize_lap_count(dict(row)))
