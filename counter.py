import sqlite3
from flask import Response, request, Blueprint
from flasgger import swag_from
import functions
import json
import logging

counter = Blueprint('counter', __name__, template_folder='templates')
@counter.route("/counter/", methods=['POST'])
@swag_from('api/counter.yml')
def count_line():
    '''Here we log each swimmer that was able to complete one cycle of the distance
    Logic is following:
    1. Check registration table if swimmer is registered and allowed to swim
    2. If swimmer is allowed, add one count to counter table'''
    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)
        
    if request.method == 'POST':
        if request.content_length == 0:
            return Response(json.dumps({"status":"failed", "reason":"no data"}), mimetype='application/json', status=400)
        try:
            data = json.loads(request.get_data().decode())
            swimmer_id = data.get("swimmer_id")
            competition_id = data.get("competition_id")
        except (ValueError, AttributeError, TypeError) as error:
            return Response(json.dumps({"status":"failed", "reason":"invalid json", "error": error}), mimetype='application/json', status=400)
        if functions.check_data_validity(swimmer_id, competition_id) == False:
            return Response(json.dumps({"status":"failed", "reason":"invalid data"}), mimetype='application/json', status=400)
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()

        ##Step 1 check if swimmer is in registration table and has registered state
        cursor.execute("SELECT person_id FROM registration WHERE competition_id = ? AND person_id = ? AND state_id = ?;", (competition_id, swimmer_id, 1))
        registered_swimmer = cursor.fetchone()
        if registered_swimmer == (swimmer_id,):
            ##Step 2 add one count to counter table
            try:
                cursor.execute("INSERT INTO counter(competition_id, team_id, line_no, person_id) VALUES (?, (SELECT team_id FROM persons WHERE person_id = ?), (SELECT line_no FROM registration WHERE competition_id = ? AND person_id = ? and state_id = 1), ?);", (competition_id, swimmer_id, competition_id, swimmer_id, swimmer_id))
                connection.commit()
                connection.close()
                return Response(json.dumps({"status":"success"}), mimetype='application/json', status=200)
            except sqlite3.IntegrityError as error:
                connection.close()
                logging.info("Error inserting into counter table: %s", error)
                return Response(json.dumps({"status":"failed", "reason":"database integrity error"}), mimetype='application/json', status=400)
        else:
            connection.close()
            logging.info("Swimmer %s is not registered to swim.", swimmer_id)
            return Response(json.dumps({"status":"failed", "reason":"counter forbidden"}), mimetype='application/json', status=400)

    return Response(json.dumps({"status":"failed", "reason":"request not supported"}), mimetype='text/json', status=405)