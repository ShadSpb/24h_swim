"""
teams.py - Team CRUD endpoints
GET    /teams
POST   /teams
PUT    /teams/<id>
DELETE /teams/<id>
"""

import logging
from flask import Blueprint, request
from database import get_db
from utils import new_uuid, ok, created, success, error, not_found, serialize_team
import authz

teams_bp = Blueprint("teams", __name__)
logger   = logging.getLogger(__name__)


@teams_bp.route("/teams", methods=["GET"])
def list_teams():
    competition_id = request.args.get("competitionId")
    lane_number    = request.args.get("laneNumber", type=int)

    # Public (live monitor) read, but always scoped to one competition so the
    # whole table can't be dumped. Team data (name/colour/lane) is what the
    # public scoreboard shows; writes remain owner-only.
    if not competition_id:
        return error("competitionId is required")

    query  = "SELECT * FROM teams WHERE competition_id = ?"
    params = [competition_id]
    if lane_number is not None:
        query += " AND assigned_lane = ?";  params.append(lane_number)
    query += " ORDER BY assigned_lane, name"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()
    return ok([serialize_team(dict(r)) for r in rows])


@teams_bp.route("/teams", methods=["POST"])
def create_team():
    data = request.get_json(silent=True) or {}

    required = ["name", "color", "competitionId", "assignedLane"]
    missing  = [f for f in required if data.get(f) is None]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    competition_id = data["competitionId"]
    color          = data["color"]
    lane           = int(data["assignedLane"])

    guard = authz.require_owner(competition_id)
    if guard:
        return guard

    with get_db() as db:
        if not db.execute("SELECT id FROM competitions WHERE id=?", (competition_id,)).fetchone():
            return error("Competition not found", 404)
        # RULES: same color on same lane is forbidden (different lanes allowed)
        if db.execute(
            "SELECT id FROM teams WHERE competition_id=? AND color=? AND assigned_lane=?",
            (competition_id, color, lane)
        ).fetchone():
            return error("A team with the same color already exists on this lane")

    tid = new_uuid()
    with get_db() as db:
        db.execute(
            "INSERT INTO teams (id, name, color, logo, competition_id, assigned_lane) VALUES (?,?,?,?,?,?)",
            (tid, data["name"], color, data.get("logo"), competition_id, lane),
        )
        row = db.execute("SELECT * FROM teams WHERE id=?", (tid,)).fetchone()
        db.commit()

    logger.info("Team created: %s on lane %d", data["name"], lane)
    return created(serialize_team(dict(row)))


@teams_bp.route("/teams/<tid>", methods=["PUT"])
def update_team(tid):
    with get_db() as db:
        existing = db.execute("SELECT * FROM teams WHERE id=?", (tid,)).fetchone()
    if not existing:
        return not_found("Team")

    guard = authz.require_owner(dict(existing)["competition_id"])
    if guard:
        return guard

    data      = request.get_json(silent=True) or {}
    ex        = dict(existing)
    new_color = data.get("color",        ex["color"])
    new_lane  = int(data.get("assignedLane", ex["assigned_lane"]))

    # Conflict check excluding self
    if new_color != ex["color"] or new_lane != ex["assigned_lane"]:
        with get_db() as db:
            if db.execute(
                "SELECT id FROM teams WHERE competition_id=? AND color=? AND assigned_lane=? AND id!=?",
                (ex["competition_id"], new_color, new_lane, tid)
            ).fetchone():
                return error("A team with the same color already exists on this lane")

    with get_db() as db:
        db.execute(
            "UPDATE teams SET name=?, color=?, logo=?, assigned_lane=? WHERE id=?",
            (data.get("name", ex["name"]), new_color, data.get("logo", ex.get("logo")), new_lane, tid),
        )
        row = db.execute("SELECT * FROM teams WHERE id=?", (tid,)).fetchone()
        db.commit()

    return ok(serialize_team(dict(row)))


@teams_bp.route("/teams/<tid>", methods=["DELETE"])
def delete_team(tid):
    with get_db() as db:
        existing = db.execute("SELECT competition_id FROM teams WHERE id=?", (tid,)).fetchone()
    if not existing:
        return not_found("Team")

    guard = authz.require_owner(dict(existing)["competition_id"])
    if guard:
        return guard

    with get_db() as db:
        # lap_counts.team_id → teams.id is CASCADE, so deleting team cascades.
        # swim_sessions.team_id → teams.id is CASCADE too.
        # But we must first close any active sessions (good practice).
        db.execute("UPDATE swim_sessions SET is_active=0, end_time=datetime('now') WHERE team_id=? AND is_active=1", (tid,))
        db.execute("DELETE FROM teams WHERE id=?", (tid,))
        db.commit()

    logger.info("Team deleted: %s", tid)
    return success()
