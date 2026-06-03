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


def send_email(
    to: str,
    subject: str,
    text: str,
    html: str | None = None,
    reply_to: str | None = None,
) -> tuple[bool, str | None]:
    """
    Send one email via Mailgun. Returns (ok, error_message).
    `to` must be a single address (this helper deliberately does not
    accept bulk lists — the only senders here are 1:1 transactional).
    `reply_to`, when given, sets the Reply-To header so replies go to a
    different address than the (domain-locked) From.
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
    if reply_to and "@" in reply_to:
        fields["h:Reply-To"] = reply_to
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


def render_welcome_email(email: str, name: str | None = None, lang: str = "de") -> tuple[str, str, str]:
    """Return (subject, text, html) for the organizer welcome email."""
    app_url = _config()["app_url"]
    greet_name = name or email.split("@")[0]

    if lang.lower().startswith("en"):
        subject = "Welcome to 24swim.de — your organizer account is ready"
        text = (
            f"Hello {greet_name},\n\n"
            "Your 24swim.de organizer account is active. You can start\n"
            "setting up your 24-hour swim event right away.\n\n"
            "Suggested steps:\n"
            "  1. Sign in to your dashboard.\n"
            "  2. Create your first competition (date, lanes, lane length,\n"
            "     and the Early/Late Bird bonus hours).\n"
            "  3. Add teams (name + colour, assign each to a lane).\n"
            "  4. Add swimmers to their teams. For under-12 swimmers,\n"
            "     fill in the parent contact — it's required.\n"
            "  5. Add referees. Each referee gets an auto-generated login\n"
            "     ID and password — copy these and share them.\n"
            "  6. Start the competition. Referees count laps from their\n"
            "     phones; you (and anyone with the public link) can watch\n"
            "     the live monitor in real time.\n\n"
            "Other useful things:\n"
            "  • Each competition has a short URL like /monitor/einstein\n"
            "    that you can print as a QR code on the dashboard.\n"
            "  • Once a competition ends, results can be exported as PDF.\n"
            "  • Need to change your password later? Use the 'Change\n"
            "    password' item in the user menu on every page.\n"
            "  • Forgot your password? Use 'Forgot password?' on the\n"
            "    login screen — we'll email a new one to this address.\n\n"
            f"Sign in: {app_url}/login\n"
            f"Help / FAQ: {app_url}/faq\n\n"
            "Have a great event!\n"
            "— 24swim.de"
        )
        html = f"""<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#222;max-width:560px;margin:24px auto;line-height:1.5">
  <h2 style="color:#0ea5e9">Welcome to 24swim.de</h2>
  <p>Hello <strong>{greet_name}</strong>,</p>
  <p>Your organizer account is active. You can start setting up your 24-hour swim event right away.</p>
  <h3 style="margin-top:24px;color:#0f172a">Suggested next steps</h3>
  <ol>
    <li>Sign in to your dashboard.</li>
    <li>Create your first competition — date, lanes, lane length, and the Early/Late Bird bonus hours.</li>
    <li>Add teams (name + colour, assign each to a lane).</li>
    <li>Add swimmers. For under-12 swimmers, fill in the parent contact — it's required.</li>
    <li>Add referees. Each referee gets an auto-generated login ID and password — copy these and share them.</li>
    <li>Start the competition. Referees count laps from their phones; the live monitor shows the leaderboard in real time.</li>
  </ol>
  <h3 style="margin-top:24px;color:#0f172a">Other useful things</h3>
  <ul>
    <li>Each competition has a short URL like <code>/monitor/einstein</code> with a QR code printable from the dashboard.</li>
    <li>Once a competition ends you can export the results as PDF.</li>
    <li>Need to change your password later? Use the <strong>Change password</strong> item in the user menu.</li>
    <li>Forgot your password? Use <strong>Forgot password?</strong> on the login screen — a fresh one will be emailed to this address.</li>
  </ul>
  <p style="margin-top:24px">
    <a href="{app_url}/login" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Sign in to 24swim.de</a>
    &nbsp;
    <a href="{app_url}/faq" style="color:#0ea5e9">FAQ →</a>
  </p>
  <p style="color:#888;font-size:12px;margin-top:24px">If you didn't register on 24swim.de, just ignore this email — no further action is needed.</p>
