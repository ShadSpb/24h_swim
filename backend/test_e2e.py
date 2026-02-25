"""
test_e2e.py  —  Full end-to-end test suite for SwimTrack 24 backend
Run:  python test_e2e.py
"""

import os, sys, tempfile, time

# ── Test DB (must be set before any app import) ───────────────────────────────
_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_db.close()
os.environ["SWIMTRACK_DB"] = _db.name

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import create_app

app    = create_app()
client = app.test_client()

# ── Helpers ───────────────────────────────────────────────────────────────────
PASS = "✅";  FAIL = "❌"
failures: list[str] = []
passed  : int       = 0

def check(label: str, condition: bool, detail: str = ""):
    global passed
    if condition:
        print(f"  {PASS} {label}")
        passed += 1
    else:
        msg = f"  {FAIL} {label}"
        if detail:
            msg += f"  [{detail}]"
        print(msg)
        failures.append(label)

def j(r): return r.get_json()
def s(r): return r.status_code

def section(title: str):
    print(f"\n── {title} {'─' * max(0, 55-len(title))}")

# ═════════════════════════════════════════════════════════════════════════════
section("Health")
r = client.get("/health")
check("GET /health → 200",          s(r) == 200, s(r))
check("database = ok",              j(r).get("database") == "ok")
check("version present",            "version" in j(r))

# ═════════════════════════════════════════════════════════════════════════════
section("Auth: Register")
r = client.post("/auth/register", json={"email":"org@test.de","password":"secret","name":"Alice","role":"organizer"})
check("register → 201",             s(r) == 201, s(r))
check("returns user",               "user" in j(r))
check("role = organizer",           j(r)["user"]["role"] == "organizer")
check("no password in response",    "password" not in j(r)["user"])
ORG_ID = j(r)["user"]["id"]

check("dup email → 400",            s(client.post("/auth/register", json={"email":"org@test.de","password":"x","name":"D","role":"organizer"})) == 400)
check("bad email → 400",            s(client.post("/auth/register", json={"email":"notanemail","password":"x","name":"X","role":"organizer"})) == 400)
check("referee self-reg → 400",     s(client.post("/auth/register", json={"email":"r@t.de","password":"x","name":"R","role":"referee"})) == 400)
check("empty body → 400",           s(client.post("/auth/register", json={})) == 400)

# ═════════════════════════════════════════════════════════════════════════════
section("Auth: Login")
r = client.post("/auth/login", json={"email":"org@test.de","password":"secret"})
check("valid login → 200",          s(r) == 200, s(r))
check("success = True",             j(r).get("success") == True)
check("role returned",              j(r).get("role") == "organizer")
check("wrong password → 401",       s(client.post("/auth/login", json={"email":"org@test.de","password":"bad"})) == 401)
check("unknown user → 401",         s(client.post("/auth/login", json={"email":"x@x.de","password":"x"})) == 401)
check("empty body → 400",           s(client.post("/auth/login", json={})) == 400)

# ═════════════════════════════════════════════════════════════════════════════
section("Auth: Users & Password Reset")
r = client.get("/auth/users")
check("GET /auth/users → 200",      s(r) == 200)
check("returns list",               isinstance(j(r), list))
check("≥1 user",                    len(j(r)) >= 1)

r = client.post("/auth/reset-password", json={"userId": ORG_ID})
check("reset-password → 200",       s(r) == 200, s(r))
check("newPassword present",        "newPassword" in j(r))
NEW_PW = j(r)["newPassword"]
check("login with new password",    s(client.post("/auth/login", json={"email":"org@test.de","password":NEW_PW})) == 200)
check("reset unknown → 404",        s(client.post("/auth/reset-password", json={"userId":"bad"})) == 404)
check("reset no userId → 400",      s(client.post("/auth/reset-password", json={})) == 400)
check("logout → 200",               s(client.post("/auth/logout", json={})) == 200)

# Create admin for rest of tests
client.post("/auth/register", json={"email":"admin@swim.de","password":"pass","name":"Admin","role":"organizer"})
ADMIN_ID = next(u["id"] for u in j(client.get("/auth/users")) if u["email"]=="admin@swim.de")
check("admin user created",         ADMIN_ID is not None)

