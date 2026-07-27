"""
database.py - SQLite connection management and helpers
"""

import sqlite3
import os
import stat
import logging
from werkzeug.security import generate_password_hash

SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
logger = logging.getLogger(__name__)
PASSWORD_HASH_METHOD = "pbkdf2:sha256:600000"
SECURE_HASH_PREFIXES = ("pbkdf2:", "scrypt:", "argon2:")


def _db_path() -> str:
    """
    Read DB path lazily so env var overrides work even when set after import.
    Use an absolute path to avoid cwd-dependent surprises.
    """
    return os.path.abspath(os.environ.get("SWIMTRACK_DB", "swimtrack.db"))


def _ensure_secure_db_path(path: str) -> None:
    """
    Harden database path against accidental exposure/overwrite:
    - parent must be a directory (created with 0700 if missing)
    - db file must not be a symlink
    - db file must be a regular file
    - db file permissions are forced to 0600 (owner read/write only)
    """
    parent = os.path.dirname(path) or "."
    if os.path.exists(parent) and not os.path.isdir(parent):
        raise RuntimeError(f"Database parent path is not a directory: {parent}")

    if not os.path.exists(parent):
        os.makedirs(parent, mode=0o700, exist_ok=True)

    if os.path.islink(path):
        raise RuntimeError("Refusing to use symlink as database file")

    if os.path.exists(path):
        st = os.stat(path, follow_symlinks=False)
        if not stat.S_ISREG(st.st_mode):
            raise RuntimeError("Database path must point to a regular file")
    else:
        old_umask = os.umask(0o177)
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.close(fd)
        except FileExistsError:
            pass
        finally:
            os.umask(old_umask)

    # Best-effort on non-POSIX platforms; strict mode on POSIX.
    if os.name != "nt":
        secure_mode = stat.S_IRUSR | stat.S_IWUSR  # 0600
        current_mode = stat.S_IMODE(os.stat(path, follow_symlinks=False).st_mode)
        if current_mode != secure_mode:
            os.chmod(path, secure_mode)


def _harden_sidecar_files(path: str) -> None:
    """Ensure SQLite WAL/SHM sidecar files (if present) are owner-only."""
    if os.name == "nt":
        return
    secure_mode = stat.S_IRUSR | stat.S_IWUSR  # 0600
    for suffix in ("-wal", "-shm"):
        sidecar = f"{path}{suffix}"
        if os.path.exists(sidecar) and not os.path.islink(sidecar):
            current_mode = stat.S_IMODE(os.stat(sidecar, follow_symlinks=False).st_mode)
            if current_mode != secure_mode:
                os.chmod(sidecar, secure_mode)


# Path hardening (stat/chmod syscalls) only needs to happen once per process
# per DB path — not on every connection. get_db() is called several times per
# request, so re-hardening on each open added avoidable syscall overhead under
# load. Track which paths we've already secured.
_hardened_paths: set[str] = set()


def get_db() -> sqlite3.Connection:
    """Open a database connection with row_factory for dict-like access."""
    path = _db_path()
    if path not in _hardened_paths:
        _ensure_secure_db_path(path)
        _hardened_paths.add(path)
    conn = sqlite3.connect(path, timeout=15)
    conn.row_factory = sqlite3.Row
    # foreign_keys and busy_timeout are per-connection (not persisted), so they
    # must be set on every connection. journal_mode = WAL is persisted in the DB
    # header (set once in init_db), so we don't re-issue it here.
    #   - busy_timeout: with WAL + multiple gunicorn workers/threads, a writer
    #     can briefly hold the lock; wait instead of failing with "database is
    #     locked".
    #   - synchronous = NORMAL: safe with WAL and markedly faster on writes.
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def init_db() -> None:
    """Create all tables from schema.sql if they don't exist yet."""
    with open(SCHEMA_PATH, "r") as f:
        schema = f.read()
    with get_db() as conn:
        conn.executescript(schema)
        _migrate_lap_counts_fks(conn)
        _migrate_swimmers_date_of_birth(conn)
        _migrate_competitions_bird_windows(conn)
        _migrate_competitions_slug(conn)
        _migrate_users_force_password_change(conn)
        _migrate_legacy_user_passwords(conn)
    _harden_sidecar_files(_db_path())
    logger.info("Database initialised at %s", _db_path())


def _is_secure_password_hash(value: str) -> bool:
    if not isinstance(value, str):
        return False
    return value.startswith(SECURE_HASH_PREFIXES) and "$" in value


