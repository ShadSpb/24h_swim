"""
stats.py - Statistics endpoints for the Monitor/leaderboard page

Routes match the frontend API contract:
  GET /competitions/<cid>/stats          — full leaderboard + summary
  GET /competitions/<cid>/team-stats     — per-team only
  GET /competitions/<cid>/swimmer-stats  — per-swimmer only
"""

import logging
import os
from collections import defaultdict
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from flask import Blueprint, jsonify
from database import get_db
from utils import is_under_12_from_dob

stats_bp = Blueprint("stats", __name__)
logger   = logging.getLogger(__name__)

# All lap timestamps are stored as server-generated UTC (see lap_counts.py).
# Early/late-bird windows are wall-clock concepts, so we convert UTC -> the
# competition's local time before bucketing. The timezone is fixed
# server-side (env override possible) so a referee's device clock cannot
# influence which laps count toward early/late-bird totals.
try:
    _COMP_TZ = ZoneInfo(os.environ.get("COMPETITION_TIMEZONE", "Europe/Berlin"))
except ZoneInfoNotFoundError:
    logger.warning("Configured COMPETITION_TIMEZONE not found, falling back to UTC")
    _COMP_TZ = timezone.utc


def _parse_utc(ts: str):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _local_minute_of_day(ts: str):
    """Return minute-of-day (0..1439) in the configured competition timezone."""
    dt = _parse_utc(ts)
    if not dt:
        return None
    local = dt.astimezone(_COMP_TZ)
    return local.hour * 60 + local.minute


def _in_window(ts: str, start_hour: int, window_minutes: int) -> bool:
    """Is the UTC timestamp within [start_hour, start_hour + window) in local time?
    Handles windows that cross midnight (e.g. start 23 + 90 min spans 23:00-00:30)."""
    m = _local_minute_of_day(ts)
    if m is None or window_minutes <= 0:
        return False
    start = (start_hour * 60) % 1440
    end = (start + window_minutes) % 1440
    if start <= end:
        return start <= m < end
    return m >= start or m < end


def _bird_config(comp: dict) -> tuple[int, int, int]:
    return (
        int(comp.get("early_bird_hour", 5) or 0),
        int(comp.get("late_bird_hour", 0) or 0),
        int(comp.get("bird_window_minutes", 60) or 60),
    )


def _team_stats(cid: str, db) -> list[dict]:
    comp_row = db.execute(
        "SELECT early_bird_hour, late_bird_hour, bird_window_minutes FROM competitions WHERE id=?",
        (cid,),
    ).fetchone()
    early_h, late_h, window_m = _bird_config(dict(comp_row) if comp_row else {})

    teams    = {dict(r)["id"]: dict(r) for r in db.execute(
        "SELECT * FROM teams WHERE competition_id=? ORDER BY assigned_lane, name", (cid,)
    ).fetchall()}

    all_laps = [dict(r) for r in db.execute(
        "SELECT team_id, timestamp FROM lap_counts WHERE competition_id=? ORDER BY timestamp ASC", (cid,)
    ).fetchall()]

    team_laps: dict[str, list] = defaultdict(list)
    for lap in all_laps:
        team_laps[lap["team_id"]].append(lap)

    # Active sessions per team
    active_sessions = {}
    for row in db.execute(
        """SELECT ss.team_id, ss.swimmer_id, ss.lane_number, sw.name as swimmer_name
           FROM swim_sessions ss
           JOIN swimmers sw ON ss.swimmer_id = sw.id
           WHERE ss.competition_id=? AND ss.is_active=1""", (cid,)
    ).fetchall():
        r = dict(row)
        active_sessions[r["team_id"]] = r

    results = []
    for tid, team in teams.items():
        laps  = team_laps.get(tid, [])
        total = len(laps)
        late_bird  = sum(1 for l in laps if _in_window(l["timestamp"], late_h, window_m))
        early_bird = sum(1 for l in laps if _in_window(l["timestamp"], early_h, window_m))

        timestamps   = [t for t in (_parse_utc(l["timestamp"]) for l in laps) if t]
        laps_per_hour = fastest_lap_s = None
        if len(timestamps) >= 2:
            span_s = (timestamps[-1] - timestamps[0]).total_seconds()
            if span_s > 0:
                laps_per_hour = round((total - 1) / (span_s / 3600), 2)
                intervals     = [(timestamps[i+1] - timestamps[i]).total_seconds()
                                 for i in range(len(timestamps)-1)]
                fastest_lap_s = round(min(intervals), 1) if intervals else None

        active = active_sessions.get(tid)
        results.append({
            "team":           {"id": tid, "name": team["name"], "color": team["color"],
                               "assignedLane": team["assigned_lane"]},
            "totalLaps":      total,
            "lateBirdLaps":   late_bird,
            "earlyBirdLaps":  early_bird,
            "lapsPerHour":    laps_per_hour or 0.0,
            "fastestLapSec":  fastest_lap_s,
            "activeSwimmer":  {"id": active["swimmer_id"], "name": active["swimmer_name"],
                               "laneNumber": active["lane_number"]} if active else None,
        })
    results.sort(key=lambda x: x["totalLaps"], reverse=True)
    return results


