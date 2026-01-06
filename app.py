from flask import Flask, Response, Blueprint
from persons import persons

from configuration import Configuration
application_config = Configuration()

app = Flask(__name__)

other_routes = Blueprint("other_routes", __name__)

if __name__ == "__main__":
    @app.route('/test', methods=['GET'])
    def test():
        return Response("ok", mimetype='text/plain')
    
    app.register_blueprint(persons)
    
    app.run(debug=True)