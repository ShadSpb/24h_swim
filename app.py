from flask import Flask
from flasgger import Swagger
from persons import persons
from registration import registration
from counter import counter

from configuration import Configuration
application_config = Configuration()

app = Flask(__name__)
swagger = Swagger(app)

app.register_blueprint(persons)
app.register_blueprint(registration)
app.register_blueprint(counter)

if __name__ == "__main__":
    app.run(debug=False)