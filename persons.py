import sqlite3
from flask import Response, request, jsonify, Blueprint
persons = Blueprint('persons', __name__, template_folder='templates')

@persons.route("/persons", methods=['GET', 'PUT', 'DELETE'])
def db_all_persons():
    '''Function responsible for the maintenance of the people entities'''
    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)
    
    if request.method == 'GET':
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM persons ORDER BY `surname` ASC;")
        data = cursor.fetchall()
        return Response(str(data), mimetype='text/plain', status=200)
    
    elif request.method == 'PUT':
        return Response(jsonify({"status:ok"}), mimetype='text/plain', status=200)
    
    elif request.method == 'DELETE':
        return Response(jsonify({"status:ok"}), mimetype='text/plain', status=200)
    
@persons.route("/persons/<int:ident>", methods=['GET', 'MODIFY'])
def db_single_person(ident):
    from app import application_config
    if request.remote_addr != '127.0.0.1':
        return Response(str('Denied'), status=403)
    if request.method == 'GET':
        connection = sqlite3.connect(application_config.config.get("database_path"))
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM persons WHERE person_id = ?;",[(ident)])
        data = cursor.fetchall()
        return Response(str(data), mimetype='text/plain', status=200)