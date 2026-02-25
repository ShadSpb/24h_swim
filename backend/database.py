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


def get_db() -> sqlite3.Connection:
    """Open a database connection with row_factory for dict-like access."""
    path = _db_path()
    _ensure_secure_db_path(path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    """Create all tables from schema.sql if they don't exist yet."""
    with open(SCHEMA_PATH, "r") as f:
        schema = f.read()
    with get_db() as conn:
        conn.executescript(schema)
        _migrate_lap_counts_referee_fk(conn)
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


def _migrate_lap_counts_referee_fk(conn: sqlite3.Connection) -> None:
    """
    Ensure lap_counts.referee_id is nullable and uses ON DELETE SET NULL.
    This preserves lap history when a referee account is deleted.
    """
    cols = conn.execute("PRAGMA table_info(lap_counts)").fetchall()
    if not cols:
        return

    ref_col = next((c for c in cols if c["name"] == "referee_id"), None)
    ref_notnull = int(ref_col["notnull"]) if ref_col else 0

    fk_rows = conn.execute("PRAGMA foreign_key_list(lap_counts)").fetchall()
    ref_on_delete = None
    for fk in fk_rows:
        if fk["from"] == "referee_id":
            ref_on_delete = fk["on_delete"]
            break

    # Already migrated
    if ref_notnull == 0 and ref_on_delete == "SET NULL":
        return

    logger.info("Applying migration: lap_counts.referee_id -> NULLABLE + ON DELETE SET NULL")
    conn.executescript(
        """
        CREATE TABLE lap_counts_new (
            id             TEXT PRIMARY KEY,
            competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
            lane_number    INTEGER NOT NULL,
            team_id        TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            swimmer_id     TEXT NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
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


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def rows_to_list(rows) -> list[dict]:
    return [dict(r) for r in rows]
