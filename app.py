from flask import Flask, Response
from flasgger import Swagger

from configuration import Configuration
application_config = Configuration()

from persons import persons
from registration import registration
from counter import counter

app = Flask(__name__)
swagger = Swagger(app, template={
    "info": {
        "title": "24swim.de",
        "description": "Backend API used to work with 24h swimming events",
        "version": "1.0.0"
    }
})
app.config['SWAGGER'] = {
    'title': 'My API',
    'uiversion': 3,
    'doc_dir': './api/',
    'openapi': '3.0.2'
}
app.register_blueprint(persons)
app.register_blueprint(registration)
app.register_blueprint(counter)

if __name__ == "__main__":
    app.run(debug=False)