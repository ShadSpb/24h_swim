"""
referees.py - Referee management endpoints
GET    /referees
POST   /referees          (auto-generates userId + password, returns password ONCE)
DELETE /referees/<id>
POST   /referees/<id>/reset-password
"""

import logging
from flask import Blueprint, request
from database import get_db
from utils import (
    new_uuid, ok, created, success, error, not_found,
    serialize_referee, generate_human_password, generate_referee_user_id, hash_password,
)

referees_bp = Blueprint("referees", __name__)
logger      = logging.getLogger(__name__)


@referees_bp.route("/referees", methods=["GET"])
def list_referees():
    competition_id = request.args.get("competitionId")
    user_id_filter = request.args.get("userId")

    query  = "SELECT r.*, u.email as user_email FROM referees r JOIN users u ON r.user_id = u.id WHERE 1=1"
    params = []

    if competition_id:
        query += " AND r.competition_id = ?"
        params.append(competition_id)
    if user_id_filter:
        query += " AND (r.unique_id = ? OR u.email = ?)"
        params += [user_id_filter, user_id_filter]

    query += " ORDER BY r.created_at"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()

    return ok([serialize_referee(dict(r)) for r in rows])


@referees_bp.route("/referees", methods=["POST"])
def create_referee():
    """
    Create a referee for a competition.
    Auto-generates a unique ref_##### login ID and human-friendly password.
    Referee login is stored as plain ID (no email domain suffix).
    The password is returned ONCE in the response.
    """
    data           = request.get_json(silent=True) or {}
    competition_id = data.get("competitionId")

    if not competition_id:
        return error("competitionId is required")

    with get_db() as db:
        if not db.execute("SELECT id FROM competitions WHERE id=?", (competition_id,)).fetchone():
            return error("Competition not found", 404)
        existing_ids = {r[0] for r in db.execute("SELECT unique_id FROM referees").fetchall()}

    unique_id = generate_referee_user_id()
    for _ in range(100):
        if unique_id not in existing_ids:
            break
        unique_id = generate_referee_user_id()

    plain_password = generate_human_password()
    password_hash = hash_password(plain_password)
    user_id = new_uuid()
    ref_id  = new_uuid()
    login_id = unique_id

    with get_db() as db:
        db.execute(
            "INSERT INTO users (id, email, name, password, role) VALUES (?,?,?,?,?)",
            (user_id, login_id, unique_id, password_hash, "referee"),
        )
        db.execute(
            "INSERT INTO referees (id, user_id, unique_id, competition_id, email) VALUES (?,?,?,?,?)",
            (ref_id, user_id, unique_id, competition_id, login_id),
        )
        row = db.execute("SELECT * FROM referees WHERE id=?", (ref_id,)).fetchone()
        db.commit()

    result             = serialize_referee(dict(row))
    result["password"] = plain_password   # returned ONCE – store it now
    result["userId"]   = unique_id

    logger.info("Referee created: %s for competition %s", unique_id, competition_id)
    return created(result)


@referees_bp.route("/referees/<rid>", methods=["DELETE"])
def delete_referee(rid):
    with get_db() as db:
        ref = db.execute("SELECT * FROM referees WHERE id=?", (rid,)).fetchone()
    if not ref:
        return not_found("Referee")

    ref_dict = dict(ref)

    with get_db() as db:
        # Preserve lap history; DB FK sets lap_counts.referee_id to NULL on referee delete.
        db.execute("DELETE FROM referees WHERE id=?", (rid,))
        db.execute("DELETE FROM users WHERE id=? AND role='referee'", (ref_dict["user_id"],))
        db.commit()

    logger.info("Referee deleted: %s", rid)
    return success()


@referees_bp.route("/referees/<rid>/reset-password", methods=["POST"])
def reset_referee_password(rid):
    """Generate and return a new password for a referee."""
    with get_db() as db:
        ref = db.execute("SELECT * FROM referees WHERE id=?", (rid,)).fetchone()
    if not ref:
        return not_found("Referee")

    new_pw = generate_human_password()
    new_pw_hash = hash_password(new_pw)
    with get_db() as db:
        db.execute("UPDATE users SET password=? WHERE id=?", (new_pw_hash, dict(ref)["user_id"]))
        db.commit()

    logger.info("Password reset for referee %s", rid)
    return success({"newPassword": new_pw})
