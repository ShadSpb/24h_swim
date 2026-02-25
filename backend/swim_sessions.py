"""
swim_sessions.py - Swim session endpoints
GET  /swim-sessions
POST /swim-sessions
PUT  /swim-sessions/<id>
"""

import logging
from flask import Blueprint, request
from database import get_db
from utils import (
    new_uuid, ok, created, error, not_found, conflict,
    serialize_session,
)

sessions_bp = Blueprint("swim_sessions", __name__)
logger      = logging.getLogger(__name__)


@sessions_bp.route("/swim-sessions", methods=["GET"])
def list_sessions():
    competition_id = request.args.get("competitionId")
    team_id        = request.args.get("teamId")
    is_active_str  = request.args.get("isActive")

    query  = "SELECT * FROM swim_sessions WHERE 1=1"
    params = []

    if competition_id:
        query += " AND competition_id = ?"
        params.append(competition_id)
    if team_id:
        query += " AND team_id = ?"
        params.append(team_id)
    if is_active_str is not None:
        query += " AND is_active = ?"
        params.append(1 if is_active_str.lower() in ("true", "1") else 0)

    query += " ORDER BY start_time DESC"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()

    return ok([serialize_session(dict(r)) for r in rows])


@sessions_bp.route("/swim-sessions", methods=["POST"])
def create_session():
    """
    Start a new swim session.
    RULES: only one swimmer per team can be in the water at a time.
    """
    data = request.get_json(silent=True) or {}

    required = ["competitionId", "swimmerId", "teamId", "laneNumber"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    competition_id = data["competitionId"]
    swimmer_id     = data["swimmerId"]
    team_id        = data["teamId"]
    lane_number    = int(data["laneNumber"])

    # Validate competition is active
    with get_db() as db:
        comp = db.execute(
            "SELECT status FROM competitions WHERE id = ?", (competition_id,)
        ).fetchone()
    if not comp:
        return error("Competition not found", 404)
    if dict(comp)["status"] != "active":
        return error(f"Competition is not active (status: {dict(comp)['status']})")

    # RULES: one swimmer per team in water at a time
    with get_db() as db:
        active = db.execute(
            """SELECT id FROM swim_sessions
               WHERE competition_id = ? AND team_id = ? AND is_active = 1""",
            (competition_id, team_id),
        ).fetchone()
    if active:
        return conflict("Team already has an active swimmer")

    # Validate swimmer exists and belongs to team
    with get_db() as db:
        swimmer = db.execute(
            "SELECT id FROM swimmers WHERE id = ? AND team_id = ?",
            (swimmer_id, team_id),
        ).fetchone()
    if not swimmer:
        return error("Swimmer not found or does not belong to this team", 404)

    sess_id = new_uuid()
    with get_db() as db:
        db.execute(
            """INSERT INTO swim_sessions
               (id, competition_id, swimmer_id, team_id, lane_number, lap_count, is_active)
               VALUES (?,?,?,?,?,0,1)""",
            (sess_id, competition_id, swimmer_id, team_id, lane_number),
        )
        db.commit()
        row = db.execute("SELECT * FROM swim_sessions WHERE id = ?", (sess_id,)).fetchone()

    logger.info("Session started: swimmer %s team %s lane %d", swimmer_id, team_id, lane_number)
    return created(serialize_session(dict(row)))


@sessions_bp.route("/swim-sessions/<sess_id>", methods=["PUT"])
def update_session(sess_id):
    """Update a swim session — primarily used to end it."""
    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM swim_sessions WHERE id = ?", (sess_id,)
        ).fetchone()
    if not existing:
        return not_found("Swim session")

    data = request.get_json(silent=True) or {}
    ex   = dict(existing)

    end_time  = data.get("endTime",  ex.get("end_time"))
    lap_count = data.get("lapCount", ex["lap_count"])
    is_active = data.get("isActive", bool(ex["is_active"]))

    with get_db() as db:
        db.execute(
            "UPDATE swim_sessions SET end_time=?, lap_count=?, is_active=? WHERE id=?",
            (end_time, int(lap_count), int(is_active), sess_id),
        )
        db.commit()
        row = db.execute("SELECT * FROM swim_sessions WHERE id = ?", (sess_id,)).fetchone()

    logger.info("Session updated: %s active=%s", sess_id, is_active)
    return ok(serialize_session(dict(row)))