</body></html>"""
        return subject, text, html

    # Default: German
    subject = "Willkommen bei 24swim.de — Ihr Organisator-Konto ist aktiv"
    text = (
        f"Hallo {greet_name},\n\n"
        "Ihr Organisator-Konto auf 24swim.de ist aktiv. Sie können sofort\n"
        "mit der Einrichtung Ihrer 24-Stunden-Schwimmveranstaltung beginnen.\n\n"
        "Nächste Schritte:\n"
        "  1. Im Dashboard anmelden.\n"
        "  2. Ersten Wettbewerb anlegen (Datum, Bahnen, Bahnlänge sowie\n"
        "     die Frühstarter- und Nachtstarter-Zeitfenster).\n"
        "  3. Teams hinzufügen (Name + Farbe, jeweils einer Bahn zugeordnet).\n"
        "  4. Schwimmer den Teams hinzufügen. Bei Schwimmern unter 12 Jahren\n"
        "     ist ein Elternkontakt Pflicht.\n"
        "  5. Schiedsrichter anlegen. Jeder Schiedsrichter erhält eine\n"
        "     automatisch generierte Login-ID und ein Passwort — bitte kopieren\n"
        "     und an die Person weitergeben.\n"
        "  6. Wettbewerb starten. Die Schiedsrichter zählen Bahnen vom Handy;\n"
        "     Sie (und jeder mit dem öffentlichen Link) sehen die Live-Anzeige\n"
        "     in Echtzeit.\n\n"
        "Weitere nützliche Funktionen:\n"
        "  • Jeder Wettbewerb hat eine kurze URL wie /monitor/einstein,\n"
        "    die als QR-Code im Dashboard druckbar ist.\n"
        "  • Nach Wettbewerbsende lassen sich die Ergebnisse als PDF\n"
        "    exportieren.\n"
        "  • Passwort später ändern? Über 'Passwort ändern' im Benutzermenü.\n"
        "  • Passwort vergessen? Auf der Anmeldeseite 'Passwort vergessen?'\n"
        "    auswählen — ein neues Passwort wird an diese Adresse gesendet.\n\n"
        f"Anmelden: {app_url}/login\n"
        f"Hilfe / FAQ: {app_url}/faq\n\n"
        "Viel Erfolg mit Ihrer Veranstaltung!\n"
        "— 24swim.de"
    )
    html = f"""<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#222;max-width:560px;margin:24px auto;line-height:1.5">
  <h2 style="color:#0ea5e9">Willkommen bei 24swim.de</h2>
  <p>Hallo <strong>{greet_name}</strong>,</p>
  <p>Ihr Organisator-Konto ist aktiv. Sie können sofort mit der Einrichtung Ihrer 24-Stunden-Schwimmveranstaltung beginnen.</p>
  <h3 style="margin-top:24px;color:#0f172a">Nächste Schritte</h3>
  <ol>
    <li>Im Dashboard anmelden.</li>
    <li>Ersten Wettbewerb anlegen — Datum, Bahnen, Bahnlänge sowie Frühstarter- und Nachtstarter-Zeitfenster.</li>
    <li>Teams hinzufügen (Name + Farbe, jeweils einer Bahn zugeordnet).</li>
    <li>Schwimmer den Teams zuordnen. Bei Schwimmern unter 12 Jahren ist ein Elternkontakt Pflicht.</li>
    <li>Schiedsrichter anlegen. Jeder erhält eine automatisch generierte Login-ID und ein Passwort — bitte weiterleiten.</li>
    <li>Wettbewerb starten. Die Schiedsrichter zählen Bahnen vom Handy; die Live-Anzeige aktualisiert sich automatisch.</li>
  </ol>
  <h3 style="margin-top:24px;color:#0f172a">Weitere nützliche Funktionen</h3>
  <ul>
    <li>Jeder Wettbewerb hat eine kurze URL wie <code>/monitor/einstein</code> mit druckbarem QR-Code im Dashboard.</li>
    <li>Nach Wettbewerbsende lassen sich die Ergebnisse als PDF exportieren.</li>
    <li>Passwort später ändern? Über <strong>Passwort ändern</strong> im Benutzermenü.</li>
    <li>Passwort vergessen? Auf der Anmeldeseite <strong>Passwort vergessen?</strong> auswählen — ein neues Passwort wird an diese Adresse gesendet.</li>
  </ul>
  <p style="margin-top:24px">
    <a href="{app_url}/login" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Bei 24swim.de anmelden</a>
    &nbsp;
    <a href="{app_url}/faq" style="color:#0ea5e9">FAQ →</a>
  </p>
  <p style="color:#888;font-size:12px;margin-top:24px">Falls Sie sich nicht auf 24swim.de registriert haben, ignorieren Sie diese E-Mail einfach — es ist nichts weiter zu tun.</p>
</body></html>"""
    return subject, text, html


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


def render_question_email(question: str, from_email: str | None = None) -> tuple[str, str, str]:
    """Return (subject, text, html) for a FAQ 'Ask a question' submission."""
    subject = "24swim.de - Question"
    sender = (from_email or "").strip() or "(no email provided)"
    text = (
        "A new question was submitted via the 24swim.de FAQ page.\n\n"
        f"From: {sender}\n\n"
        "Question:\n"
        f"{question}\n"
    )
    # Escape user-supplied content for the HTML part.
    from html import escape as _esc
    html = f"""<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#222;max-width:560px;margin:24px auto;line-height:1.5">
  <h2 style="color:#0ea5e9">24swim.de — New question</h2>
  <p><strong>From:</strong> {_esc(sender)}</p>
  <p><strong>Question:</strong></p>
  <p style="background:#f4f6f8;padding:12px 16px;border-radius:6px;white-space:pre-wrap">{_esc(question)}</p>
  <p style="color:#888;font-size:12px;margin-top:24px">Submitted via the FAQ page. Reply directly to answer the sender.</p>
</body></html>"""
    return subject, text, html
