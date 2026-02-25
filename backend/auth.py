"""
auth.py - Authentication endpoints
POST /auth/login
POST /auth/register
POST /auth/logout
POST /auth/reset-password
GET  /auth/users   (admin: list all users for password-reset flow)
"""

import logging
from flask import Blueprint, request, jsonify
from database import get_db
from utils import (
    new_uuid, is_valid_email,
    error, not_found, serialize_user,
    generate_human_password, hash_password, verify_password,
)

auth_bp = Blueprint("auth", __name__)
logger  = logging.getLogger(__name__)


@auth_bp.route("/auth/login", methods=["POST"])
def login():
    """Authenticate a user and transparently upgrade legacy password storage."""
    data = request.get_json(silent=True) or {}

    email    = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required"}), 400

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM users WHERE email = ? AND disabled = 0",
            (email,),
        ).fetchone()

    if not row:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    user = dict(row)
    is_valid, needs_upgrade = verify_password(password, user["password"])
    if not is_valid:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    if needs_upgrade:
        with get_db() as db:
            db.execute("UPDATE users SET password = ? WHERE id = ?", (hash_password(password), user["id"]))
            db.commit()

    logger.info("User %s logged in", email)
    return jsonify({
        "success": True,
        "user":    serialize_user(user),
        "role":    user["role"],
    }), 200


@auth_bp.route("/auth/register", methods=["POST","OPTIONS"])
def register():
    """Register a new organizer account."""
    data = request.get_json(silent=True) or {}

    email    = (data.get("email") or "").strip()
    password = (data.get("password") or "").strip()
    name     = (data.get("name") or "").strip()
    role     = data.get("role", "organizer")

    if not email or not password or not name:
        return jsonify({"success": False, "error": "email, password and name are required"}), 400

    if not is_valid_email(email):
        return jsonify({"success": False, "error": "Invalid email address"}), 400

    if role not in ("organizer",):
        # Only organizers self-register; referees are created by organizers
        return jsonify({"success": False, "error": "Self-registration is only available for organizers"}), 400

    user_id = new_uuid()
    password_hash = hash_password(password)
    try:
        with get_db() as db:
            db.execute(
                "INSERT INTO users (id, email, name, password, role) VALUES (?,?,?,?,?)",
                (user_id, email, name, password_hash, role),
            )
            db.commit()
    except Exception as e:
        if "UNIQUE" in str(e):
            return jsonify({"success": False, "error": "Email already exists"}), 400
        logger.exception("Registration error")
        return jsonify({"success": False, "error": "Internal server error"}), 500

    with get_db() as db:
        user = dict(db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())

    logger.info("New organizer registered: %s", email)
    return jsonify({"success": True, "user": serialize_user(user)}), 201


@auth_bp.route("/auth/logout", methods=["POST"])
def logout():
    """Logout is stateless on the backend (JWT-less). Just returns OK."""
    return jsonify({"success": True}), 200


@auth_bp.route("/auth/users", methods=["GET"])
def list_users():
    """
    Return list of all users (used by frontend forgot-password flow to check
    if a given email exists before sending reset link).
    In production this should be protected; here we return minimal info only.
    """
    with get_db() as db:
        rows = db.execute(
            "SELECT id, email, name, role, created_at FROM users WHERE disabled = 0"
        ).fetchall()
    return jsonify([serialize_user(dict(r)) for r in rows]), 200


@auth_bp.route("/auth/reset-password", methods=["POST"])
def reset_password():
    """
    Reset a user's password. Generates a new human-friendly password and
    returns it (frontend handles display/email sending).
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId") or data.get("user_id")

    if not user_id:
        return error("userId is required")

    new_pw = generate_human_password()
    new_pw_hash = hash_password(new_pw)

    with get_db() as db:
        result = db.execute(
            "UPDATE users SET password = ? WHERE id = ? AND disabled = 0",
            (new_pw_hash, user_id),
        )
        db.commit()
        if result.rowcount == 0:
            return not_found("User")

    logger.info("Password reset for user %s", user_id)
    # Return the new plaintext password so the frontend can show/email it
    return jsonify({"success": True, "newPassword": new_pw}), 200
