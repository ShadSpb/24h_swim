import unittest
import sqlite3
import json
import os
import tempfile
from unittest.mock import patch, MagicMock
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from functions import row_to_dict, check_data_validity, swimmer_allowed


class TestRowToDict(unittest.TestCase):
    """Test the row_to_dict utility function"""
    
    def setUp(self):
        """Set up a temporary database for testing"""
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_db.close()
        self.connection = sqlite3.connect(self.temp_db.name)
        self.cursor = self.connection.cursor()
        
    def tearDown(self):
        """Clean up temporary database"""
        self.connection.close()
        os.unlink(self.temp_db.name)
    
    def test_row_to_dict_conversion(self):
        """Test that row_to_dict correctly converts database row to dictionary"""
        # Create a test table
        self.cursor.execute("""
            CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                name TEXT,
                value INTEGER
            )
        """)
        self.cursor.execute("INSERT INTO test_table (id, name, value) VALUES (1, 'test', 42)")
        self.connection.commit()
        
        # Fetch and convert
        self.cursor.execute("SELECT * FROM test_table")
        row = self.cursor.fetchone()
        result = row_to_dict(self.cursor, row)
        
        self.assertEqual(result['id'], 1)
        self.assertEqual(result['name'], 'test')
        self.assertEqual(result['value'], 42)


class TestCheckDataValidity(unittest.TestCase):
    """Test the check_data_validity function"""
    
    @patch('functions.application_config')
    def test_valid_swimmer_and_competition(self, mock_config):
        """Test when both swimmer and competition exist"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_db.close()
        
        try:
            # Setup mock config
            mock_config.config.get.return_value = temp_db.name
            
            # Create database with test data
            conn = sqlite3.connect(temp_db.name)
            cur = conn.cursor()
            cur.execute("CREATE TABLE persons (person_id TEXT PRIMARY KEY)")
            cur.execute("CREATE TABLE competitions (competition_id INTEGER PRIMARY KEY)")
            cur.execute("INSERT INTO persons (person_id) VALUES ('test-swimmer-id')")
            cur.execute("INSERT INTO competitions (competition_id) VALUES (1)")
            conn.commit()
            conn.close()
            
            result = check_data_validity('test-swimmer-id', 1)
            self.assertTrue(result)
        finally:
            os.unlink(temp_db.name)
    
    @patch('functions.application_config')
    def test_invalid_swimmer(self, mock_config):
        """Test when swimmer doesn't exist"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_db.close()
        
        try:
            mock_config.config.get.return_value = temp_db.name
            
            conn = sqlite3.connect(temp_db.name)
            cur = conn.cursor()
            cur.execute("CREATE TABLE persons (person_id TEXT PRIMARY KEY)")
            cur.execute("CREATE TABLE competitions (competition_id INTEGER PRIMARY KEY)")
            cur.execute("INSERT INTO competitions (competition_id) VALUES (1)")
            conn.commit()
            conn.close()
            
            result = check_data_validity('nonexistent-swimmer', 1)
            self.assertFalse(result)
        finally:
            os.unlink(temp_db.name)
    
    @patch('functions.application_config')
    def test_invalid_competition(self, mock_config):
        """Test when competition doesn't exist"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_db.close()
        
        try:
            mock_config.config.get.return_value = temp_db.name
            
            conn = sqlite3.connect(temp_db.name)
            cur = conn.cursor()
            cur.execute("CREATE TABLE persons (person_id TEXT PRIMARY KEY)")
            cur.execute("CREATE TABLE competitions (competition_id INTEGER PRIMARY KEY)")
            cur.execute("INSERT INTO persons (person_id) VALUES ('test-swimmer-id')")
            conn.commit()
            conn.close()
            
            result = check_data_validity('test-swimmer-id', 999)
            self.assertFalse(result)
        finally:
            os.unlink(temp_db.name)


class TestSwimmerAllowed(unittest.TestCase):
    """Test the swimmer_allowed function"""
    
    @patch('functions.application_config')
    def test_swimmer_allowed_new_registration(self, mock_config):
        """Test new swimmer can be registered"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_db.close()
        
        try:
            mock_config.config.get.return_value = temp_db.name
            
            conn = sqlite3.connect(temp_db.name)
            cur = conn.cursor()
            cur.execute("CREATE TABLE registration (person_id TEXT, competition_id INTEGER, team_id TEXT, state_id INTEGER, line_no INTEGER)")
            conn.commit()
            conn.close()
            
            result = swimmer_allowed('swimmer-1', 1, 1, 'team-1')
            self.assertTrue(result)
        finally:
            os.unlink(temp_db.name)
    
    @patch('functions.application_config')
    def test_swimmer_already_registered_same_line(self, mock_config):
        """Test swimmer cannot be re-registered to same line"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_db.close()
        
        try:
            mock_config.config.get.return_value = temp_db.name
            
            conn = sqlite3.connect(temp_db.name)
            cur = conn.cursor()
            cur.execute("CREATE TABLE registration (person_id TEXT, competition_id INTEGER, team_id TEXT, state_id INTEGER, line_no INTEGER)")
            cur.execute("INSERT INTO registration VALUES ('swimmer-1', 1, 'team-1', 1, 1)")
            conn.commit()
            conn.close()
            
            result = swimmer_allowed('swimmer-1', 1, 1, 'team-1')
            self.assertFalse(result)
        finally:
            os.unlink(temp_db.name)
    
    @patch('functions.application_config')
    def test_another_team_swimmer_registered(self, mock_config):
        """Test cannot register when another swimmer from same team is active"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_db.close()
        
        try:
            mock_config.config.get.return_value = temp_db.name
            
            conn = sqlite3.connect(temp_db.name)
            cur = conn.cursor()
            cur.execute("CREATE TABLE registration (person_id TEXT, competition_id INTEGER, team_id TEXT, state_id INTEGER, line_no INTEGER)")
            cur.execute("INSERT INTO registration VALUES ('swimmer-1', 1, 'team-1', 1, 1)")
            conn.commit()
            conn.close()
            
            result = swimmer_allowed('swimmer-2', 2, 1, 'team-1')
            self.assertFalse(result)
        finally:
            os.unlink(temp_db.name)


if __name__ == '__main__':
    unittest.main()