# ═════════════════════════════════════════════════════════════════════════════
section("Competitions: Create & Read")
r = client.post("/competitions", json={
    "name":"Berlin 24h","date":"2026-07-01","startTime":"10:00",
    "location":"Olympia Pool","organizerId":ADMIN_ID,
    "numberOfLanes":3,"doubleCountTimeout":5,"laneLength":25
})
check("POST /competitions → 201",       s(r) == 201, s(r))
C = j(r)["data"]; CID = C["id"]
check("status = upcoming",              C["status"] == "upcoming")
check("doubleCountTimeout = 5",         C["doubleCountTimeout"] == 5)
check("GET by id → 200",                s(client.get(f"/competitions/{CID}")) == 200)
check("GET list → 200",                 s(client.get("/competitions", query_string={"organizerId":ADMIN_ID})) == 200)
check("returns 1",                      len(j(client.get("/competitions", query_string={"organizerId":ADMIN_ID}))["data"]) == 1)
check("unknown id → 404",              s(client.get("/competitions/nope")) == 404)
check("empty POST → 400",              s(client.post("/competitions", json={})) == 400)
check("bad organizer → 404",           s(client.post("/competitions", json={
    "name":"X","date":"2026-01-01","startTime":"08:00","location":"Y",
    "organizerId":"bad","numberOfLanes":1})) == 404)

section("Competitions: Update & Status Transitions")
r = client.put(f"/competitions/{CID}", json={"name":"Berlin 24h – Updated"})
check("PUT name → 200",                 s(r) == 200 and j(r)["data"]["name"] == "Berlin 24h – Updated")

r = client.put(f"/competitions/{CID}", json={"status":"active","actualStartTime":"2026-07-01T10:00:00Z"})
check("→ active → 200",                 s(r) == 200 and j(r)["data"]["status"] == "active")
check("actualStartTime stored",         j(r)["data"]["actualStartTime"] == "2026-07-01T10:00:00Z")
check("invalid status → 400",           s(client.put(f"/competitions/{CID}", json={"status":"garbage"})) == 400)

r = client.put(f"/competitions/{CID}", json={"status":"paused"})
check("→ paused → 200",                 s(r) == 200)
r = client.put(f"/competitions/{CID}", json={"status":"active"})
check("→ active again → 200",           s(r) == 200)

# ═════════════════════════════════════════════════════════════════════════════
section("Teams: Create & Rules")
r = client.post("/teams", json={"name":"Blue Sharks","color":"#3b82f6","competitionId":CID,"assignedLane":1})
check("POST team → 201",                s(r) == 201)
T1ID = j(r)["data"]["id"]

check("same color+lane → 400",          s(client.post("/teams", json={"name":"X","color":"#3b82f6","competitionId":CID,"assignedLane":1})) == 400)

r = client.post("/teams", json={"name":"Blue Tigers","color":"#3b82f6","competitionId":CID,"assignedLane":2})
check("same color diff lane → 201 (RULES)", s(r) == 201)
T2ID = j(r)["data"]["id"]

r = client.post("/teams", json={"name":"Red Wave","color":"#ef4444","competitionId":CID,"assignedLane":3})
check("third team → 201",               s(r) == 201)
T3ID = j(r)["data"]["id"]

r = client.get("/teams", query_string={"competitionId":CID})
check("list teams → 3",                 len(j(r)["data"]) == 3)
check("filter by lane → 1",             len(j(client.get("/teams", query_string={"competitionId":CID,"laneNumber":1}))["data"]) == 1)

section("Teams: Update")
r = client.put(f"/teams/{T1ID}", json={"name":"Blue Sharks Renamed"})
check("rename → 200",                   s(r) == 200 and j(r)["data"]["name"] == "Blue Sharks Renamed")
# Move T1 to lane 2 — conflict with T2 (same color)
check("conflicting PUT → 400",          s(client.put(f"/teams/{T1ID}", json={"color":"#3b82f6","assignedLane":2})) == 400)
check("unknown team PUT → 404",         s(client.put("/teams/nope", json={})) == 404)