def _swimmer_stats(cid: str, db) -> list[dict]:
    comp_row = db.execute(
        "SELECT early_bird_hour, late_bird_hour, bird_window_minutes FROM competitions WHERE id=?",
        (cid,),
    ).fetchone()
    early_h, late_h, window_m = _bird_config(dict(comp_row) if comp_row else {})

    rows = db.execute(
        """SELECT s.*, t.name as team_name, t.color as team_color
           FROM swimmers s JOIN teams t ON s.team_id=t.id
           WHERE s.competition_id=? ORDER BY s.name""", (cid,)
    ).fetchall()

    all_laps   = [dict(r) for r in db.execute(
        "SELECT swimmer_id, timestamp FROM lap_counts WHERE competition_id=?", (cid,)
    ).fetchall()]
    sw_laps    = defaultdict(list)
    for lap in all_laps:
        sw_laps[lap["swimmer_id"]].append(lap)

    # Total water time per swimmer
    sessions   = [dict(r) for r in db.execute(
        "SELECT swimmer_id, start_time, end_time FROM swim_sessions WHERE competition_id=?", (cid,)
    ).fetchall()]
    sw_water_s = defaultdict(float)
    for s in sessions:
        if s["start_time"] and s["end_time"]:
            st = _parse_utc(s["start_time"]); en = _parse_utc(s["end_time"])
            if st and en:
                sw_water_s[s["swimmer_id"]] += (en - st).total_seconds()

    results = []
    for sw in rows:
        s   = dict(sw); sid = s["id"]
        laps = sw_laps.get(sid, [])
        total      = len(laps)
        late_bird  = sum(1 for l in laps if _in_window(l["timestamp"], late_h, window_m))
        early_bird = sum(1 for l in laps if _in_window(l["timestamp"], early_h, window_m))
        results.append({
            "swimmer":           {"id": sid, "name": s["name"], "teamId": s["team_id"],
                                  "teamName": s["team_name"], "teamColor": s["team_color"],
                                  "dateOfBirth": s.get("date_of_birth"),
                                  "isUnder12": is_under_12_from_dob(s.get("date_of_birth"))},
            "totalLaps":         total,
            "lateBirdLaps":      late_bird,
            "earlyBirdLaps":     early_bird,
            "totalWaterSeconds": int(sw_water_s.get(sid, 0)),
        })
    results.sort(key=lambda x: x["totalLaps"], reverse=True)
    return results


def _not_found_comp():
    return jsonify({"error": "Competition not found"}), 404


@stats_bp.route("/competitions/<cid>/stats", methods=["GET"])
def competition_stats(cid):
    with get_db() as db:
        comp = db.execute("SELECT * FROM competitions WHERE id=?", (cid,)).fetchone()
        if not comp:
            return _not_found_comp()
        comp         = dict(comp)
        team_stats   = _team_stats(cid, db)
        swimmer_stats = _swimmer_stats(cid, db)
        total_laps   = db.execute("SELECT COUNT(*) FROM lap_counts WHERE competition_id=?", (cid,)).fetchone()[0]
        active_count = db.execute("SELECT COUNT(*) FROM swim_sessions WHERE competition_id=? AND is_active=1", (cid,)).fetchone()[0]

    now          = datetime.now(timezone.utc)
    actual_start = _parse_utc(comp.get("actual_start_time"))
    elapsed_s    = int((now - actual_start).total_seconds()) if actual_start else 0

    return jsonify({
        "data": {
            "competition":    {"id": comp["id"], "name": comp["name"], "status": comp["status"],
                               "numberOfLanes": comp["number_of_lanes"],
                               "actualStartTime": comp.get("actual_start_time"),
                               "actualEndTime":   comp.get("actual_end_time")},
            "totalLaps":      total_laps,
            "activeSessions": active_count,
            "elapsedSeconds": elapsed_s,
            "teamStats":      team_stats,
            "swimmerStats":   swimmer_stats,
        }
    }), 200


@stats_bp.route("/competitions/<cid>/team-stats", methods=["GET"])
def team_stats(cid):
    with get_db() as db:
        if not db.execute("SELECT id FROM competitions WHERE id=?", (cid,)).fetchone():
            return _not_found_comp()
        data = _team_stats(cid, db)
    return jsonify({"data": data}), 200


@stats_bp.route("/competitions/<cid>/swimmer-stats", methods=["GET"])
def swimmer_stats(cid):
    with get_db() as db:
        if not db.execute("SELECT id FROM competitions WHERE id=?", (cid,)).fetchone():
            return _not_found_comp()
        data = _swimmer_stats(cid, db)
    return jsonify({"data": data}), 200
