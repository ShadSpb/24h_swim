import unittest
import json
import os
import sys
import tempfile
import sqlite3
from unittest.mock import patch
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from registration import registration


class TestRegistrationBlueprint(unittest.TestCase):
    """Test the registration blueprint endpoints"""
    
    def setUp(self):
        """Set up Flask test client"""
        self.app = Flask(__name__)
        self.app.register_blueprint(registration)
        self.client = self.app.test_client()
    
    def test_register_swimmer_forbidden_non_localhost(self):
        """Test POST /register/ returns 403 for non-localhost"""
        response = self.client.post(
            '/register/',
            data=json.dumps({
                "swimmer_id": "swimmer-1",
                "line_no": 1,
                "competition_id": 1
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)
    
    @patch('registration.application_config')
    @patch('registration.functions')
    def test_register_swimmer_no_data(self, mock_functions, mock_config):
        """Test POST /register/ returns 400 when no data provided"""
        response = self.client.post(
            '/register/',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'failed')
        self.assertEqual(data['reason'], 'no data')
    
    @patch('registration.application_config')
    @patch('registration.functions')
    def test_register_swimmer_invalid_json(self, mock_functions, mock_config):
        """Test POST /register/ returns 400 for invalid JSON"""
        response = self.client.post(
            '/register/',
            data=json.dumps({
                "swimmer_id": "swimmer-1",
                "line_no": "not-an-integer",
                "competition_id": 1
            }),
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['reason'], 'invalid json')
    
    @patch('registration.application_config')
    @patch('registration.functions')
    def test_register_swimmer_invalid_data(self, mock_functions, mock_config):
        """Test POST /register/ returns 400 when swimmer/competition invalid"""
        mock_functions.check_data_validity.return_value = False
        
        response = self.client.post(
            '/register/',
            data=json.dumps({
                "swimmer_id": "invalid-swimmer",
                "line_no": 1,
                "competition_id": 999
            }),
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['reason'], 'invalid data')
    
    def test_unregister_swimmer_forbidden_non_localhost(self):
        """Test POST /unregister/ returns 403 for non-localhost"""
        response = self.client.post(
            '/unregister/',
            data=json.dumps({
                "swimmer_id": "swimmer-1",
                "competition_id": 1
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)
    
    @patch('registration.application_config')
    @patch('registration.functions')
    def test_unregister_swimmer_no_data(self, mock_functions, mock_config):
        """Test POST /unregister/ returns 400 when no data provided"""
        response = self.client.post(
            '/unregister/',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'failed')
        self.assertEqual(data['reason'], 'no data')
    
    @patch('registration.application_config')
    @patch('registration.functions')
    def test_unregister_swimmer_invalid_json(self, mock_functions, mock_config):
        """Test POST /unregister/ returns 400 for invalid JSON"""
        response = self.client.post(
            '/unregister/',
            data=json.dumps({
                "swimmer_id": "swimmer-1",
                "competition_id": "not-an-integer"
            }),
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['reason'], 'invalid json')


if __name__ == '__main__':
    unittest.main()
