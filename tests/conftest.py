"""
Test configuration and fixtures for the 24h Swimming Event API tests

This module provides common setup, fixtures, and utilities for testing.
"""

import os
import tempfile
import sqlite3


def create_test_database(db_path):
    """
    Create a test database with the required schema
    
    Args:
        db_path: Path to create the database at
    """
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Create persons table
    cur.execute("""
        CREATE TABLE persons (
            person_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            surname TEXT NOT NULL,
            type_id INTEGER,
            team TEXT
        )
    """)
    
    # Create types table
    cur.execute("""
        CREATE TABLE types (
            type_id INTEGER PRIMARY KEY,
            type_name TEXT NOT NULL
        )
    """)
    
    # Create teams table
    cur.execute("""
        CREATE TABLE teams (
            team_id TEXT PRIMARY KEY,
            team_name TEXT NOT NULL
        )
    """)
    
    # Create competitions table
    cur.execute("""
        CREATE TABLE competitions (
            competition_id INTEGER PRIMARY KEY,
            competition_name TEXT
        )
    """)
    
    # Create registration table
    cur.execute("""
        CREATE TABLE registration (
            competition_id INTEGER,
            team_id TEXT,
            line_no INTEGER,
            person_id TEXT,
            state_id INTEGER,
            PRIMARY KEY (competition_id, person_id)
        )
    """)
    
    # Create counter table
    cur.execute("""
        CREATE TABLE counter (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            competition_id INTEGER,
            team_id TEXT,
            line_no INTEGER,
            person_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Insert test data
    cur.execute("INSERT INTO types VALUES (1, 'swimmer')")
    cur.execute("INSERT INTO types VALUES (2, 'organizer')")
    cur.execute("INSERT INTO types VALUES (3, 'referee')")
    
    cur.execute("INSERT INTO teams VALUES ('team-1', 'Team A')")
    cur.execute("INSERT INTO teams VALUES ('team-2', 'Team B')")
    cur.execute("INSERT INTO teams VALUES ('team-3', 'Team C')")
    
    cur.execute("INSERT INTO competitions VALUES (1, 'Competition 1')")
    cur.execute("INSERT INTO competitions VALUES (2, 'Competition 2')")
    
    conn.commit()
    conn.close()


class TestDatabase:
    """Context manager for test database"""
    
    def __init__(self):
        self.temp_file = None
        self.db_path = None
    
    def __enter__(self):
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_file.close()
        self.db_path = self.temp_file.name
        create_test_database(self.db_path)
        return self.db_path
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.db_path and os.path.exists(self.db_path):
            os.unlink(self.db_path)


if __name__ == '__main__':
    # Create a sample test database for inspection
    test_db_path = 'test_sample.db'
    create_test_database(test_db_path)
    print(f"Test database created at: {test_db_path}")
