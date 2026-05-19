"""
email_service.py - Send transactional emails via the Mailgun HTTP API.

Configuration is environment-only (never sent to the browser):
  MAILGUN_API_KEY     Mailgun private API key (required).
  MAILGUN_DOMAIN      Mailgun sending domain, e.g. mg.24swim.de (required).
  MAILGUN_BASE_URL    https://api.eu.mailgun.net/v3  (default; EU region)
                      https://api.mailgun.net/v3     (US region)
  MAILGUN_FROM        From header, e.g. '24swim.de <no-reply@mg.24swim.de>'
                      (defaults to no-reply@<MAILGUN_DOMAIN>).
  APP_URL             Public site URL used in email links
                      (default https://24swim.de).

Uses only the Python stdlib so no new pip dependencies are required.
"""

import logging
import os
from base64 import b64encode
from urllib import request as _urlrequest
from urllib import parse as _urlparse
from urllib import error as _urlerror

logger = logging.getLogger(__name__)


def _config() -> dict:
    return {
        "api_key":  (os.environ.get("MAILGUN_API_KEY") or "").strip(),
        "domain":   (os.environ.get("MAILGUN_DOMAIN") or "").strip(),
        "base_url": (os.environ.get("MAILGUN_BASE_URL") or "https://api.eu.mailgun.net/v3").rstrip("/"),
        "from":     (os.environ.get("MAILGUN_FROM") or "").strip(),
        "app_url":  (os.environ.get("APP_URL") or "https://24swim.de").rstrip("/"),
    }


def is_configured() -> bool:
    c = _config()
    return bool(c["api_key"] and c["domain"])


def send_email(to: str, subject: str, text: str, html: str | None = None) -> tuple[bool, str | None]:
    """
    Send one email via Mailgun. Returns (ok, error_message).
    `to` must be a single address (this helper deliberately does not
    accept bulk lists — the only senders here are 1:1 transactional).
    """
    cfg = _config()
    if not cfg["api_key"] or not cfg["domain"]:
        return False, "Email service is not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN missing)"

    if not to or "@" not in to:
        return False, "Invalid recipient"

    from_addr = cfg["from"] or f"no-reply@{cfg['domain']}"
    url = f"{cfg['base_url']}/{cfg['domain']}/messages"

    fields = {
        "from":    from_addr,
        "to":      to,
        "subject": subject,
        "text":    text,
    }
    if html:
        fields["html"] = html
    body = _urlparse.urlencode(fields).encode("utf-8")

    auth = b64encode(f"api:{cfg['api_key']}".encode("ascii")).decode("ascii")
    req = _urlrequest.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type":  "application/x-www-form-urlencoded",
        },
        method="POST",
    )

    try:
        with _urlrequest.urlopen(req, timeout=10) as resp:
            status = resp.status
            if 200 <= status < 300:
                return True, None
            return False, f"Mailgun returned HTTP {status}"
    except _urlerror.HTTPError as e:
        # Don't log the response body — it may contain recipient detail.
        logger.warning("Mailgun HTTP error: %s %s", e.code, e.reason)
        return False, f"Mailgun HTTP {e.code}: {e.reason}"
    except _urlerror.URLError as e:
        logger.warning("Mailgun network error: %s", e.reason)
        return False, f"Network error: {e.reason}"
    except Exception as e:  # defensive — never let email failures crash the request
        logger.exception("Mailgun send failed")
        return False, f"Unexpected error: {e.__class__.__name__}"


def render_password_reset(email: str, new_password: str, name: str | None = None) -> tuple[str, str, str]:
    """Return (subject, text, html) for the password-reset email."""
    app_url = _config()["app_url"]
    greeting = f"Hello {name}," if name else "Hello,"
    subject = "Your 24swim.de password has been reset"
    text = (
        f"{greeting}\n\n"
        "Your 24swim.de password has been reset. Here is your new password:\n\n"
        f"    {new_password}\n\n"
        f"Log in here: {app_url}/login\n\n"
        "You will be asked to change this password the first time you sign in.\n\n"
        "If you did not request this reset, please contact the competition\n"
        "organizer immediately.\n\n"
        "— 24swim.de"
    )
    html = f"""<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#222;max-width:520px;margin:24px auto">
  <h2 style="color:#0ea5e9">24swim.de — Password Reset</h2>
  <p>{greeting}</p>
  <p>Your 24swim.de password has been reset. Use the password below to sign in:</p>
  <p style="font-family:monospace;font-size:20px;background:#f4f6f8;padding:12px 16px;border-radius:6px;display:inline-block">{new_password}</p>
  <p><a href="{app_url}/login" style="color:#0ea5e9">Sign in to 24swim.de →</a></p>
  <p style="background:#fff7e6;border-left:4px solid #f59e0b;padding:8px 12px;margin-top:16px">
    For your security you will be required to choose a new password the first time you sign in.
  </p>
  <p style="color:#888;font-size:12px;margin-top:24px">
    If you did not request this reset, please contact the competition organizer immediately.
  </p>
</body></html>"""
    return subject, text, html
