from flask import Flask
from flask_cors import CORS
from flasgger import Swagger
from persons import persons
from registration import registration
from counter import counter
from auth_routes import auth_bp, init_auth_db

from configuration import Configuration
application_config = Configuration()

app = Flask(__name__)

# Enable CORS for frontend communication
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:5173"]}})

swagger = Swagger(app)

# Initialize authentication database
init_auth_db()

# Register blueprints
app.register_blueprint(persons)
app.register_blueprint(registration)
app.register_blueprint(counter)
app.register_blueprint(auth_bp)

if __name__ == "__main__":
    app.run(debug=False)