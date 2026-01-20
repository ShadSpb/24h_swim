import sqlite3
import logging
import uuid

def row_to_dict(cursor: sqlite3.Cursor, row: sqlite3.Row) -> dict:
    data = {}
    for idx, col in enumerate(cursor.description):
        data[col[0]] = row[idx]
    return data

def check_data_validity(swimmer_id: str, competition_id: int) -> bool:
    '''Check if provided values are exist in the database'''
    from app import application_config
    connection = sqlite3.connect(application_config.config.get("database_path"))
    cursor = connection.cursor()
    swimmer = cursor.execute("SELECT COUNT(*) FROM persons WHERE person_id = ?;", (swimmer_id,)).fetchone()[0]
    competition = cursor.execute("SELECT COUNT(*) FROM competitions WHERE competition_id = ?;", (competition_id,)).fetchone()[0]
    connection.close()
    if swimmer == 1 and competition == 1:
        return True
    else:
        return False
    
def swimmer_allowed(swimmer_id: str, line_no: int, competition_id: int, team_id: str) -> bool:
    '''Rules are following:
    1. Only one swimmer from the team allowed to be in the water
        1.1 Get team name
        1.2 Check if there is another registered swimmer from the same team_id

    2. If swimmer already registered
        2.1 Get swimmer line
        2.2 Do nothing

    3. If swimmer not registered
        3.1 Register'''
    
    from app import application_config
    connection = sqlite3.connect(application_config.config.get("database_path"))
    cursor = connection.cursor()
    #Check 1 if someone from the team already registered
    cursor.execute("SELECT person_id FROM registration WHERE competition_id = ? AND team_id = ? AND state_id = ?;", (competition_id, team_id, 1))
    list = cursor.fetchone()
    if list is not None and list[0] != swimmer_id:
        logging.info("Swimmer %s from team %s cannot be registered to competition %s because another swimmer (%s) from the same team is already registered.", swimmer_id, team_id, competition_id, list[0])
        connection.close()  
        return False
    
    #Check 2 if swimmer already registered
    cursor.execute("SELECT line_no FROM registration WHERE competition_id = ? AND person_id = ? and state_id = ?;", (competition_id, swimmer_id, 1))
    row = cursor.fetchone()
    if row is not None:
        registered_line_no = row[0]
        if registered_line_no == line_no:
            connection.close()
            logging.info("Swimmer %s is already registered to competition %s in line %s.", swimmer_id, competition_id, line_no)
            return False
        else:
            logging.info("Swimmer %s is already registered to competition %s in line %s and cannot be registered to line %s.", swimmer_id, competition_id, registered_line_no, line_no)
            connection.close()
            return False
        
    #check 3 register swimmer
    connection.close()
    return True

def create_person(name: str, surname: str, type_id: int, team_id: str) -> str:
    '''Create a new person in the database and return person_id'''
    from app import application_config
    connection = sqlite3.connect(application_config.config.get("database_path"))
    cursor = connection.cursor()
    person_id = str(uuid.uuid4())
    cursor.execute("INSERT INTO persons (person_id, name, surname, type_id, team_id) VALUES (?,?,?,?,?);",
                   [person_id, name, surname, type_id, team_id])
    connection.commit()
    connection.close()
    return person_id

def create_team(team_name: str) -> int:
    '''Create a new team in the database and return team_id'''
    from app import application_config
    connection = sqlite3.connect(application_config.config.get("database_path"))
    cursor = connection.cursor()
    cursor.execute("SELECT team_id FROM teams WHERE team_name = ?;", [team_name])
    result = cursor.fetchone()
    if result is not None:
        connection.close()
        logging.info("Team %s already exists with team_id %s.", team_name, result[0])
        return result[0]
    else:
        logging.info("Creating new team %s.", team_name)
        cursor.execute("SELECT max(team_id) FROM teams;")
        max_team_id = cursor.fetchone()[0]
        if max_team_id is None:
            team_id = 1
        else:
            team_id = max_team_id + 1
        cursor.execute("INSERT INTO teams (team_name) VALUES (?,?);",
                    [team_id, team_name])
        connection.commit()
        connection.close()
        return team_id