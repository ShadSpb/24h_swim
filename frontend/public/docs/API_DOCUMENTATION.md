# SwimTrack Remote API Documentation

This document describes the API endpoints required for remote storage mode. When configured to use remote API, the application will call these endpoints instead of using browser localStorage.

## Configuration

In the Admin panel, switch to "Remote API" storage mode and configure:
- **Base URL**: The base URL of your API server (e.g., `https://api.yourserver.com`)
- **API Key**: Authentication key sent in the `X-API-Key` header

## Authentication

All requests include the following headers:
```
Content-Type: application/json
X-API-Key: <configured_api_key>
```

---

## Endpoints

### Authentication

#### POST /auth/login
Authenticate a user and receive a session token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "string (UUID)",
    "email": "string",
    "name": "string",
    "role": "organizer" | "referee",
    "createdAt": "string (ISO 8601)"
  },
  "role": "organizer" | "referee"
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

#### POST /auth/register
Register a new user (organizer only).

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "name": "string",
  "role": "organizer"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "user": {
    "id": "string (UUID)",
    "email": "string",
    "name": "string",
    "role": "organizer",
    "createdAt": "string (ISO 8601)"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Email already exists"
}
```

---

### Competitions

#### GET /competitions
Get all competitions or filter by organizer.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizerId | string | No | Filter by organizer ID |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "date": "string (YYYY-MM-DD)",
      "location": "string",
      "startTime": "string (HH:MM)",
      "status": "upcoming" | "active" | "paused" | "completed",
      "organizerId": "string (UUID)",
      "numberOfLanes": "number (1-10)",
      "actualStartTime": "string (ISO 8601) | null",
      "actualEndTime": "string (ISO 8601) | null",
      "doubleCountTimeout": "number (seconds, default: 15)"
    }
  ]
}
```

---

#### GET /competitions/:id
Get a single competition by ID.

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Competition UUID |

**Response (200 OK):**
```json
{
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "date": "string (YYYY-MM-DD)",
    "location": "string",
    "startTime": "string (HH:MM)",
    "status": "upcoming" | "active" | "paused" | "completed",
    "organizerId": "string (UUID)",
    "numberOfLanes": "number",
    "actualStartTime": "string (ISO 8601) | null",
    "actualEndTime": "string (ISO 8601) | null",
    "doubleCountTimeout": "number"
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Competition not found"
}
```

---

#### POST /competitions
Create a new competition.

**Request Body:**
```json
{
  "name": "string",
  "date": "string (YYYY-MM-DD)",
  "location": "string",
  "startTime": "string (HH:MM)",
  "organizerId": "string (UUID)",
  "numberOfLanes": "number (1-10)",
  "doubleCountTimeout": "number (optional, default: 15)"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "date": "string",
    "location": "string",
    "startTime": "string",
    "status": "upcoming",
    "organizerId": "string",
    "numberOfLanes": "number",
    "actualStartTime": null,
    "actualEndTime": null,
    "doubleCountTimeout": "number"
  }
}
```

---

#### PUT /competitions/:id
Update an existing competition.

**Request Body:**
```json
{
  "name": "string (optional)",
  "date": "string (optional)",
  "location": "string (optional)",
  "startTime": "string (optional)",
  "status": "upcoming" | "active" | "paused" | "completed" (optional)",
  "numberOfLanes": "number (optional)",
  "actualStartTime": "string (optional)",
  "actualEndTime": "string (optional)",
  "doubleCountTimeout": "number (optional)"
}
```

**Response (200 OK):**
```json
{
  "data": { /* Updated competition object */ }
}
```

---

#### DELETE /competitions/:id
Delete a competition and all related data.

**IMPORTANT: Cascade Delete Requirements**

When a competition is deleted, the backend MUST also delete all related data:
- All teams belonging to this competition
- All swimmers belonging to this competition
- All referees associated with this competition (including their user accounts)
- All lane assignments for this competition
- All lap counts for this competition
- All swim sessions for this competition

**Response (200 OK):**
```json
{
  "success": true,
  "deleted": {
    "teams": "number",
    "swimmers": "number",
    "referees": "number",
    "lapCounts": "number",
    "swimSessions": "number"
  }
}
```

---

### Competition Results PDF

When a competition status changes to `completed`, the client generates a PDF with final results and stores it in the `resultsPdf` field. The backend should:

1. Accept the `resultsPdf` field (base64 data URI) when saving a competition
2. Return it when fetching completed competitions
3. Optionally, generate the PDF server-side if preferred

**Competition Object with Results:**
```json
{
  "id": "string (UUID)",
  "name": "string",
  "status": "completed",
  "resultsPdf": "data:application/pdf;base64,... (optional)",
  ...
}
```

---

### Teams

#### GET /teams
Get all teams, optionally filtered.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| competitionId | string | No | Filter by competition ID |
| laneNumber | number | No | Filter by assigned lane |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "color": "string (hex color, e.g., #FF5733)",
      "competitionId": "string (UUID)",
      "assignedLane": "number (1-10)"
    }
  ]
}
```

---

#### POST /teams
Create a new team.

**Request Body:**
```json
{
  "name": "string",
  "color": "string (hex color)",
  "competitionId": "string (UUID)",
  "assignedLane": "number (1-10)"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "color": "string",
    "competitionId": "string",
    "assignedLane": "number"
  }
}
```

---

#### PUT /teams/:id
Update a team.

**Request Body:**
```json
{
  "name": "string (optional)",
  "color": "string (optional)",
  "assignedLane": "number (optional)"
}
```

**Response (200 OK):**
```json
{
  "data": { /* Updated team object */ }
}
```

---

#### DELETE /teams/:id
Delete a team and all its swimmers.

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### Swimmers

#### GET /swimmers
Get all swimmers, optionally filtered.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| competitionId | string | No | Filter by competition ID |
| teamId | string | No | Filter by team ID |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "teamId": "string (UUID)",
      "competitionId": "string (UUID)",
      "isUnder12": "boolean"
    }
  ]
}
```

