"""
swimmers.py - Swimmer CRUD endpoints
GET    /swimmers
POST   /swimmers
PUT    /swimmers/<id>
DELETE /swimmers/<id>
"""

import logging
import re
from datetime import date
from flask import Blueprint, request
from database import get_db
from utils import (
    new_uuid, ok, created, success, error, not_found,
    serialize_swimmer, is_under_12_from_dob,
)
import authz

swimmers_bp = Blueprint("swimmers", __name__)
logger      = logging.getLogger(__name__)

_DOB_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _normalize_dob(value):
    """Accept None / '' / 'YYYY-MM-DD' / 'DD.MM.YYYY'. Returns ISO string or None.
    Raises ValueError on invalid input."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if _DOB_RE.match(s):
        try:
            date.fromisoformat(s)
        except ValueError as exc:
            raise ValueError("dateOfBirth must be a valid date") from exc
        return s
    m = re.match(r"^(\d{2})\.(\d{2})\.(\d{4})$", s)
    if m:
        dd, mm, yyyy = m.groups()
        iso = f"{yyyy}-{mm}-{dd}"
        try:
            date.fromisoformat(iso)
        except ValueError as exc:
            raise ValueError("dateOfBirth must be a valid date") from exc
        return iso
    raise ValueError("dateOfBirth must be in YYYY-MM-DD or DD.MM.YYYY format")


@swimmers_bp.route("/swimmers", methods=["GET"])
def list_swimmers():
    competition_id = request.args.get("competitionId")
    team_id        = request.args.get("teamId")

    # Swimmer rows contain personal data (DOB, parent contact) and must never
    # be dumped wholesale. Require a competition scope and membership; referees
    # get the roster without the personal fields.
    if not competition_id:
        return error("competitionId is required")
    guard = authz.require_member(competition_id)
    if guard:
        return guard
    include_pii = authz.is_owner(competition_id)

    query  = "SELECT * FROM swimmers WHERE competition_id = ?"
    params = [competition_id]
    if team_id:
        query += " AND team_id = ?";        params.append(team_id)
    query += " ORDER BY name"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()
    return ok([serialize_swimmer(dict(r), include_pii=include_pii) for r in rows])


@swimmers_bp.route("/swimmers", methods=["POST"])
def create_swimmer():
    data = request.get_json(silent=True) or {}

    required = ["name", "teamId", "competitionId"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    guard = authz.require_owner(data["competitionId"])
    if guard:
        return guard

    try:
        dob = _normalize_dob(data.get("dateOfBirth"))
    except ValueError as exc:
        return error(str(exc))

    parent_name    = (data.get("parentName")    or "").strip() or None
    parent_contact = (data.get("parentContact") or "").strip() or None

    # RULES: under-12 swimmers must have both parentName and parentContact
    if is_under_12_from_dob(dob):
        if not parent_name:
            return error("parentName is required for swimmers under 12")
        if not parent_contact:
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
               (id, name, team_id, competition_id, date_of_birth, parent_name, parent_contact, parent_present)
               VALUES (?,?,?,?,?,?,?,?)""",
            (sid, data["name"], data["teamId"], data["competitionId"],
             dob, parent_name, parent_contact,
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

    guard = authz.require_owner(dict(existing)["competition_id"])
    if guard:
        return guard

    data = request.get_json(silent=True) or {}
    ex   = dict(existing)

    try:
        if "dateOfBirth" in data:
            dob = _normalize_dob(data.get("dateOfBirth"))
        else:
            dob = ex.get("date_of_birth")
    except ValueError as exc:
        return error(str(exc))

    parent_name    = (data.get("parentName",    ex.get("parent_name"))    or "").strip() or None
    parent_contact = (data.get("parentContact", ex.get("parent_contact")) or "").strip() or None

    if is_under_12_from_dob(dob):
        if not parent_name:
            return error("parentName is required for swimmers under 12")
        if not parent_contact:
            return error("parentContact is required for swimmers under 12")

    with get_db() as db:
        db.execute(
            "UPDATE swimmers SET name=?, date_of_birth=?, parent_name=?, parent_contact=?, parent_present=? WHERE id=?",
            (data.get("name", ex["name"]), dob, parent_name, parent_contact,
             int(bool(data.get("parentPresent", bool(ex.get("parent_present", 0))))), sid),
        )
        row = db.execute("SELECT * FROM swimmers WHERE id=?", (sid,)).fetchone()

    return ok(serialize_swimmer(dict(row)))


@swimmers_bp.route("/swimmers/<sid>", methods=["DELETE"])
def delete_swimmer(sid):
    with get_db() as db:
        existing = db.execute("SELECT competition_id FROM swimmers WHERE id=?", (sid,)).fetchone()
    if not existing:
        return not_found("Swimmer")

    guard = authz.require_owner(dict(existing)["competition_id"])
    if guard:
        return guard

    with get_db() as db:
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
