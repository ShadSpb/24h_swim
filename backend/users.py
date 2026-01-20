
import sqlite3
from flask import Response, request, Blueprint
from flasgger import swag_from
import functions
import re
import json
import logging

    
persons = Blueprint('users', __name__, template_folder='templates')
@persons.route("/user/register/", methods=['POST'])
@swag_from('api/users.yml')
def register_user():
    '''Used to handle login requests from the frontend
    username - email expected
    password - hashed password expected
    name and surname - self explanatory
    type_id - 1 organizer, 2 referee, 3 swimmer, 4 admin
    team_name = name of the team where user belongs to'''

    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)
        
    if request.method == 'POST':
        if request.content_length == 0:
            return Response(json.dumps({"status":"failed", "reason":"no data"}), mimetype='application/json', status=400)
        data = json.loads(request.get_data().decode())
        
        email = data.get("email") or None
        if email is None or email == "" or not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return Response(json.dumps({"status":"failed", "reason":"no email provided"}), mimetype='application/json', status=400)
        password = data.get("password") or None
        if password is None or password == "":
            return Response(json.dumps({"status":"failed", "reason":"no password provided"}), mimetype='application/json', status=400)
        name = data.get("name") or None
        if name is None or name == "":
            return Response(json.dumps({"status":"failed", "reason":"no name provided"}), mimetype='application/json', status=400)
        surname = data.get("surname") or None
        if surname is None or surname == "":
            return Response(json.dumps({"status":"failed", "reason":"no surname provided"}), mimetype='application/json', status=400)
        type_id = data.get("type_id") or None
        if type_id is None or type_id == "":
            return Response(json.dumps({"status":"failed", "reason":"no type_id provided"}), mimetype='application/json', status=400)
        team_name = data.get("team_name") or None
        if team_name is None or team_name == "":
            return Response(json.dumps({"status":"failed", "reason":"no team_id provided"}), mimetype='application/json', status=400)   
        
        person_id = functions.create_person(name, surname, type_id, team_id)
        team_id = functions.create_team(data.get("team_name"))

        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        try:
            cursor.execute("INSERT INTO users (email, password, person_id, last_logon_time, disabled) VALUES (?,?,?,?,?);",
                       [email, password, person_id,"1900-01-01 00:00:00", 0 ])
            cursor.commit()
            cursor.close()
            result = {"status":"ok", "person_id":person_id}
            return Response(json.dumps(result), mimetype='application/json', status=200)
        except sqlite3.IntegrityError as e:
            logging.error("Error creating user: %s", str(e))
            cursor.close()
            return Response(json.dumps({"status":"failed", "reason":"user already exists"}), mimetype='application/json', status=400)
    return Response(json.dumps({"status":"failed", "reason":"request not supported"}), mimetype='text/json', status=405)

@persons.route("/user/logon/", methods=['POST'])
@swag_from('api/users.yml')
def logon_user():
    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)
    if request.method == 'POST':
        if request.content_length == 0:
            return Response(json.dumps({"status":"failed", "reason":"no data"}), mimetype='application/json', status=400)
        data = json.loads(request.get_data().decode())
        
        email = data.get("email") or None
        if email is None or email == "" or not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return Response(json.dumps({"status":"failed", "reason":"no email provided"}), mimetype='application/json', status=400)
        password = data.get("password") or None
        if password is None or password == "":
            return Response(json.dumps({"status":"failed", "reason":"no password provided"}), mimetype='application/json', status=400)
        
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        cursor.execute("SELECT person_id, disabled FROM users WHERE email = ? AND password = ?;", (email, password))
        row = cursor.fetchone()
        if row is None:
            cursor.close()
            return Response(json.dumps({"status":"failed", "reason":"invalid credentials"}), mimetype='application/json', status=401)
        if row[1] == 1:
            cursor.close()
            return Response(json.dumps({"status":"failed", "reason":"user disabled"}), mimetype='application/json', status=403)
        
        person_id = row[0]
        cursor.execute("UPDATE users SET last_logon_time = datetime('now') WHERE email = ?;", (email,))
        connection.commit()
        cursor.close()
        result = {"status":"ok", "person_id":person_id}
        return Response(json.dumps(result), mimetype='application/json', status=200)
    return Response(json.dumps({"status":"failed", "reason":"request not supported"}), mimetype='text/json', status=405)

@persons.route("/user/disable/", methods=['POST'])
@swag_from('api/users.yml')
def disable_user():
    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)
    if request.method == 'POST':
        if request.content_length == 0:
            return Response(json.dumps({"status":"failed", "reason":"no data"}), mimetype='application/json', status=400)
        data = json.loads(request.get_data().decode())
        person_id = data.get("person_id") or None
        if person_id is None or person_id == "":
            return Response(json.dumps({"status":"failed", "reason":"no person_id provided"}), mimetype='application/json', status=400) 
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        cursor.execute("UPDATE users SET disabled = 1 WHERE person_id = ?;", (person_id,))
        connection.commit()
        cursor.close()
        result = {"status":"ok"}
        return Response(json.dumps(result), mimetype='application/json', status=200)
    return Response(json.dumps({"status":"failed", "reason":"request not supported"}), mimetype='text/json', status=405)