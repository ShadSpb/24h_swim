from flask import Flask
from flasgger import Swagger
from persons import persons
from registration import registration
from counter import counter

from configuration import Configuration
application_config = Configuration()

app = Flask(__name__)

swagger = Swagger(app)

# Register blueprints
app.register_blueprint(persons)
app.register_blueprint(registration)
app.register_blueprint(counter)

if __name__ == "__main__":
    listen_address = application_config.config.get('listen_address') or '127.0.0.1'
    listen_port = int(application_config.config.get('listen_port') or 5000)
    app.run(debug=False, host=listen_address, port=listen_port)