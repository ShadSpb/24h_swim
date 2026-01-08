import sqlite3
from flask import Response, request, Blueprint
from flasgger import swag_from
import functions
import json
import logging

registration = Blueprint('registration', __name__, template_folder='templates')
@registration.route("/register/", methods=['POST'])
@swag_from('api/register.yml')
def register_swimmer():
    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)

    if request.method == 'POST':
        if request.content_length == 0:
            return Response(json.dumps({"status":"failed", "reason":"no data"}), mimetype='application/json', status=400)
        try:
            data = json.loads(request.get_data().decode())
            swimmer_id = data.get("swimmer_id")
            line_no = int(data.get("line_no"))
            competition_id = data.get("competition_id")
        except (ValueError, AttributeError, TypeError) as error:
            return Response(json.dumps({"status":"failed", "reason":"invalid json", "error": error}), mimetype='application/json', status=400)
        if functions.check_data_validity(swimmer_id, competition_id) == False:
            return Response(json.dumps({"status":"failed", "reason":"invalid data"}), mimetype='application/json', status=400)
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        team_id = cursor.execute("SELECT team_id FROM persons WHERE person_id = ?;", (swimmer_id,)).fetchone()[0]
        if functions.swimmer_allowed(swimmer_id, line_no, competition_id, team_id) is False:
            connection.close()
            return Response(json.dumps({"status":"failed", "reason":"registration forbidden"}), mimetype='application/json', status=400)
        try:
            cursor.execute("INSERT INTO registration (competition_id, team_id, line_no, person_id, state_id) VALUES (?,?,?,?,?) ON CONFLICT DO UPDATE SET state_id = 1, line_no = ?;",
                           (competition_id, team_id, line_no, swimmer_id, 1, line_no))
            connection.commit()
            connection.close()
            return Response(json.dumps({"status":"ok"}), mimetype='application/json', status=200)
        except sqlite3.IntegrityError as error:
            connection.close()
            logging.error("Integrity error: Swimmer %s cannot be registered to line %s for competition %s. Error: %s", swimmer_id, line_no, competition_id, error)
            return Response(json.dumps({"status":"failed", "reason":"integrity error"}), mimetype='application/json', status=400)
            
        except sqlite3.OperationalError as error:
            logging.error("Database error during SQL Execution: %s", error)
            connection.close()
            return Response(json.dumps({"status":"failed", "reason":"database error"}), mimetype='application/json', status=500)

    return Response(json.dumps({"status":"failed", "reason":"request not supported"}), mimetype='text/json', status=405)

@registration.route("/unregister/", methods=['POST'])
@swag_from('api/unregister.yml')
def unregister_swimmer():
    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)
    if request.method == 'POST':
        if request.content_length == 0:
            return Response(json.dumps({"status":"failed", "reason":"no data"}), mimetype='application/json', status=400)
        try:
            data = json.loads(request.get_data().decode())
            swimmer_id = data.get("swimmer_id")
            competition_id = int(data.get("competition_id"))
        except (ValueError, AttributeError, TypeError) as error:
            return Response(json.dumps({"status":"failed", "reason":"invalid json", "error": error}), mimetype='application/json', status=400)
        if functions.check_data_validity(swimmer_id, competition_id) == False:
            return Response(json.dumps({"status":"failed", "reason":"invalid data"}), mimetype='application/json', status=400)
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        try:
            cursor.execute("UPDATE registration SET state_id = 2 WHERE competition_id = ? AND person_id = ?;", (competition_id, swimmer_id))
            connection.commit()
            connection.close()
            return Response(json.dumps({"status":"ok"}), mimetype='application/json', status=200)
        except sqlite3.OperationalError as error:
            logging.error("Database error during SQL Execution: %s", error)
            connection.close()
            return Response(json.dumps({"status":"failed", "reason":"database error"}), mimetype='application/json', status=500)