# ═════════════════════════════════════════════════════════════════════════════
section("Swimmers: Create & Rules")
r = client.post("/swimmers", json={"name":"Hans","teamId":T1ID,"competitionId":CID,"isUnder12":False})
check("adult swimmer → 201",            s(r) == 201)
SW1ID = j(r)["data"]["id"]
check("isUnder12 = False",              j(r)["data"]["isUnder12"] == False)

check("under-12 no parent → 400",       s(client.post("/swimmers", json={"name":"Kid","teamId":T1ID,"competitionId":CID,"isUnder12":True})) == 400)

r = client.post("/swimmers", json={"name":"Kid","teamId":T1ID,"competitionId":CID,"isUnder12":True,"parentName":"Dad","parentContact":"+49123"})
check("under-12 with parent → 201",     s(r) == 201)
check("parentName stored",              j(r)["data"]["parentName"] == "Dad")
check("isUnder12 = True",               j(r)["data"]["isUnder12"] == True)

r = client.post("/swimmers", json={"name":"Petra","teamId":T2ID,"competitionId":CID,"isUnder12":False})
check("T2 swimmer → 201",               s(r) == 201)
SW2ID = j(r)["data"]["id"]

r = client.post("/swimmers", json={"name":"Karl","teamId":T3ID,"competitionId":CID,"isUnder12":False})
check("T3 swimmer → 201",               s(r) == 201)
SW3ID = j(r)["data"]["id"]

check("wrong competition → 400",        s(client.post("/swimmers", json={"name":"X","teamId":T1ID,"competitionId":"bad","isUnder12":False})) == 400)

section("Swimmers: Update & List")
r = client.put(f"/swimmers/{SW1ID}", json={"name":"Hans Updated"})
check("rename swimmer → 200",           s(r) == 200 and j(r)["data"]["name"] == "Hans Updated")
check("under-12 without parent → 400",  s(client.put(f"/swimmers/{SW1ID}", json={"isUnder12":True})) == 400)
check("GET all swimmers → 4",           len(j(client.get("/swimmers", query_string={"competitionId":CID}))["data"]) == 4)
check("filter by team → 2",             len(j(client.get("/swimmers", query_string={"teamId":T1ID}))["data"]) == 2)
check("unknown swimmer PUT → 404",      s(client.put("/swimmers/nope", json={})) == 404)

# ═════════════════════════════════════════════════════════════════════════════
section("Referees: Create & Login")
r = client.post("/referees", json={"competitionId":CID})
check("POST referee → 201",             s(r) == 201)
REF = j(r)["data"]; REFID = REF["id"]; REFUID = REF["userId"]; REFPW = REF["password"]
check("userId starts ref_",             REFUID.startswith("ref_"))
check("password returned (once)",       bool(REFPW) and len(REFPW) > 6)

r = client.post("/auth/login", json={"email":f"{REFUID}@swimtrack.local","password":REFPW})
check("referee login → 200",            s(r) == 200)
check("role = referee",                 j(r).get("role") == "referee")
check("list referees → 1",              len(j(client.get("/referees", query_string={"competitionId":CID}))["data"]) == 1)
check("no compId → 400",               s(client.post("/referees", json={})) == 400)

section("Referees: Password Reset")
r = client.post(f"/referees/{REFID}/reset-password", json={})
check("reset ref password → 200",       s(r) == 200)
new_pw = j(r)["newPassword"]
check("newPassword in response",        bool(new_pw))
check("login with new password → 200",  s(client.post("/auth/login", json={"email":f"{REFUID}@swimtrack.local","password":new_pw})) == 200)
REFPW = new_pw
check("unknown referee → 404",          s(client.post("/referees/nope/reset-password", json={})) == 404)

# ═════════════════════════════════════════════════════════════════════════════
section("Swim Sessions: Start")
r = client.post("/swim-sessions", json={"competitionId":CID,"swimmerId":SW1ID,"teamId":T1ID,"laneNumber":1})
check("start T1 session → 201",         s(r) == 201)
check("isActive = True",                j(r)["data"]["isActive"] == True)
check("lapCount = 0",                   j(r)["data"]["lapCount"] == 0)
SESS1ID = j(r)["data"]["id"]

