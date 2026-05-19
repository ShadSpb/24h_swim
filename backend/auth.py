"""
auth.py - Authentication endpoints
POST /auth/login
POST /auth/register
POST /auth/logout
POST /auth/forgot-password   (public: email -> reset + Mailgun delivery)
POST /auth/change-password   (authenticated self-service for organizers)
POST /auth/reset-password    (legacy admin reset by userId — kept for compat)
GET  /auth/users
"""

import logging
from flask import Blueprint, request, jsonify
from database import get_db
from utils import (
    new_uuid, is_valid_email,
    error, not_found, serialize_user,
    generate_human_password, hash_password, verify_password,
)
import email_service

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
            "UPDATE users SET password = ?, force_password_change = 1 WHERE id = ? AND disabled = 0",
            (new_pw_hash, user_id),
        )
        db.commit()
        if result.rowcount == 0:
            return not_found("User")

    logger.info("Password reset for user %s", user_id)
    # Return the new plaintext password so the frontend can show/email it
    return jsonify({"success": True, "newPassword": new_pw}), 200


# ── Self-service flows ────────────────────────────────────────────────────────

@auth_bp.route("/auth/forgot-password", methods=["POST"])
def forgot_password():
    """
    Public password-reset request.

    Body: { "email": "..." }

    To avoid leaking which addresses have accounts, this endpoint always
    returns a 200 generic-success response. When the email matches an
    organizer account we generate a new password, persist it, mark the
    user as 'must change password on next login', and deliver the new
    password via Mailgun.

    Referees never receive reset emails — they are managed by the
    organizer and have no contact address on file.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    generic_ok = jsonify({"success": True}), 200

    if not email or not is_valid_email(email):
        return generic_ok

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM users WHERE lower(email) = ? AND disabled = 0 AND role = 'organizer'",
            (email,),
        ).fetchone()

    if not row:
        logger.info("Forgot-password for unknown/non-organizer email: %s", email)
        return generic_ok

    if not email_service.is_configured():
        # Don't change the password if we can't deliver it — would lock the user out.
        logger.error("Forgot-password requested but Mailgun is not configured; ignoring")
        return generic_ok

    user = dict(row)
    new_pw = generate_human_password()
    subject, text, html = email_service.render_password_reset(user["email"], new_pw, user.get("name"))
    ok, err = email_service.send_email(user["email"], subject, text, html)
    if not ok:
        logger.error("Failed to send reset email to %s: %s", user["email"], err)
        return generic_ok

    # Only persist the new password once the email is on its way.
    with get_db() as db:
        db.execute(
            "UPDATE users SET password = ?, force_password_change = 1 WHERE id = ?",
            (hash_password(new_pw), user["id"]),
        )
        db.commit()

    logger.info("Password reset email delivered to %s", user["email"])
    return generic_ok


@auth_bp.route("/auth/change-password", methods=["POST"])
def change_password():
    """
    Self-service password change for organizers.

    Body: { "userId": "...", "currentPassword": "...", "newPassword": "..." }

    Identity is proven by knowing the current password — no separate
    session check is required. Referees are explicitly rejected: their
    credentials are organizer-managed and rotated via the referee panel.
    """
    data = request.get_json(silent=True) or {}
    user_id   = (data.get("userId") or "").strip()
    current   = (data.get("currentPassword") or "").strip()
    new_pw    = (data.get("newPassword") or "").strip()

    if not user_id or not current or not new_pw:
        return jsonify({"success": False, "error": "userId, currentPassword and newPassword are required"}), 400

    if len(new_pw) < 8:
        return jsonify({"success": False, "error": "New password must be at least 8 characters"}), 400

    if new_pw == current:
        return jsonify({"success": False, "error": "New password must be different from the current one"}), 400

    with get_db() as db:
        row = db.execute(
            "SELECT * FROM users WHERE id = ? AND disabled = 0",
            (user_id,),
        ).fetchone()
    if not row:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    user = dict(row)
    if user.get("role") != "organizer":
        return jsonify({"success": False, "error": "Password change is only available for organizer accounts"}), 403

    is_valid, _ = verify_password(current, user["password"])
    if not is_valid:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    with get_db() as db:
        db.execute(
            "UPDATE users SET password = ?, force_password_change = 0 WHERE id = ?",
            (hash_password(new_pw), user["id"]),
        )
        db.commit()
        refreshed = dict(db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone())

    logger.info("User %s changed password", user["email"])
    return jsonify({"success": True, "user": serialize_user(refreshed)}), 200