def _migrate_legacy_user_passwords(conn: sqlite3.Connection) -> None:
    """
    Convert legacy plaintext/SHA-256 entries to a strong one-way password hash.
    This removes reversible/cleartext password material from DB at rest.
    """
    rows = conn.execute("SELECT id, password FROM users").fetchall()
    updates = []
    for row in rows:
        stored_password = row["password"] or ""
        if _is_secure_password_hash(stored_password):
            continue
        updates.append((
            generate_password_hash(stored_password, method=PASSWORD_HASH_METHOD),
            row["id"],
        ))

    if updates:
        conn.executemany("UPDATE users SET password = ? WHERE id = ?", updates)
        logger.info("Migrated %d legacy user passwords to secure hashes", len(updates))


def _migrate_lap_counts_fks(conn: sqlite3.Connection) -> None:
    """
    Ensure lap_counts.referee_id AND lap_counts.swimmer_id are nullable and use
    ON DELETE SET NULL. This preserves lap history (and therefore TEAM totals,
    which are counted by team_id) when a referee account or a swimmer is deleted
    during a competition.
    """
    cols = conn.execute("PRAGMA table_info(lap_counts)").fetchall()
    if not cols:
        return

    def _notnull(name: str) -> int:
        col = next((c for c in cols if c["name"] == name), None)
        return int(col["notnull"]) if col else 0

    fk_rows = conn.execute("PRAGMA foreign_key_list(lap_counts)").fetchall()
    on_delete = {fk["from"]: fk["on_delete"] for fk in fk_rows}

    ref_ok = _notnull("referee_id") == 0 and on_delete.get("referee_id") == "SET NULL"
    sw_ok = _notnull("swimmer_id") == 0 and on_delete.get("swimmer_id") == "SET NULL"

    # Already migrated
    if ref_ok and sw_ok:
        return

    logger.info("Applying migration: lap_counts.referee_id + swimmer_id -> NULLABLE + ON DELETE SET NULL")
    conn.executescript(
        """
        CREATE TABLE lap_counts_new (
            id             TEXT PRIMARY KEY,
            competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
            lane_number    INTEGER NOT NULL,
            team_id        TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            swimmer_id     TEXT REFERENCES swimmers(id) ON DELETE SET NULL,
            referee_id     TEXT REFERENCES referees(id) ON DELETE SET NULL,
            lap_number     INTEGER NOT NULL,
            timestamp      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );

        INSERT INTO lap_counts_new (
            id, competition_id, lane_number, team_id, swimmer_id, referee_id, lap_number, timestamp
        )
        SELECT
            id, competition_id, lane_number, team_id, swimmer_id, referee_id, lap_number, timestamp
        FROM lap_counts;

        DROP TABLE lap_counts;
        ALTER TABLE lap_counts_new RENAME TO lap_counts;

        CREATE INDEX IF NOT EXISTS idx_lap_counts_competition ON lap_counts(competition_id);
        CREATE INDEX IF NOT EXISTS idx_lap_counts_team ON lap_counts(team_id);
        CREATE INDEX IF NOT EXISTS idx_lap_counts_timestamp ON lap_counts(competition_id, team_id, timestamp);
        """
    )


def _migrate_swimmers_date_of_birth(conn: sqlite3.Connection) -> None:
    """
    Replace the legacy `is_under_12` boolean with a nullable `date_of_birth`
    (ISO YYYY-MM-DD) column. Existing rows are migrated with date_of_birth NULL;
    operators can backfill via the swimmer edit UI.
    """
    cols = conn.execute("PRAGMA table_info(swimmers)").fetchall()
    if not cols:
        return

    col_names = {c["name"] for c in cols}
    has_dob = "date_of_birth" in col_names
    has_legacy = "is_under_12" in col_names

    if has_dob and not has_legacy:
        return

    logger.info("Applying migration: swimmers.is_under_12 -> date_of_birth")
    conn.executescript(
        """
        CREATE TABLE swimmers_new (
            id             TEXT PRIMARY KEY,
            name           TEXT NOT NULL,
            team_id        TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
            date_of_birth  TEXT,
            parent_name    TEXT,
            parent_contact TEXT,
            parent_present INTEGER NOT NULL DEFAULT 0,
            created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        """
    )

    dob_select = "date_of_birth" if has_dob else "NULL"
    conn.execute(
        f"""
        INSERT INTO swimmers_new (
            id, name, team_id, competition_id, date_of_birth,
            parent_name, parent_contact, parent_present, created_at
        )
        SELECT
            id, name, team_id, competition_id, {dob_select},
            parent_name, parent_contact, parent_present, created_at
        FROM swimmers
        """
    )
    conn.executescript(
        """
        DROP TABLE swimmers;
        ALTER TABLE swimmers_new RENAME TO swimmers;

        CREATE INDEX IF NOT EXISTS idx_swimmers_competition ON swimmers(competition_id);
        CREATE INDEX IF NOT EXISTS idx_swimmers_team ON swimmers(team_id);
        """
    )