check("2nd swimmer same team → 409",    s(client.post("/swim-sessions", json={"competitionId":CID,"swimmerId":SW1ID,"teamId":T1ID,"laneNumber":1})) == 409)

r = client.post("/swim-sessions", json={"competitionId":CID,"swimmerId":SW2ID,"teamId":T2ID,"laneNumber":2})
check("start T2 session → 201",         s(r) == 201)
SESS2ID = j(r)["data"]["id"]

r = client.post("/swim-sessions", json={"competitionId":CID,"swimmerId":SW3ID,"teamId":T3ID,"laneNumber":3})
check("start T3 session → 201",         s(r) == 201)
SESS3ID = j(r)["data"]["id"]

# Paused competition blocks new sessions
client.put(f"/competitions/{CID}", json={"status":"paused"})
check("session while paused → 400",     s(client.post("/swim-sessions", json={"competitionId":CID,"swimmerId":SW2ID,"teamId":T2ID,"laneNumber":2})) == 400)
client.put(f"/competitions/{CID}", json={"status":"active"})

section("Swim Sessions: List & Update")
r = client.get("/swim-sessions", query_string={"competitionId":CID,"isActive":"true"})
check("GET active sessions → 3",        len(j(r)["data"]) == 3, len(j(r)["data"]))

r = client.put(f"/swim-sessions/{SESS1ID}", json={"isActive":False,"endTime":"2026-07-01T11:00:00Z"})
check("end session → 200",              s(r) == 200)
check("isActive = False",               j(r)["data"]["isActive"] == False)
check("endTime stored",                 j(r)["data"]["endTime"] == "2026-07-01T11:00:00Z")
check("unknown session → 404",          s(client.put("/swim-sessions/nope", json={})) == 404)

# Restart T1 (now SESS1 is closed)
r = client.post("/swim-sessions", json={"competitionId":CID,"swimmerId":SW1ID,"teamId":T1ID,"laneNumber":1})
check("restart T1 after end → 201",     s(r) == 201)
SESS1BID = j(r)["data"]["id"]

# ═════════════════════════════════════════════════════════════════════════════
section("Lap Counting: Basic")
r = client.post("/lap-counts", json={
    "competitionId":CID,"laneNumber":1,
    "teamId":T1ID,"swimmerId":SW1ID,"refereeId":REFID,"lapNumber":1
})
check("first lap → 201",                s(r) == 201, s(r))
LAP1 = j(r)["data"]
check("lapNumber = 1",                  LAP1["lapNumber"] == 1)
check("timestamp present",              bool(LAP1.get("timestamp")))
check("teamId correct",                 LAP1["teamId"] == T1ID)

section("Lap Counting: Double-count protection")
r = client.post("/lap-counts", json={
    "competitionId":CID,"laneNumber":1,
    "teamId":T1ID,"swimmerId":SW1ID,"refereeId":REFID
})
check("immediate 2nd tap → 429",        s(r) == 429, s(r))
check("retryAfter in body",             "retryAfter" in j(r))
check("retryAfter is int",              isinstance(j(r).get("retryAfter"), int))
check("Retry-After header set",         "Retry-After" in r.headers)

section("Lap Counting: Status guards")
client.put(f"/competitions/{CID}", json={"status":"paused"})
r = client.post("/lap-counts", json={
    "competitionId":CID,"laneNumber":2,
    "teamId":T2ID,"swimmerId":SW2ID,"refereeId":REFID
})
check("lap while paused → 422",         s(r) == 422, s(r))
check("error mentions paused",          "paused" in j(r).get("error","").lower())
client.put(f"/competitions/{CID}", json={"status":"active"})

section("Lap Counting: Session validation (before double-count)")
# T1 just had a lap. Try counting for T1 on wrong lane → 422 (not 429)
r = client.post("/lap-counts", json={
    "competitionId":CID,"laneNumber":9,  # wrong lane – no active session there
    "teamId":T1ID,"swimmerId":SW1ID,"refereeId":REFID
})
check("wrong lane → 422 (not 429)",     s(r) == 422, s(r))

# Missing fields
check("missing fields → 400",           s(client.post("/lap-counts", json={"competitionId":CID})) == 400)

