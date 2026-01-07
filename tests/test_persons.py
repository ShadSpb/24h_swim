import unittest
import json
import os
import sys
import tempfile
import sqlite3
from unittest.mock import patch, MagicMock
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from persons import persons


class TestPersonsBlueprint(unittest.TestCase):
    """Test the persons blueprint endpoints"""
    
    def setUp(self):
        """Set up Flask test client"""
        self.app = Flask(__name__)
        self.app.register_blueprint(persons)
        self.client = self.app.test_client()
        
    def test_get_persons_forbidden_non_localhost(self):
        """Test GET /persons/ returns 403 for non-localhost"""
        response = self.client.get('/persons/')
        self.assertEqual(response.status_code, 403)
    
    @patch('persons.application_config')
    def test_get_persons_success(self, mock_config):
        """Test GET /persons/ returns 200 for localhost"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_db.close()
        
        try:
            mock_config.config.get.return_value = temp_db.name
            
            # Create mock database
            conn = sqlite3.connect(temp_db.name)
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE persons (
                    person_id TEXT PRIMARY KEY,
                    name TEXT,
                    surname TEXT,
                    type_id INTEGER,
                    team TEXT
                )
            """)
            cur.execute("""
                CREATE TABLE types (
                    type_id INTEGER PRIMARY KEY,
                    type_name TEXT
                )
            """)
            cur.execute("""
                CREATE TABLE teams (
                    team_id TEXT PRIMARY KEY,
                    team_name TEXT
                )
            """)
            cur.execute("INSERT INTO types VALUES (1, 'swimmer')")
            cur.execute("INSERT INTO teams VALUES ('team-1', 'Team A')")
            cur.execute("INSERT INTO persons VALUES ('person-1', 'John', 'Doe', 1, 'team-1')")
            conn.commit()
            conn.close()
            
            response = self.client.get(
                '/persons/',
                environ_base={'REMOTE_ADDR': '127.0.0.1'}
            )
            
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertIsInstance(data, list)
        finally:
            os.unlink(temp_db.name)
    
    def test_post_persons_forbidden_non_localhost(self):
        """Test POST /persons/ returns 403 for non-localhost"""
        response = self.client.post(
            '/persons/',
            data=json.dumps({"name": "John", "surname": "Doe", "type_id": 1, "team_id": "team-1"}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)
    
    @patch('persons.application_config')
    def test_post_persons_no_data(self, mock_config):
        """Test POST /persons/ returns 400 when no data provided"""
        response = self.client.post(
            '/persons/',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'failed')
        self.assertEqual(data['reason'], 'no data')
    
    def test_delete_persons_forbidden_non_localhost(self):
        """Test DELETE /persons/ returns 403 for non-localhost"""
        response = self.client.delete(
            '/persons/',
            data=json.dumps({"person_id": "person-1"}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)
    
    @patch('persons.application_config')
    def test_delete_persons_no_data(self, mock_config):
        """Test DELETE /persons/ returns 400 when no data provided"""
        response = self.client.delete(
            '/persons/',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'failed')


class TestPersonDetail(unittest.TestCase):
    """Test the person detail endpoints"""
    
    def setUp(self):
        """Set up Flask test client"""
        self.app = Flask(__name__)
        self.app.register_blueprint(persons)
        self.client = self.app.test_client()
    
    def test_get_person_forbidden_non_localhost(self):
        """Test GET /persons/{id}/ returns 403 for non-localhost"""
        response = self.client.get('/persons/person-1/')
        self.assertEqual(response.status_code, 403)


if __name__ == '__main__':
    unittest.main()