---

#### POST /swimmers
Create a new swimmer.

**Request Body:**
```json
{
  "name": "string",
  "teamId": "string (UUID)",
  "competitionId": "string (UUID)",
  "isUnder12": "boolean (optional, default: false)"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "teamId": "string",
    "competitionId": "string",
    "isUnder12": "boolean"
  }
}
```

---

#### PUT /swimmers/:id
Update a swimmer.

**Response (200 OK):**
```json
{
  "data": { /* Updated swimmer object */ }
}
```

---

#### DELETE /swimmers/:id
Delete a swimmer.

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### Referees

#### GET /referees
Get all referees, optionally filtered.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| competitionId | string | No | Filter by competition ID |
| userId | string | No | Filter by user ID |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "string (UUID)",
      "uniqueId": "string (6 chars, e.g., 'ABC123')",
      "competitionId": "string (UUID)",
      "userId": "string (email/username)",
      "email": "string",
      "createdAt": "string (ISO 8601)"
    }
  ]
}
```

---

#### POST /referees
Create a new referee (generates unique ID and password).

**Request Body:**
```json
{
  "competitionId": "string (UUID)"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "string (UUID)",
    "uniqueId": "string (6 chars)",
    "competitionId": "string",
    "password": "string (human-friendly, e.g., 'SwiftDolphin42')",
    "userId": "string",
    "email": "string",
    "createdAt": "string (ISO 8601)"
  }
}
```

---

#### DELETE /referees/:id
Delete a referee and their user account.

**Response (200 OK):**
```json
{
  "success": true
}
```

---

### Lap Counts

#### GET /lap-counts
Get lap counts with filters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| competitionId | string | No | Filter by competition ID |
| teamId | string | No | Filter by team ID |
| swimmerId | string | No | Filter by swimmer ID |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "string (UUID)",
      "competitionId": "string (UUID)",
      "laneNumber": "number",
      "teamId": "string (UUID)",
      "swimmerId": "string (UUID)",
      "refereeId": "string (UUID)",
      "timestamp": "string (ISO 8601)",
      "lapNumber": "number"
    }
  ]
}
```

---

#### POST /lap-counts
Record a new lap count.

**Request Body:**
```json
{
  "competitionId": "string (UUID)",
  "laneNumber": "number",
  "teamId": "string (UUID)",
  "swimmerId": "string (UUID)",
  "refereeId": "string (UUID)",
  "lapNumber": "number"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "string (UUID)",
    "competitionId": "string",
    "laneNumber": "number",
    "teamId": "string",
    "swimmerId": "string",
    "refereeId": "string",
    "timestamp": "string (ISO 8601)",
    "lapNumber": "number"
  }
}
```

**Response (429 Too Many Requests):**
```json
{
  "error": "Double count detected",
  "retryAfter": "number (seconds)"
}
```

---

### Swim Sessions

#### GET /swim-sessions
Get swim sessions with filters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| competitionId | string | No | Filter by competition ID |
| teamId | string | No | Filter by team ID |
| isActive | boolean | No | Filter by active status |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "string (UUID)",
      "competitionId": "string (UUID)",
      "swimmerId": "string (UUID)",
      "teamId": "string (UUID)",
      "laneNumber": "number",
      "startTime": "string (ISO 8601)",
      "endTime": "string (ISO 8601) | null",
      "lapCount": "number",
      "isActive": "boolean"
    }
  ]
}
```

---

#### POST /swim-sessions
Start a new swim session.

**Request Body:**
```json
{
  "competitionId": "string (UUID)",
  "swimmerId": "string (UUID)",
  "teamId": "string (UUID)",
  "laneNumber": "number"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "string (UUID)",
    "competitionId": "string",
    "swimmerId": "string",
    "teamId": "string",
    "laneNumber": "number",
    "startTime": "string (ISO 8601)",
    "endTime": null,
    "lapCount": 0,
    "isActive": true
  }
}
```

**Response (409 Conflict):**
```json
{
  "error": "Team already has an active swimmer"
}
```

---

#### PUT /swim-sessions/:id
Update a swim session (e.g., end session).

**Request Body:**
```json
{
  "endTime": "string (ISO 8601, optional)",
  "lapCount": "number (optional)",
  "isActive": "boolean (optional)"
}
```

**Response (200 OK):**
```json
{
  "data": { /* Updated session object */ }
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid or missing API key"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Data Types Reference

### Competition Status
- `upcoming` - Competition not yet started
- `active` - Competition in progress
- `paused` - Competition temporarily paused
- `completed` - Competition finished

### User Roles
- `organizer` - Can create and manage competitions
- `referee` - Can count laps for assigned competitions

### UUID Format
All IDs use UUID v4 format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`

### ISO 8601 Date/Time
Timestamps use ISO 8601 format: `2024-01-15T10:30:00.000Z`

### Hex Color
Colors use hex format with hash: `#FF5733`