section("Lap Counting: Auto-increment lapNumber & T2 laps")
# Wait out the 5s double-count timeout for T1
print("  [waiting 6s for double-count timeout...]")
time.sleep(6)

r = client.post("/lap-counts", json={
    "competitionId":CID,"laneNumber":1,
    "teamId":T1ID,"swimmerId":SW1ID,"refereeId":REFID
    # lapNumber omitted → auto
})
check("T1 lap after timeout → 201",     s(r) == 201, s(r))
check("lapNumber auto = 2",             j(r)["data"]["lapNumber"] == 2, j(r)["data"].get("lapNumber"))

# Record T2 and T3 laps (no previous laps for them, so no double-count)
for team, sw, lane in [(T2ID, SW2ID, 2), (T3ID, SW3ID, 3)]:
    r = client.post("/lap-counts", json={
        "competitionId":CID,"laneNumber":lane,
        "teamId":team,"swimmerId":sw,"refereeId":REFID,"lapNumber":1
    })
    check(f"first lap team lane {lane} → 201", s(r) == 201, s(r))

# T2 second lap (wait timeout)
print("  [waiting 6s for T2 double-count timeout...]")
time.sleep(6)
r = client.post("/lap-counts", json={"competitionId":CID,"laneNumber":2,"teamId":T2ID,"swimmerId":SW2ID,"refereeId":REFID,"lapNumber":2})
check("T2 lap 2 → 201",                 s(r) == 201, s(r))

# Total: T1(2) + T2(2) + T3(1) = 5
r = client.get("/lap-counts", query_string={"competitionId":CID})
check("GET /lap-counts all → 5",        len(j(r)["data"]) == 5, len(j(r)["data"]))
check("filter teamId → T1=2",           len(j(client.get("/lap-counts", query_string={"teamId":T1ID}))["data"]) == 2)
check("filter swimmerId → T2=2",        len(j(client.get("/lap-counts", query_string={"swimmerId":SW2ID}))["data"]) == 2)

# ═════════════════════════════════════════════════════════════════════════════
section("Stats: Leaderboard")
r = client.get(f"/competitions/{CID}/stats")
check("GET /stats → 200",               s(r) == 200, s(r))
data = j(r)["data"]
check("totalLaps = 5",                  data["totalLaps"] == 5, data["totalLaps"])
check("3 teams in leaderboard",         len(data.get("teamStats",[])) == 3)
# T2 has 2 laps, T1 has 2 laps, T3 has 1
leaders = {d["team"]["id"]: d["totalLaps"] for d in data["teamStats"]}
check("T1 = 2 laps",                    leaders.get(T1ID) == 2, leaders)
check("T2 = 2 laps",                    leaders.get(T2ID) == 2, leaders)
check("T3 = 1 lap",                     leaders.get(T3ID) == 1, leaders)
check("activeSessions = 3",             data["activeSessions"] == 3, data["activeSessions"])
check("lapsPerHour field",              "lapsPerHour" in data["teamStats"][0])
check("fastestLapSec field",            "fastestLapSec" in data["teamStats"][0])

r = client.get(f"/competitions/{CID}/team-stats")
check("GET /team-stats → 200",          s(r) == 200)
check("returns list",                   isinstance(j(r)["data"], list))

r = client.get(f"/competitions/{CID}/swimmer-stats")
check("GET /swimmer-stats → 200",       s(r) == 200)
check("returns list of swimmers",       isinstance(j(r)["data"], list))
# Check water time
sw_stats = {d["swimmer"]["id"]: d for d in j(r)["data"]}
check("T2 swimmer totalWaterSeconds ≥ 0", sw_stats[SW2ID]["totalWaterSeconds"] >= 0)

check("unknown comp → 404",             s(client.get("/competitions/nope/stats")) == 404)

# ═════════════════════════════════════════════════════════════════════════════
section("Session/Lap Sync Integrity")
r = client.get("/swim-sessions", query_string={"competitionId":CID,"teamId":T1ID,"isActive":"true"})
check("T1 session lapCount = 2",        j(r)["data"][0]["lapCount"] == 2, j(r)["data"][0].get("lapCount"))

