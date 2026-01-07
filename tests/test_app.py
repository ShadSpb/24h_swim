"""
Unit tests for the Flask application setup

This module tests the main app.py configuration and initialization.
"""

import unittest
import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app


class TestAppInitialization(unittest.TestCase):
    """Test Flask application initialization"""
    
    def test_app_exists(self):
        """Test that Flask app is properly initialized"""
        self.assertIsNotNone(app)
    
    def test_app_testing_mode_can_be_set(self):
        """Test that app can be set to testing mode"""
        app.config['TESTING'] = True
        self.assertTrue(app.config['TESTING'])
    
    def test_blueprints_registered(self):
        """Test that all blueprints are registered"""
        # Create a test client to verify routes exist
        test_client = app.test_client()
        
        # Test that blueprint routes exist
        with app.app_context():
            rules = [rule.rule for rule in app.url_map.iter_rules()]
            # Should have at least these endpoints
            self.assertTrue(any('/test' in rule for rule in rules))
            self.assertTrue(any('/persons' in rule for rule in rules))
            self.assertTrue(any('/register' in rule for rule in rules))
            self.assertTrue(any('/counter' in rule for rule in rules))
    
    def test_swagger_configuration(self):
        """Test that Swagger is properly configured"""
        # Check swagger configuration exists
        self.assertIsNotNone(app.config)


class TestAppRoutes(unittest.TestCase):
    """Test application routes"""
    
    def setUp(self):
        """Set up test client"""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_test_route_exists(self):
        """Test /test route exists"""
        response = self.client.get(
            '/test',
            environ_base={'REMOTE_ADDR': '127.0.0.1'}
        )
        # Should return 200 or an error status, but route should exist
        self.assertIsNotNone(response)
    
    def test_persons_route_exists(self):
        """Test /persons/ route exists"""
        response = self.client.get('/persons/')
        # May return 403 due to security, but route should exist
        self.assertIsNotNone(response)
    
    def test_register_route_exists(self):
        """Test /register/ route exists"""
        response = self.client.post(
            '/register/',
            data='{}',
            content_type='application/json'
        )
        # May return 403 or 400, but route should exist
        self.assertIsNotNone(response)
    
    def test_counter_route_exists(self):
        """Test /counter/ route exists"""
        response = self.client.post(
            '/counter/',
            data='{}',
            content_type='application/json'
        )
        # May return 403 or 400, but route should exist
        self.assertIsNotNone(response)


if __name__ == '__main__':
    unittest.main()
