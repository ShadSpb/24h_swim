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
swagger.config['specs_route'] = "/api/"

if __name__ == "__main__":
    @app.route('/test', methods=['GET'])
    def test():
        return Response("ok", mimetype='text/plain')
    
    app.register_blueprint(persons)
    app.register_blueprint(registration)
    app.register_blueprint(counter)
    
    app.run(debug=False)