r = client.get("/swim-sessions", query_string={"competitionId":CID,"teamId":T2ID,"isActive":"true"})
check("T2 session lapCount = 2",        j(r)["data"][0]["lapCount"] == 2, j(r)["data"][0].get("lapCount"))

# ═════════════════════════════════════════════════════════════════════════════
section("Referee Delete: FK Safety")
# Create REF2, record a lap, then delete → must not FK-violate
r = client.post("/referees", json={"competitionId":CID})
REF2ID = j(r)["data"]["id"]; REF2UID = j(r)["data"]["userId"]; REF2PW = j(r)["data"]["password"]

print("  [waiting 6s for double-count timeout on T3...]")
time.sleep(6)
r = client.post("/lap-counts", json={
    "competitionId":CID,"laneNumber":3,
    "teamId":T3ID,"swimmerId":SW3ID,"refereeId":REF2ID,"lapNumber":2
})
check("lap recorded by REF2 → 201",     s(r) == 201, s(r))

r = client.delete(f"/referees/{REF2ID}")
check("delete referee with laps → 200", s(r) == 200, s(r))

# REF2's lap is deleted too
r = client.get("/lap-counts", query_string={"competitionId":CID})
check("lap count now 5 (REF2 lap removed)", len(j(r)["data"]) == 5, len(j(r)["data"]))
check("delete unknown referee → 404",   s(client.delete("/referees/nope")) == 404)

# ═════════════════════════════════════════════════════════════════════════════
section("Isolated Team & Swimmer Delete")
r = client.post("/teams", json={"name":"Temp","color":"#cccccc","competitionId":CID,"assignedLane":9})
TMPTEAM = j(r)["data"]["id"]
r = client.delete(f"/teams/{TMPTEAM}")
check("delete empty team → 200",        s(r) == 200)
check("team gone",                      len(j(client.get("/teams", query_string={"competitionId":CID,"laneNumber":9}))["data"]) == 0)
check("delete unknown team → 404",      s(client.delete("/teams/nope")) == 404)

r = client.post("/swimmers", json={"name":"Tmp","teamId":T3ID,"competitionId":CID,"isUnder12":False})
TMPSW = j(r)["data"]["id"]
check("delete swimmer → 200",           s(client.delete(f"/swimmers/{TMPSW}")) == 200)
check("delete unknown swimmer → 404",   s(client.delete("/swimmers/nope")) == 404)

# ═════════════════════════════════════════════════════════════════════════════
section("Competition Lifecycle: Complete & Cascade Delete")
r = client.put(f"/competitions/{CID}", json={"status":"completed","actualEndTime":"2026-07-02T10:00:00Z"})
check("→ completed → 200",              s(r) == 200)
check("actualEndTime stored",           j(r)["data"]["actualEndTime"] == "2026-07-02T10:00:00Z")

r = client.delete(f"/competitions/{CID}")
check("DELETE comp → 200",              s(r) == 200, s(r))
d = j(r).get("deleted", {})
check("deleted.teams = 3",              d.get("teams") == 3, d)
check("deleted.swimmers = 4",           d.get("swimmers") == 4, d)
check("deleted.referees = 1",           d.get("referees") == 1, d)
check("deleted.lapCounts = 5",          d.get("lapCounts") == 5, d.get("lapCounts"))

check("comp gone → 404",                s(client.get(f"/competitions/{CID}")) == 404)
check("teams gone",                     len(j(client.get("/teams", query_string={"competitionId":CID}))["data"]) == 0)
check("swimmers gone",                  len(j(client.get("/swimmers", query_string={"competitionId":CID}))["data"]) == 0)
check("laps gone",                      len(j(client.get("/lap-counts", query_string={"competitionId":CID}))["data"]) == 0)
check("delete again → 404",             s(client.delete(f"/competitions/{CID}")) == 404)

# ═════════════════════════════════════════════════════════════════════════════
total = passed + len(failures)
print(f"\n{'═'*60}")
print(f"  Results: {passed}/{total} passed")
if failures:
    print(f"\n  FAILED ({len(failures)}):")
    for f in failures:
        print(f"    ✗ {f}")
    sys.exit(1)
else:
    print(f"\n  🏊 ALL {total} TESTS PASSED")
    sys.exit(0)
