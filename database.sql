-- database: ./database.db

-- Use the ▷ button in the top right corner to run the entire file.
PRAGMA foreign_keys = ON;
CREATE TABLE "types"('type_id' INTEGER UNIQUE NOT NULL, 'type_name' TEXT NOT NULL, PRIMARY KEY(type_id));
CREATE TABLE "teams"('team_id' INTEGER UNIQUE NOT NULL, 'team_name' TEXT NOT NULL, PRIMARY KEY(team_id));
CREATE TABLE "persons" ('person_id' TEXT UNIQUE NOT NULL, 'name' TEXT NOT NULL, 'surname' TEXT NOT NULL, 'type' INTEGER NOT NULL, 'team' INTEGER NOT NULL, 
FOREIGN KEY(type) REFERENCES types(type_id), 
FOREIGN KEY(team) REFERENCES teams(team_id), 
PRIMARY KEY('person_id'));
CREATE TABLE "competitions" ('competition_id' INTEGER UNIQUE NOT NULL, 'organizer' INTEGER NOT NULL, "start_time" TEXT NOT NULL, "end_time" TEXT NOT NULL, 
FOREIGN KEY(organizer) REFERENCES persons(person_id), 
PRIMARY KEY('competition_id'));
CREATE TABLE "person_state" ('state_id' INTEGER NOT NULL, 'state_name' TEXT NOT NULL, PRIMARY KEY(state_id));
CREATE TABLE "registration"('competition_id' INTEGER NOT NULL, 'team_id' INTEGER NOT NULL, 'line_no' INTEGER NOT NULL, 'person_id' INTEGER UNIQUE NOT NULL, 'state_id' TEXT NOT NULL, 
FOREIGN KEY(competition_id) REFERENCES competitions(competition_id),
FOREIGN KEY(team_id) REFERENCES teams(team_id),
FOREIGN KEY(person_id) REFERENCES persons(person_id),
FOREIGN KEY(state_id) REFERENCES person_state(state_id),
PRIMARY KEY(competition_id, team_id)
);
CREATE TABLE "counter"('competition_id' INTEGER NOT NULL, 'team_id' INTEGER NOT NULL, 'line_no' INTEGER NOT NULL, 'person_id' INTEGER NOT NULL, 'log_time' TEXT NOT NULL DEFAULT current_timestamp, 
FOREIGN KEY(competition_id) REFERENCES competitions(competition_id),
FOREIGN KEY(team_id) REFERENCES teams(team_id),
FOREIGN KEY(person_id) REFERENCES persons(person_id),
PRIMARY KEY(competition_id, team_id, log_time)
);

INSERT INTO types VALUES ('1', 'Organizer');
INSERT INTO types VALUES ('2', 'Referee');
INSERT INTO types VALUES ('3', 'Swimmer');
INSERT INTO types VALUES ('4', 'Admin');

INSERT INTO "teams" VALUES ('1', 'Test team');
INSERT INTO "teams" VALUES ('2', 'Another team');

INSERT INTO persons VALUES ('uuid1f99f020-ace1-4b1e-82d1-f728f6098f1d', 'Test','Organizer', '1', '1');
INSERT INTO persons VALUES ('fbbab0b2-0064-4702-9777-73422c6884eb','Test','Referee', '2', '1');
INSERT INTO persons VALUES ('b2d7bb69-35b9-4b7d-8add-685223d51843','Test','Swimmer', '3', '1');
INSERT INTO persons VALUES ('0fd7ee79-6358-47fd-af92-aa5d49808e77','AnotherTest','Swimmer', '3', '1');
INSERT INTO persons VALUES ('54477a13-9362-4bf9-b77c-ce98401a1c5d','Test','Swimmer', '3', '2');
INSERT INTO persons VALUES ('9bc8fec6-5a36-4355-bb67-8f80c1f9be5c','AnotherTest','Swimmer', '3', '2');

INSERT INTO competitions VALUES ('1', 'uuid1f99f020-ace1-4b1e-82d1-f728f6098f1d', current_timestamp, datetime(current_timestamp, '+31 day'));

INSERT INTO "person_state" values ('1', 'Registered');
INSERT INTO "person_state" values ('2', 'Unregistered');

INSERT INTO registration values ('1','1','1','b2d7bb69-35b9-4b7d-8add-685223d51843','1');
INSERT INTO registration values ('1','1','1','0fd7ee79-6358-47fd-af92-aa5d49808e77','2');
--Above must fail
INSERT INTO "counter"(competition_id, team_id, line_no, person_id) values ('1','2','1','0fd7ee79-6358-47fd-af92-aa5d49808e77');


