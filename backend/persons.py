
import sqlite3
from flask import Response, request, Blueprint
from flasgger import swag_from
import functions
import json
import uuid

    
persons = Blueprint('persons', __name__, template_folder='templates')
@persons.route("/persons/", methods=['GET', 'POST', 'DELETE'])
@swag_from('api/persons.yml')
def db_all_persons():
    '''Allow to work with person list. SELECT, INSERT, DELETE'''
    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)
        
    if request.method == 'GET':
        connection = sqlite3.connect(application_config.config.get("database_path"))
        connection.row_factory = functions.row_to_dict
        cursor = connection.cursor()
        cursor.execute("SELECT A.person_id,A.name,A.surname,B.type_name,C.team_name FROM persons as A JOIN types as B ON A.type_id = B.type_id JOIN teams as C on A.team = C.team_id ORDER BY A.person_id DESC;")
        connection.close()
        return Response(json.dumps(cursor.fetchall()), mimetype='application/json', status=200)
        
    if request.method == 'POST':
        if request.content_length == 0:
            return Response(json.dumps({"status":"failed", "reason":"no data"}), mimetype='application/json', status=400)
        data = json.loads(request.get_data().decode())
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        cursor.execute("INSERT INTO persons (person_id, name, surname, type_id, team_id) VALUES (?,?,?,?,?);",
                       [str(uuid.uuid4()), data.get("name"), data.get("surname"), data.get("type_id"), data.get("team_id")])
        connection.commit()
        connection.close()
        return Response(json.dumps({"status":"ok"}), mimetype='application/json', status=200)
        
    if request.method == 'DELETE':
        if request.content_length == 0:
            return Response(json.dumps({"status":"failed", "reason":"no data"}), mimetype='application/json', status=400)
        data = json.loads(request.get_data().decode())
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        cursor.execute("DELETE FROM persons WHERE person_id = ?;", [data.get("person_id")])
        connection.commit()
        connection.close()
        return Response(json.dumps({"status":"ok"}), mimetype='application/json', status=200)
    
    return Response(json.dumps({"status":"failed", "reason":"request not supported"}), mimetype='text/json', status=405)
        
@persons.route("/persons/<ident>/", methods=['GET', 'MODIFY'])
def db_single_person(ident):
    '''Allow to work with the people entitiy. Get information about person and modify data'''
    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)
    
    if request.method == 'GET':
        connection = sqlite3.connect(application_config.config.get("database_path"))
        connection.row_factory = functions.row_to_dict
        cursor = connection.cursor()
        cursor.execute("SELECT A.person_id,A.name,A.surname,B.type_name,C.team_name FROM persons as A JOIN types as B ON A.type = B.type_id JOIN teams as C on A.team = C.team_id WHERE A.person_id = ? ORDER BY A.person_id DESC;",[(ident)])
        connection.close()
        return Response(json.dumps(cursor.fetchall()), mimetype='application/json', status=200)
    
    if request.method == 'MODIFY':
        if request.content_length == 0:
            return Response(json.dumps({"status":"failed", "reason":"no data"}), mimetype='application/json', status=400)
        data = json.loads(request.get_data().decode())
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        cursor.execute("UPDATE persons SET name = ?, surname = ?, type_id = ?, team_id = ? WHERE person_id = ?;",
                       [data.get("name"), data.get("surname"), data.get("type_id"), data.get("team_id"), ident])
        connection.commit()
        connection.close()
        return Response(json.dumps({"status:ok"}), mimetype='application/json', status=200)
    
    return Response(json.dumps({"status":"failed", "reason":"request not supported"}), mimetype='application/json', status=400)