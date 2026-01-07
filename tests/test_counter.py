import unittest
import json
import os
import sys
import tempfile
import sqlite3
from unittest.mock import patch
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from counter import counter


class TestCounterBlueprint(unittest.TestCase):
    """Test the counter blueprint endpoints"""
    
    def setUp(self):
        """Set up Flask test client"""
        self.app = Flask(__name__)
        self.app.register_blueprint(counter)
        self.client = self.app.test_client()
    
    def test_count_line_forbidden_non_localhost(self):
        """Test POST /counter/ returns 403 for non-localhost"""
        response = self.client.post(
            '/counter/',
            data=json.dumps({
                "swimmer_id": "swimmer-1",
                "competition_id": 1
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)
    
    @patch('counter.application_config')
    @patch('counter.functions')
    def test_count_line_no_data(self, mock_functions, mock_config):
        """Test POST /counter/ returns 400 when no data provided"""
        response = self.client.post(
            '/counter/',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'failed')
        self.assertEqual(data['reason'], 'no data')
    
    @patch('counter.application_config')
    @patch('counter.functions')
    def test_count_line_invalid_json(self, mock_functions, mock_config):
        """Test POST /counter/ returns 400 for invalid JSON"""
        response = self.client.post(
            '/counter/',
            data=json.dumps({
                "swimmer_id": 12345,  # Should be string
                "competition_id": "not-an-integer"
            }),
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['reason'], 'invalid json')
    
    @patch('counter.application_config')
    @patch('counter.functions')
    def test_count_line_invalid_data(self, mock_functions, mock_config):
        """Test POST /counter/ returns 400 when swimmer/competition invalid"""
        mock_functions.check_data_validity.return_value = False
        
        response = self.client.post(
            '/counter/',
            data=json.dumps({
                "swimmer_id": "invalid-swimmer",
                "competition_id": 999
            }),
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['reason'], 'invalid data')
    
    @patch('counter.application_config')
    @patch('counter.functions')
    def test_count_line_swimmer_not_registered(self, mock_functions, mock_config):
        """Test POST /counter/ returns 400 when swimmer not registered"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_db.close()
        
        try:
            mock_config.config.get.return_value = temp_db.name
            mock_functions.check_data_validity.return_value = True
            
            # Create database without swimmer registration
            conn = sqlite3.connect(temp_db.name)
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE registration (
                    person_id TEXT,
                    competition_id INTEGER,
                    state_id INTEGER
                )
            """)
            conn.commit()
            conn.close()
            
            response = self.client.post(
                '/counter/',
                data=json.dumps({
                    "swimmer_id": "swimmer-1",
                    "competition_id": 1
                }),
                content_type='application/json',
                environ_base={'REMOTE_ADDR': '127.0.0.1'}
            )
            
            self.assertEqual(response.status_code, 400)
            data = json.loads(response.data)
            self.assertEqual(data['reason'], 'counter forbidden')
        finally:
            os.unlink(temp_db.name)
    
    @patch('counter.application_config')
    @patch('counter.functions')
    def test_count_line_success(self, mock_functions, mock_config):
        """Test POST /counter/ successfully counts lap"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_db.close()
        
        try:
            mock_config.config.get.return_value = temp_db.name
            mock_functions.check_data_validity.return_value = True
            
            # Create database with registered swimmer
            conn = sqlite3.connect(temp_db.name)
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE registration (
                    person_id TEXT,
                    competition_id INTEGER,
                    state_id INTEGER,
                    team_id TEXT,
                    line_no INTEGER
                )
            """)
            cur.execute("""
                CREATE TABLE counter (
                    competition_id INTEGER,
                    team_id TEXT,
                    line_no INTEGER,
                    person_id TEXT
                )
            """)
            cur.execute("""
                CREATE TABLE persons (
                    person_id TEXT PRIMARY KEY,
                    team_id TEXT
                )
            """)
            cur.execute("INSERT INTO persons VALUES ('swimmer-1', 'team-1')")
            cur.execute("INSERT INTO registration VALUES ('swimmer-1', 1, 1, 'team-1', 1)")
            conn.commit()
            conn.close()
            
            response = self.client.post(
                '/counter/',
                data=json.dumps({
                    "swimmer_id": "swimmer-1",
                    "competition_id": 1
                }),
                content_type='application/json',
                environ_base={'REMOTE_ADDR': '127.0.0.1'}
            )
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertEqual(data['status'], 'success')
        finally:
            os.unlink(temp_db.name)


if __name__ == '__main__':
    unittest.main()
