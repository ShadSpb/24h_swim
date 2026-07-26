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
    serialize_competition, generate_competition_slug, short_uuid_slug,
)
import authz

ENDED_STATUSES = ("completed", "stopped")


def _allocate_short_slug(db, comp_id: str) -> str:
    """Pick a short-UUID slug guaranteed unique against current rows."""
    used = {
        r[0] for r in db.execute(
            "SELECT slug FROM competitions WHERE slug IS NOT NULL AND slug != '' AND id != ?",
            (comp_id,),
        ).fetchall()
    }
    candidate = short_uuid_slug(comp_id)
    for _ in range(16):
        if candidate not in used:
            return candidate
        candidate = short_uuid_slug(None)
    # Defensive fallback
    return f"comp-{candidate}"

competitions_bp = Blueprint("competitions", __name__)
logger = logging.getLogger(__name__)

VALID_STATUSES = ("upcoming", "active", "paused", "completed", "stopped")


def _validate_bird_config(data, current=None):
    """Pull and validate earlyBirdHour / lateBirdHour / birdWindowMinutes.
    Returns (early, late, window_min) or raises ValueError."""
    def _hour(v, default):
        v = int(v) if v is not None and v != "" else default
        if not (0 <= v <= 23):
            raise ValueError("bird hour must be between 0 and 23")
        return v

    def _window(v, default):
        v = int(v) if v is not None and v != "" else default
        if not (15 <= v <= 240):
            raise ValueError("birdWindowMinutes must be between 15 and 240")
        return v

    early = _hour(data.get("earlyBirdHour"),
                  current.get("early_bird_hour", 5) if current else 5)
    late = _hour(data.get("lateBirdHour"),
                 current.get("late_bird_hour", 0) if current else 0)
    window = _window(data.get("birdWindowMinutes"),
                     current.get("bird_window_minutes", 60) if current else 60)
    return early, late, window


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
        row = db.execute(
            "SELECT * FROM competitions WHERE id = ? OR slug = ?", (cid, cid),
        ).fetchone()
    if not row:
        return not_found("Competition")
    return ok(serialize_competition(dict(row)))


@competitions_bp.route("/competitions/<cid>/results-pdf", methods=["GET"])
def get_competition_results_pdf(cid):
    """Return the stored results PDF (base64 data URI) for a completed
    competition. Kept out of the competition list/detail payloads because it is
    large; the owner fetches it here on demand."""
    guard = authz.require_owner(cid)
    if guard:
        return guard
    with get_db() as db:
        row = db.execute(
            "SELECT results_pdf FROM competitions WHERE id = ? OR slug = ?", (cid, cid),
        ).fetchone()
    if not row:
        return not_found("Competition")
    return ok({"resultsPdf": dict(row)["results_pdf"]})


@competitions_bp.route("/competitions", methods=["POST"])
def create_competition():
    data = request.get_json(silent=True) or {}

    required = ["name", "date", "location", "startTime", "numberOfLanes"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error(f"Missing required fields: {', '.join(missing)}")

    # The owner is the authenticated organizer — never trust a client-supplied
    # organizerId (that would let one organizer create competitions as another).
    caller = authz.current_user()
    if not caller or caller["role"] != "organizer":
        return error("Only organizers can create competitions", 403)
    organizer_id = caller["id"]

    try:
        early_h, late_h, window_m = _validate_bird_config(data)
    except ValueError as exc:
        return error(str(exc))

    cid = new_uuid()
    with get_db() as db:
        slug = generate_competition_slug(db, comp_id=cid)
        db.execute(
            """INSERT INTO competitions
               (id, slug, name, description, date, start_time, end_time, location,
                number_of_lanes, lane_length, double_count_timeout,
                organizer_id, status,
                early_bird_hour, late_bird_hour, bird_window_minutes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                cid,
                slug,
                data["name"],
                data.get("description", ""),
                data["date"],
                data["startTime"],
                data.get("endTime", ""),
                data["location"],
                int(data["numberOfLanes"]),
                int(data.get("laneLength", 25)),
                int(data.get("doubleCountTimeout", 15)),
                organizer_id,
                "upcoming",
                early_h,
                late_h,
                window_m,
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

    guard = authz.require_owner(cid)
    if guard:
        return guard

    data = request.get_json(silent=True) or {}
    ex   = dict(existing)

    # Status transition validation
    new_status = data.get("status", ex["status"])
    if new_status not in VALID_STATUSES:
        return error(f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")

    try:
        early_h, late_h, window_m = _validate_bird_config(data, current=ex)
    except ValueError as exc:
        return error(str(exc))

    # Release the famous-surname slug when the competition ends so the name
    # is available for the next competition. The ended competition keeps a
    # stable, accessible link via a short UUID slug.
    prev_status = ex["status"]
    current_slug = ex.get("slug") or ""
    transitioning_to_ended = (
        new_status in ENDED_STATUSES and prev_status not in ENDED_STATUSES
    )
    if transitioning_to_ended:
        with get_db() as db:
            new_slug = _allocate_short_slug(db, cid)
        if current_slug != new_slug:
            logger.info("Releasing slug %s -> %s on status=%s", current_slug, new_slug, new_status)
            current_slug = new_slug

    with get_db() as db:
        db.execute(
            """UPDATE competitions SET
               name                = ?,
               slug                = ?,
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
               early_bird_hour     = ?,
               late_bird_hour      = ?,
               bird_window_minutes = ?,
               actual_start_time   = ?,
               actual_end_time     = ?,
               results_pdf         = ?
               WHERE id = ?""",
            (
                data.get("name",               ex["name"]),
                current_slug,
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
                early_h,
                late_h,
                window_m,
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

    guard = authz.require_owner(cid)
    if guard:
        return guard

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
