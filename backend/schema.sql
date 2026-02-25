-- SwimTrack 24 - Database Schema
-- Matches frontend API contract exactly

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Users (organizers + referees)
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,           -- UUID
    email       TEXT UNIQUE NOT NULL,       -- login identifier
    name        TEXT NOT NULL,
    password    TEXT NOT NULL,              -- one-way password hash (PBKDF2/scrypt)
    role        TEXT NOT NULL CHECK(role IN ('organizer', 'referee')),
    disabled    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Competitions
CREATE TABLE IF NOT EXISTS competitions (
    id                   TEXT PRIMARY KEY,  -- UUID
    name                 TEXT NOT NULL,
    description          TEXT NOT NULL DEFAULT '',
    date                 TEXT NOT NULL,     -- YYYY-MM-DD
    start_time           TEXT NOT NULL,     -- HH:MM
    end_time             TEXT NOT NULL DEFAULT '',
    location             TEXT NOT NULL,
    number_of_lanes      INTEGER NOT NULL DEFAULT 1,
    lane_length          INTEGER NOT NULL DEFAULT 25,
    double_count_timeout INTEGER NOT NULL DEFAULT 15,
    organizer_id         TEXT NOT NULL REFERENCES users(id),
    status               TEXT NOT NULL DEFAULT 'upcoming'
                             CHECK(status IN ('upcoming','active','paused','completed','stopped')),
    auto_start           INTEGER NOT NULL DEFAULT 0,
    auto_finish          INTEGER NOT NULL DEFAULT 0,
    actual_start_time    TEXT,
    actual_end_time      TEXT,
    results_pdf          TEXT,              -- base64 data URI
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    id             TEXT PRIMARY KEY,        -- UUID
    name           TEXT NOT NULL,
    color          TEXT NOT NULL DEFAULT '#3b82f6',  -- hex color
    logo           TEXT,                    -- optional URL/base64
    competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    assigned_lane  INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(competition_id, color, assigned_lane)  -- same color same lane forbidden
);

-- Swimmers
CREATE TABLE IF NOT EXISTS swimmers (
    id             TEXT PRIMARY KEY,        -- UUID
    name           TEXT NOT NULL,
    team_id        TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    is_under_12    INTEGER NOT NULL DEFAULT 0,
    parent_name    TEXT,
    parent_contact TEXT,
    parent_present INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Referees (linked to a user account)
CREATE TABLE IF NOT EXISTS referees (
    id             TEXT PRIMARY KEY,        -- UUID
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unique_id      TEXT NOT NULL,           -- e.g. ref_12345
    competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    email          TEXT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(competition_id, user_id)
);

-- Swim Sessions (a swimmer actively in the water)
CREATE TABLE IF NOT EXISTS swim_sessions (
    id             TEXT PRIMARY KEY,        -- UUID
    competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    swimmer_id     TEXT NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
    team_id        TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    lane_number    INTEGER NOT NULL,
    start_time     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    end_time       TEXT,
    lap_count      INTEGER NOT NULL DEFAULT 0,
    is_active      INTEGER NOT NULL DEFAULT 1
);

-- Lap Counts (immutable event log)
CREATE TABLE IF NOT EXISTS lap_counts (
    id             TEXT PRIMARY KEY,        -- UUID
    competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    lane_number    INTEGER NOT NULL,
    team_id        TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    swimmer_id     TEXT NOT NULL REFERENCES swimmers(id) ON DELETE CASCADE,
    referee_id     TEXT REFERENCES referees(id) ON DELETE SET NULL,
    lap_number     INTEGER NOT NULL,
    timestamp      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_competitions_organizer ON competitions(organizer_id);
CREATE INDEX IF NOT EXISTS idx_teams_competition ON teams(competition_id);
CREATE INDEX IF NOT EXISTS idx_swimmers_competition ON swimmers(competition_id);
CREATE INDEX IF NOT EXISTS idx_swimmers_team ON swimmers(team_id);
CREATE INDEX IF NOT EXISTS idx_referees_competition ON referees(competition_id);
CREATE INDEX IF NOT EXISTS idx_swim_sessions_competition ON swim_sessions(competition_id);
CREATE INDEX IF NOT EXISTS idx_swim_sessions_team ON swim_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_swim_sessions_active ON swim_sessions(competition_id, is_active);
CREATE INDEX IF NOT EXISTS idx_lap_counts_competition ON lap_counts(competition_id);
CREATE INDEX IF NOT EXISTS idx_lap_counts_team ON lap_counts(team_id);
CREATE INDEX IF NOT EXISTS idx_lap_counts_timestamp ON lap_counts(competition_id, team_id, timestamp);
