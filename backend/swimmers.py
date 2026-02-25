"""
swimmers.py - Swimmer CRUD endpoints
GET    /swimmers
POST   /swimmers
PUT    /swimmers/<id>
DELETE /swimmers/<id>
"""

import logging
from flask import Blueprint, request
from database import get_db
from utils import new_uuid, ok, created, success, error, not_found, serialize_swimmer

swimmers_bp = Blueprint("swimmers", __name__)
logger      = logging.getLogger(__name__)


@swimmers_bp.route("/swimmers", methods=["GET"])
def list_swimmers():
    competition_id = request.args.get("competitionId")
    team_id        = request.args.get("teamId")

    query  = "SELECT * FROM swimmers WHERE 1=1"
    params = []
    if competition_id:
        query += " AND competition_id = ?"; params.append(competition_id)
    if team_id:
        query += " AND team_id = ?";        params.append(team_id)
    query += " ORDER BY name"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()
    return ok([serialize_swimmer(dict(r)) for r in rows])


@swimmers_bp.route("/swimmers", methods=["POST"])
def create_swimmer():
    data = request.get_json(silent=True) or {}

    required = ["name", "teamId", "competitionId"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    is_under_12    = bool(data.get("isUnder12", False))
    parent_name    = (data.get("parentName")    or "").strip() or None
    parent_contact = (data.get("parentContact") or "").strip() or None

    # RULES: under-12 swimmers must have both parentName and parentContact
    if is_under_12 and not parent_name:
        return error("parentName is required for swimmers under 12")
    if is_under_12 and not parent_contact:
        return error("parentContact is required for swimmers under 12")

    with get_db() as db:
        team = db.execute("SELECT id, competition_id FROM teams WHERE id=?", (data["teamId"],)).fetchone()
    if not team:
        return error("Team not found", 404)
    if dict(team)["competition_id"] != data["competitionId"]:
        return error("Team does not belong to this competition")

    sid = new_uuid()
    with get_db() as db:
        db.execute(
            """INSERT INTO swimmers
               (id, name, team_id, competition_id, is_under_12, parent_name, parent_contact, parent_present)
               VALUES (?,?,?,?,?,?,?,?)""",
            (sid, data["name"], data["teamId"], data["competitionId"],
             int(is_under_12), parent_name, parent_contact,
             int(bool(data.get("parentPresent", False)))),
        )
        db.commit()
        row = db.execute("SELECT * FROM swimmers WHERE id=?", (sid,)).fetchone()

    logger.info("Swimmer created: %s", data["name"])
    return created(serialize_swimmer(dict(row)))


@swimmers_bp.route("/swimmers/<sid>", methods=["PUT"])
def update_swimmer(sid):
    with get_db() as db:
        existing = db.execute("SELECT * FROM swimmers WHERE id=?", (sid,)).fetchone()
    if not existing:
        return not_found("Swimmer")

    data = request.get_json(silent=True) or {}
    ex   = dict(existing)

    is_under_12    = bool(data.get("isUnder12",     bool(ex["is_under_12"])))
    parent_name    = (data.get("parentName",    ex.get("parent_name"))    or "").strip() or None
    parent_contact = (data.get("parentContact", ex.get("parent_contact")) or "").strip() or None

    if is_under_12 and not parent_name:
        return error("parentName is required for swimmers under 12")
    if is_under_12 and not parent_contact:
        return error("parentContact is required for swimmers under 12")

    with get_db() as db:
        db.execute(
            "UPDATE swimmers SET name=?, is_under_12=?, parent_name=?, parent_contact=?, parent_present=? WHERE id=?",
            (data.get("name", ex["name"]), int(is_under_12), parent_name, parent_contact,
             int(bool(data.get("parentPresent", bool(ex.get("parent_present", 0))))), sid),
        )
        row = db.execute("SELECT * FROM swimmers WHERE id=?", (sid,)).fetchone()

    return ok(serialize_swimmer(dict(row)))


@swimmers_bp.route("/swimmers/<sid>", methods=["DELETE"])
def delete_swimmer(sid):
    with get_db() as db:
        if not db.execute("SELECT id FROM swimmers WHERE id=?", (sid,)).fetchone():
            return not_found("Swimmer")
        # End any active sessions for this swimmer before cascade-deleting
        db.execute(
            "UPDATE swim_sessions SET is_active=0, end_time=datetime('now') WHERE swimmer_id=? AND is_active=1",
            (sid,)
        )
        # lap_counts.swimmer_id → swimmers.id is CASCADE, so this is safe
        db.execute("DELETE FROM swimmers WHERE id=?", (sid,))
        db.commit()

    logger.info("Swimmer deleted: %s", sid)
    return success()