def _migrate_competitions_bird_windows(conn: sqlite3.Connection) -> None:
    """
    Add per-competition early/late-bird configuration columns if missing.
    Defaults preserve historical behavior (early=05:00, late=00:00, 60-min window).
    """
    cols = {c["name"] for c in conn.execute("PRAGMA table_info(competitions)").fetchall()}
    if not cols:
        return
    additions = (
        ("early_bird_hour",     "INTEGER NOT NULL DEFAULT 5"),
        ("late_bird_hour",      "INTEGER NOT NULL DEFAULT 0"),
        ("bird_window_minutes", "INTEGER NOT NULL DEFAULT 60"),
    )
    for col, ddl in additions:
        if col not in cols:
            logger.info("Applying migration: competitions ADD COLUMN %s", col)
            conn.execute(f"ALTER TABLE competitions ADD COLUMN {col} {ddl}")


def _migrate_competitions_slug(conn: sqlite3.Connection) -> None:
    """
    Add competitions.slug (UNIQUE) and backfill existing rows with a
    famous-German-surname slug, falling back to '<surname>-<short>' if the
    pool would collide. The unique index is added together with the column.
    """
    cols = {c["name"] for c in conn.execute("PRAGMA table_info(competitions)").fetchall()}
    if "slug" not in cols:
        logger.info("Applying migration: competitions ADD COLUMN slug")
        conn.execute("ALTER TABLE competitions ADD COLUMN slug TEXT")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_competitions_slug ON competitions(slug)")

    # Backfill any NULL slugs deterministically; avoid importing utils here
    # to keep database.py self-contained.
    rows = conn.execute(
        "SELECT id FROM competitions WHERE slug IS NULL OR slug = ''"
    ).fetchall()
    if not rows:
        return

    import random as _random
    import uuid as _uuid
    pool = (
        "einstein", "planck", "heisenberg", "kepler", "hertz", "roentgen",
        "bunsen", "diesel", "benz", "daimler", "zeppelin", "liebig", "hahn",
        "helmholtz", "koch", "virchow", "ohm", "fahrenheit", "gauss", "riemann",
        "hilbert", "weierstrass", "born", "bach", "beethoven", "brahms",
        "wagner", "schumann", "mendelssohn", "handel", "hindemith", "orff",
        "weber", "telemann", "goethe", "schiller", "mann", "hesse", "brecht",
        "grimm", "heine", "fontane", "lessing", "boll", "grass", "kleist",
        "remarque", "kant", "hegel", "nietzsche", "schopenhauer", "leibniz",
        "husserl", "heidegger", "fichte", "frege", "durer", "holbein",
        "friedrich", "beuys", "richter", "kollwitz", "kirchner",
        "beckenbauer", "becker", "schumacher", "witt", "graf", "klopp",
        "neuer", "mueller", "klinsmann",
    )
    used = {
        r[0] for r in conn.execute(
            "SELECT slug FROM competitions WHERE slug IS NOT NULL AND slug != ''"
        ).fetchall()
    }

    def _short(cid_str: str) -> str:
        compact = cid_str.replace("-", "")[:8]
        candidate = compact or _uuid.uuid4().hex[:8]
        while candidate in used:
            candidate = _uuid.uuid4().hex[:8]
        return candidate

    for (cid,) in rows:
        available = [s for s in pool if s not in used]
        slug = _random.choice(available) if available else _short(cid)
        used.add(slug)
        conn.execute("UPDATE competitions SET slug = ? WHERE id = ?", (slug, cid))
        logger.info("Backfilled slug for competition %s -> %s", cid, slug)

    # One-off: release surname slugs from already-completed/stopped
    # competitions so the names become reusable. Each ended row gets a short
    # UUID slug instead. The famous-surname pool is the source of truth here.
    pool_set = set(pool)
    for (cid, slug) in conn.execute(
        "SELECT id, slug FROM competitions WHERE status IN ('completed', 'stopped') AND slug IS NOT NULL"
    ).fetchall():
        if slug in pool_set:
            new_slug = _short(cid)
            used.discard(slug)
            used.add(new_slug)
            conn.execute("UPDATE competitions SET slug = ? WHERE id = ?", (new_slug, cid))
            logger.info("Released slug %s -> %s for ended competition %s", slug, new_slug, cid)


def _migrate_users_force_password_change(conn: sqlite3.Connection) -> None:
    """Add users.force_password_change so a reset can require a new password
    on the very next sign-in."""
    cols = {c["name"] for c in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "force_password_change" not in cols:
        logger.info("Applying migration: users ADD COLUMN force_password_change")
        conn.execute(
            "ALTER TABLE users ADD COLUMN force_password_change INTEGER NOT NULL DEFAULT 0"
        )


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def rows_to_list(rows) -> list[dict]:
    return [dict(r) for r in rows]
