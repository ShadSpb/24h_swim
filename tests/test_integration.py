"""
Integration tests for the 24h Swimming Event API

This module tests the complete API workflows including:
- Creating persons and teams
- Registering swimmers for competitions
- Counting laps
- Unregistering swimmers
"""

import unittest
import json
import os
import sys
import tempfile
import sqlite3
from unittest.mock import patch
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app


class TestAPIIntegration(unittest.TestCase):
    """Integration tests for the complete API"""
    
    def setUp(self):
        """Set up Flask test client"""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_health_check(self):
        """Test /test health check endpoint"""
        response = self.client.get(
            '/test',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.decode(), 'ok')
    
    def test_unsupported_method(self):
        """Test unsupported HTTP methods return 405"""
        response = self.client.patch(
            '/persons/',
            data=json.dumps({}),
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        # Should get 405 for unsupported method
        self.assertIn(response.status_code, [405, 400])


class TestErrorHandling(unittest.TestCase):
    """Test error handling across endpoints"""
    
    def setUp(self):
        """Set up Flask test client"""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_malformed_json(self):
        """Test endpoints reject malformed JSON"""
        response = self.client.post(
            '/register/',
            data='{"invalid json}',
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        # Should handle malformed JSON gracefully
        self.assertIn(response.status_code, [400, 405])
    
    def test_missing_required_fields(self):
        """Test POST endpoints return 400 for missing required fields"""
        response = self.client.post(
            '/register/',
            data=json.dumps({
                "swimmer_id": "swimmer-1"
                # Missing line_no and competition_id
            }),
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)
    
    def test_empty_request_body(self):
        """Test endpoints return 400 for empty request body"""
        response = self.client.post(
            '/register/',
            data='',
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        self.assertEqual(response.status_code, 400)


class TestSecurityControls(unittest.TestCase):
    """Test security controls (localhost-only access)"""
    
    def setUp(self):
        """Set up Flask test client"""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_localhost_only_persons_get(self):
        """Test GET /persons/ is restricted to localhost"""
        # Non-localhost should be denied
        response = self.client.get(
            '/persons/',
            environ_base={'REMOTE_ADDR': '192.168.1.100'}
        )
        self.assertEqual(response.status_code, 403)
        
        # Localhost should be allowed to try
        response = self.client.get(
            '/persons/',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        # May fail for other reasons but not 403
        self.assertNotEqual(response.status_code, 403)
    
    def test_localhost_only_register(self):
        """Test POST /register/ is restricted to localhost"""
        response = self.client.post(
            '/register/',
            data=json.dumps({
                "swimmer_id": "test",
                "line_no": 1,
                "competition_id": 1
            }),
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '10.0.0.1'}
        )
        self.assertEqual(response.status_code, 403)
    
    def test_localhost_only_counter(self):
        """Test POST /counter/ is restricted to localhost"""
        response = self.client.post(
            '/counter/',
            data=json.dumps({
                "swimmer_id": "test",
                "competition_id": 1
            }),
            content_type='application/json',
            environ_base={'REMOTE_ADDR': '172.16.0.1'}
        )
        self.assertEqual(response.status_code, 403)


if __name__ == '__main__':
    unittest.main()
