"""
feedback.py - Public "Ask a question" endpoint for the FAQ page.

POST /faq/question
Body: { "question": "...", "email": "optional@sender" }

Sends the question to the site contact address via Mailgun. The sender's
address (if supplied) is set as Reply-To so the contact can answer directly.
This endpoint is intentionally unauthenticated — it is exempted from the
API-key guard in app.py, just like the other public auth endpoints.
"""

import logging
import os

from flask import Blueprint, request

from utils import error, success, is_valid_email
import email_service

feedback_bp = Blueprint("feedback", __name__)
logger = logging.getLogger(__name__)

# Where FAQ questions are delivered. Overridable via env; sensible default.
FAQ_RECIPIENT = (os.environ.get("FAQ_RECIPIENT") or "shad.spb@gmail.com").strip()

MAX_QUESTION_LEN = 5000


@feedback_bp.route("/faq/question", methods=["POST"])
def ask_question():
    data = request.get_json(silent=True) or {}

    question = (data.get("question") or "").strip()
    sender = (data.get("email") or "").strip()

    if not question:
        return error("Question is required")
    if len(question) > MAX_QUESTION_LEN:
        return error("Question is too long")
    # Email is optional, but if provided it must look valid.
    if sender and not is_valid_email(sender):
        return error("Invalid email address")

    if not email_service.is_configured():
        logger.error("FAQ question submitted but Mailgun is not configured")
        return error("Email service is not available right now", status=503)

    subject, text, html = email_service.render_question_email(question, sender or None)
    sent, err = email_service.send_email(
        FAQ_RECIPIENT, subject, text, html, reply_to=sender or None
    )
    if not sent:
        logger.error("Failed to deliver FAQ question: %s", err)
        return error("Could not send your question. Please try again later.", status=502)

    logger.info("FAQ question delivered to %s (from %s)", FAQ_RECIPIENT, sender or "anonymous")
    return success()
