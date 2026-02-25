"""
competitions.py - Competition CRUD endpoints
GET    /competitions
GET    /competitions/<id>
POST   /competitions
PUT    /competitions/<id>
DELETE /competitions/<id>
"""

import logging
from flask import Blueprint, request
from database import get_db
from utils import (
    new_uuid, ok, created, success, error, not_found,
    serialize_competition,
)

competitions_bp = Blueprint("competitions", __name__)
logger = logging.getLogger(__name__)

VALID_STATUSES = ("upcoming", "active", "paused", "completed", "stopped")


@competitions_bp.route("/competitions", methods=["GET"])
def list_competitions():
    organizer_id = request.args.get("organizerId")
    with get_db() as db:
        if organizer_id:
            rows = db.execute(
                "SELECT * FROM competitions WHERE organizer_id = ? ORDER BY date DESC, created_at DESC",
                (organizer_id,),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM competitions ORDER BY date DESC, created_at DESC"
            ).fetchall()
    return ok([serialize_competition(dict(r)) for r in rows])


@competitions_bp.route("/competitions/<cid>", methods=["GET"])
def get_competition(cid):
    with get_db() as db:
        row = db.execute("SELECT * FROM competitions WHERE id = ?", (cid,)).fetchone()
    if not row:
        return not_found("Competition")
    return ok(serialize_competition(dict(row)))


@competitions_bp.route("/competitions", methods=["POST"])
def create_competition():
    data = request.get_json(silent=True) or {}

    required = ["name", "date", "location", "startTime", "organizerId", "numberOfLanes"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    # Validate organizer exists
    with get_db() as db:
        org = db.execute(
            "SELECT id FROM users WHERE id = ? AND role = 'organizer'",
            (data["organizerId"],),
        ).fetchone()
    if not org:
        return error("Organizer not found or not an organizer", 404)

    cid = new_uuid()
    with get_db() as db:
        db.execute(
            """INSERT INTO competitions
               (id, name, description, date, start_time, end_time, location,
                number_of_lanes, lane_length, double_count_timeout,
                organizer_id, status)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                cid,
                data["name"],
                data.get("description", ""),
                data["date"],
                data["startTime"],
                data.get("endTime", ""),
                data["location"],
                int(data["numberOfLanes"]),
                int(data.get("laneLength", 25)),
                int(data.get("doubleCountTimeout", 15)),
                data["organizerId"],
                "upcoming",
            ),
        )
        db.commit()
        row = db.execute("SELECT * FROM competitions WHERE id = ?", (cid,)).fetchone()

    logger.info("Competition created: %s (%s)", data["name"], cid)
    return created(serialize_competition(dict(row)))


@competitions_bp.route("/competitions/<cid>", methods=["PUT"])
def update_competition(cid):
    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM competitions WHERE id = ?", (cid,)
        ).fetchone()
    if not existing:
        return not_found("Competition")

    data = request.get_json(silent=True) or {}
    ex   = dict(existing)

    # Status transition validation
    new_status = data.get("status", ex["status"])
    if new_status not in VALID_STATUSES:
        return error(f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")

    with get_db() as db:
        db.execute(
            """UPDATE competitions SET
               name                = ?,
               description         = ?,
               date                = ?,
               start_time          = ?,
               end_time            = ?,
               location            = ?,
               number_of_lanes     = ?,
               lane_length         = ?,
               double_count_timeout = ?,
               status              = ?,
               auto_start          = ?,
               auto_finish         = ?,
               actual_start_time   = ?,
               actual_end_time     = ?,
               results_pdf         = ?
               WHERE id = ?""",
            (
                data.get("name",               ex["name"]),
                data.get("description",        ex.get("description", "")),
                data.get("date",               ex["date"]),
                data.get("startTime",          ex["start_time"]),
                data.get("endTime",            ex.get("end_time", "")),
                data.get("location",           ex["location"]),
                int(data.get("numberOfLanes",  ex["number_of_lanes"])),
                int(data.get("laneLength",     ex.get("lane_length", 25))),
                int(data.get("doubleCountTimeout", ex["double_count_timeout"])),
                new_status,
                int(data.get("autoStart",      ex.get("auto_start", 0))),
                int(data.get("autoFinish",     ex.get("auto_finish", 0))),
                data.get("actualStartTime",    ex.get("actual_start_time")),
                data.get("actualEndTime",      ex.get("actual_end_time")),
                data.get("resultsPdf",         ex.get("results_pdf")),
                cid,
            ),
        )
        db.commit()
        row = db.execute("SELECT * FROM competitions WHERE id = ?", (cid,)).fetchone()

    logger.info("Competition updated: %s status=%s", cid, new_status)
    return ok(serialize_competition(dict(row)))


@competitions_bp.route("/competitions/<cid>", methods=["DELETE"])
def delete_competition(cid):
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM competitions WHERE id = ?", (cid,)
        ).fetchone()
    if not existing:
        return not_found("Competition")

    # Count before cascade delete (for response)
    with get_db() as db:
        teams_count    = db.execute("SELECT COUNT(*) FROM teams WHERE competition_id = ?", (cid,)).fetchone()[0]
        swimmers_count = db.execute("SELECT COUNT(*) FROM swimmers WHERE competition_id = ?", (cid,)).fetchone()[0]
        refs_count     = db.execute("SELECT COUNT(*) FROM referees WHERE competition_id = ?", (cid,)).fetchone()[0]
        laps_count     = db.execute("SELECT COUNT(*) FROM lap_counts WHERE competition_id = ?", (cid,)).fetchone()[0]
        sess_count     = db.execute("SELECT COUNT(*) FROM swim_sessions WHERE competition_id = ?", (cid,)).fetchone()[0]

        ref_user_ids = [
            r[0] for r in db.execute(
                "SELECT user_id FROM referees WHERE competition_id = ?", (cid,)
            ).fetchall()
        ]
        # Delete in FK dependency order
        db.execute("DELETE FROM lap_counts WHERE competition_id = ?", (cid,))
        db.execute("DELETE FROM swim_sessions WHERE competition_id = ?", (cid,))
        db.execute("DELETE FROM referees WHERE competition_id = ?", (cid,))
        for uid in ref_user_ids:
            db.execute("DELETE FROM users WHERE id = ? AND role = 'referee'", (uid,))
        db.execute("DELETE FROM swimmers WHERE competition_id = ?", (cid,))
        db.execute("DELETE FROM teams WHERE competition_id = ?", (cid,))
        db.execute("DELETE FROM competitions WHERE id = ?", (cid,))
        db.commit()
    logger.info("Competition deleted: %s", cid)
    return success({
        "deleted": {
            "teams":        teams_count,
            "swimmers":     swimmers_count,
            "referees":     refs_count,
            "lapCounts":    laps_count,
            "swimSessions": sess_count,
        }
    })
