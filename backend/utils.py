"""
utils.py - Shared utilities: response helpers, password generation, validation, serialisation
"""

import uuid
import random
import re
import logging
import hashlib
from flask import jsonify
from werkzeug.security import check_password_hash, generate_password_hash

logger = logging.getLogger(__name__)
PASSWORD_HASH_METHOD = "pbkdf2:sha256:600000"
SECURE_HASH_PREFIXES = ("pbkdf2:", "scrypt:", "argon2:")
SHA256_HEX_RE = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)

# ── Human-friendly password word lists ────────────────────────────────────────
ADJECTIVES = [
    "Swift", "Bold", "Calm", "Bright", "Keen", "Wise", "Quick", "Sharp",
    "Clear", "Fair", "Deep", "Cool", "Pure", "Fine", "Agile", "Brave",
    "Crisp", "Firm", "Free", "Grand", "High", "Kind", "Loud", "Mild",
    "Nice", "Open", "Proud", "Real", "Safe", "True", "Vast", "Warm",
]
NOUNS = [
    "Dolphin", "Wave", "Tide", "Stream", "Current", "Reef", "Shore",
    "Splash", "Foam", "Ripple", "Surge", "Flow", "Drift", "Glide",
    "Diver", "Swimmer", "Coach", "Whistle", "Lane", "Pool", "Cap",
    "Sprint", "Stroke", "Kick", "Lap", "Turn", "Anchor", "Relay",
]


def generate_human_password() -> str:
    """Generate a human-friendly password like 'SwiftDolphin42'."""
    return f"{random.choice(ADJECTIVES)}{random.choice(NOUNS)}{random.randint(10, 99)}"


def generate_referee_user_id() -> str:
    """Generate a referee login ID like 'ref_73821'."""
    return f"ref_{random.randint(10000, 99999)}"


def new_uuid() -> str:
    return str(uuid.uuid4())


def sha256_hex(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def is_secure_password_hash(value: str) -> bool:
    if not isinstance(value, str):
        return False
    return value.startswith(SECURE_HASH_PREFIXES) and "$" in value


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("password is required")
    return generate_password_hash(password, method=PASSWORD_HASH_METHOD)


def verify_password(password: str, stored_password: str) -> tuple[bool, bool]:
    """
    Verify a password and indicate whether stored credentials should be upgraded.

    Returns: (is_valid, needs_upgrade)
    """
    if not password or not stored_password:
        return False, False

    if is_secure_password_hash(stored_password):
        if check_password_hash(stored_password, password):
            return True, False
        # Compatibility for legacy SHA-256 credentials that may have been
        # re-hashed during migration.
        if check_password_hash(stored_password, sha256_hex(password)):
            return True, True
        return False, False

    if stored_password == password:
        return True, True

    if SHA256_HEX_RE.fullmatch(stored_password) and sha256_hex(password) == stored_password.lower():
        return True, True

    return False, False


# ── HTTP response helpers ──────────────────────────────────────────────────────

def ok(data, status: int = 200):
    return jsonify({"data": data}), status


def created(data: dict):
    return jsonify({"data": data}), 201


def success(extra: dict | None = None):
    body = {"success": True}
    if extra:
        body.update(extra)
    return jsonify(body), 200


def error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def not_found(resource: str = "Resource"):
    return jsonify({"error": f"{resource} not found"}), 404


def conflict(message: str):
    return jsonify({"error": message}), 409


def too_many_requests(message: str, retry_after: int):
    resp = jsonify({"error": message, "retryAfter": retry_after})
    resp.status_code = 429
    resp.headers["Retry-After"] = str(retry_after)
    return resp


# ── Validation ─────────────────────────────────────────────────────────────────

def is_valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@]+@[^@]+\.[^@]+$", email or ""))


def is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError):
        return False


# ── Serialisers: snake_case DB rows → camelCase JSON ──────────────────────────

def serialize_competition(row: dict) -> dict:
    return {
        "id":                 row["id"],
        "name":               row["name"],
        "description":        row.get("description", ""),
        "date":               row["date"],
        "startTime":          row["start_time"],
        "endTime":            row.get("end_time", ""),
        "location":           row["location"],
        "numberOfLanes":      row["number_of_lanes"],
        "laneLength":         row.get("lane_length", 25),
        "doubleCountTimeout": row["double_count_timeout"],
        "organizerId":        row["organizer_id"],
        "status":             row["status"],
        "autoStart":          bool(row.get("auto_start", 0)),
        "autoFinish":         bool(row.get("auto_finish", 0)),
        "actualStartTime":    row.get("actual_start_time"),
        "actualEndTime":      row.get("actual_end_time"),
        "resultsPdf":         row.get("results_pdf"),
        "createdAt":          row["created_at"],
    }


def serialize_team(row: dict) -> dict:
    return {
        "id":            row["id"],
        "name":          row["name"],
        "color":         row["color"],
        "logo":          row.get("logo"),
        "competitionId": row["competition_id"],
        "assignedLane":  row["assigned_lane"],
        "createdAt":     row["created_at"],
    }


def serialize_swimmer(row: dict) -> dict:
    return {
        "id":            row["id"],
        "name":          row["name"],
        "teamId":        row["team_id"],
        "competitionId": row["competition_id"],
        "isUnder12":     bool(row.get("is_under_12", 0)),
        "parentName":    row.get("parent_name"),
        "parentContact": row.get("parent_contact"),
        "parentPresent": bool(row.get("parent_present", 0)),
        "createdAt":     row["created_at"],
    }


def serialize_referee(row: dict) -> dict:
    return {
        "id":            row["id"],
        "userId":        row["unique_id"],
        "uniqueId":      row["unique_id"],
        "competitionId": row["competition_id"],
        "email":         row.get("email") or row.get("user_email"),
        "createdAt":     row["created_at"],
    }


def serialize_session(row: dict) -> dict:
    return {
        "id":            row["id"],
        "competitionId": row["competition_id"],
        "swimmerId":     row["swimmer_id"],
        "teamId":        row["team_id"],
        "laneNumber":    row["lane_number"],
        "startTime":     row["start_time"],
        "endTime":       row.get("end_time"),
        "lapCount":      row["lap_count"],
        "isActive":      bool(row["is_active"]),
    }


def serialize_lap_count(row: dict) -> dict:
    return {
        "id":            row["id"],
        "competitionId": row["competition_id"],
        "laneNumber":    row["lane_number"],
        "teamId":        row["team_id"],
        "swimmerId":     row["swimmer_id"],
        "refereeId":     row["referee_id"],
        "lapNumber":     row["lap_number"],
        "timestamp":     row["timestamp"],
    }


def serialize_user(row: dict) -> dict:
    return {
        "id":        row["id"],
        "email":     row["email"],
        "name":      row["name"],
        "role":      row["role"],
        "createdAt": row["created_at"],
    }
