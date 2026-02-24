# Soar School Management System API

A RESTful API for managing schools, classrooms, and students with role-based access control (RBAC).

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Request & Response Formats](#request--response-formats)
- [Role-Based Access Control](#role-based-access-control)
- [Database Schema](#database-schema)
- [Error Codes & Handling](#error-codes--handling)
- [Security](#security)
- [Testing](#testing)
- [Docker Deployment](#docker-deployment)
- [Assumptions & Design Decisions](#assumptions--design-decisions)

---

## Architecture Overview

The application follows a modular **Manager Pattern** where each domain entity (School, Classroom, Student, User, Auth) has its own manager responsible for business logic. Managers are auto-discovered and wired at startup by the framework's loader system.

```
Client Request
  │
  ▼
Express Server (helmet, cors, compression)
  │
  ▼
API Handler (auto-discovers httpExposed methods)
  │
  ▼
Middleware Pipeline (__longToken → __superadmin / __schoolAdmin → __query)
  │
  ▼
Entity Manager (business logic)
  │
  ▼
MongoDB (Mongoose)  +  Redis (Cache / Cortex / Oyster)
```

Middleware injection is **convention-based**: any method parameter prefixed with `__` (e.g., `__longToken`, `__superadmin`, `__schoolAdmin`) automatically triggers the corresponding middleware file before the method executes.

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **MongoDB** running locally or a remote URI
- **Redis** running locally or a remote URI

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd soar-school-management

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your own secrets and connection URIs (see below)

# 4. Start in development mode (with hot-reload)
npm run dev

# 5. Start in production mode
npm start
```

The server starts on **`http://localhost:5111`** by default.

- **Health check**: `GET http://localhost:5111/health`
- **Swagger UI**: `http://localhost:5111/api-docs`

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVICE_NAME` | Service identifier | `school-management` |
| `ENV` | Environment (`development` / `production`) | `development` |
| `USER_PORT` | HTTP server port | `5111` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/school-management` |
| `REDIS_URI` | Redis connection string | `redis://127.0.0.1:6379` |
| `CORTEX_REDIS` | Redis URL for Cortex (inter-service messaging) | Same as `REDIS_URI` |
| `CORTEX_PREFIX` | Cortex key prefix | `school` |
| `OYSTER_REDIS` | Redis URL for Oyster (key-value DB) | Same as `REDIS_URI` |
| `OYSTER_PREFIX` | Oyster key prefix | `school` |
| `CACHE_REDIS` | Redis URL for caching | Same as `REDIS_URI` |
| `CACHE_PREFIX` | Cache key prefix | `school:ch` |
| `LONG_TOKEN_SECRET` | **Required.** Secret for signing JWT long tokens | – |
| `SHORT_TOKEN_SECRET` | **Required.** Secret for signing JWT short tokens | – |
| `NACL_SECRET` | **Required.** NaCl encryption secret (base64) | – |
| `LOG_LEVEL` | Winston log level | `info` |

> **IMPORTANT**: `LONG_TOKEN_SECRET`, `SHORT_TOKEN_SECRET`, and `NACL_SECRET` must be set.
---

### Token Details

| Token Type | Lifetime | Purpose | Payload |
|------------|----------|---------|---------|
| Long Token | 3 years | Primary authentication | `userId`, `userKey`, `role`, `schoolId` |
| Short Token | 1 year | Device sessions (optional) | `userId`, `userKey`, `sessionId`, `deviceId` |

### How to Authenticate

1. **Register** via `POST /api/auth/register` with `username`, `email`, `password`, and `role`
2. **Login** via `POST /api/auth/login` with `email` and `password`
3. Both return a `longToken` in the response
4. Include the token in all subsequent requests as a **header**: `token: <your-jwt-long-token>`

---

## API Endpoints

All endpoints follow the pattern: `{method} /api/{module}/{function}`

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Register a new user |
| POST | `/api/auth/login` | None | Login and receive JWT token |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PUT | `/api/user/assignSchool` | Superadmin | Assign a school to a school_admin user |

### Schools

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/school/createSchool` | Superadmin | Create a new school |
| GET | `/api/school/getSchools?page=1&limit=10` | Authenticated | List schools (scoped by role) |
| GET | `/api/school/getSchool?id={schoolId}` | Authenticated | Get school by ID |
| PUT | `/api/school/updateSchool?id={schoolId}` | Superadmin | Update school details |
| DELETE | `/api/school/deleteSchool?id={schoolId}` | Superadmin | Soft-delete a school |

### Classrooms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/classroom/createClassroom` | School-scoped | Create a classroom |
| GET | `/api/classroom/getClassrooms?schoolId={id}&page=1&limit=10` | School-scoped | List classrooms |
| GET | `/api/classroom/getClassroom?id={classroomId}` | School-scoped | Get classroom by ID |
| PUT | `/api/classroom/updateClassroom?id={classroomId}` | School-scoped | Update classroom |
| DELETE | `/api/classroom/deleteClassroom?id={classroomId}` | School-scoped | Soft-delete classroom |

### Students

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/student/createStudent` | School-scoped | Enroll a new student |
| GET | `/api/student/getStudents?schoolId={id}&classroomId={id}&status=active&page=1&limit=10` | School-scoped | List students (filterable) |
| GET | `/api/student/getStudent?id={studentId}` | School-scoped | Get student by ID |
| PUT | `/api/student/updateStudent?id={studentId}` | School-scoped | Update student profile |
| DELETE | `/api/student/deleteStudent?id={studentId}` | School-scoped | Soft-delete student |
| POST | `/api/student/transferStudent` | School-scoped | Transfer student between schools/classrooms |

---

## Request & Response Formats

### Standard Success Response

```json
{
  "ok": true,
  "data": { ... }
}
```

### Standard Error Response

```json
{
  "ok": false,
  "message": "Error description"
}
```

### Validation Error Response

```json
{
  "ok": false,
  "errors": [
    "username is required",
    "email format is invalid"
  ]
}
```

### Example Requests

<details>
<summary><strong>Register</strong></summary>

```bash
curl -X POST http://localhost:5111/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin1",
    "email": "admin@example.com",
    "password": "securePass123",
    "role": "superadmin"
  }'
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "user": {
      "_id": "...",
      "username": "admin1",
      "email": "admin@example.com",
      "role": "superadmin",
      "schoolId": null,
      "createdAt": "2026-02-23T12:00:00.000Z"
    },
    "longToken": "eyJhbG..."
  }
}
```
</details>

<details>
<summary><strong>Login</strong></summary>

```bash
curl -X POST http://localhost:5111/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securePass123"
  }'
```
</details>

<details>
<summary><strong>Create School</strong></summary>

```bash
curl -X POST http://localhost:5111/api/school/createSchool \
  -H "Content-Type: application/json" \
  -H "token: <superadmin-jwt>" \
  -d '{
    "name": "Springfield Elementary",
    "address": "123 Education Ave",
    "phone": "+1234567890",
    "email": "info@springfield.edu",
    "description": "A leading school in education"
  }'
```
</details>

<details>
<summary><strong>Assign School to Admin</strong></summary>

```bash
curl -X PUT http://localhost:5111/api/user/assignSchool \
  -H "Content-Type: application/json" \
  -H "token: <superadmin-jwt>" \
  -d '{
    "userId": "<school_admin_user_id>",
    "schoolId": "<school_id>"
  }'
```
</details>

<details>
<summary><strong>Enroll Student</strong></summary>

```bash
curl -X POST http://localhost:5111/api/student/createStudent \
  -H "Content-Type: application/json" \
  -H "token: <jwt-token>" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@student.com",
    "dateOfBirth": "2010-05-15",
    "classroomId": "<classroom_id>",
    "schoolId": "<school_id>",
    "guardianInfo": {
      "name": "Jane Doe",
      "phone": "+1234567890",
      "email": "jane@example.com",
      "relationship": "Mother"
    }
  }'
```
</details>

<details>
<summary><strong>Transfer Student</strong></summary>

```bash
curl -X POST http://localhost:5111/api/student/transferStudent \
  -H "Content-Type: application/json" \
  -H "token: <superadmin-jwt>" \
  -d '{
    "id": "<student_id>",
    "targetSchoolId": "<new_school_id>",
    "targetClassroomId": "<new_classroom_id>"
  }'
```
</details>

---

## Role-Based Access Control

### Roles

| Role | Description |
|------|-------------|
| `superadmin` | Full system access. Can manage all schools, classrooms, students, and assign schools to admins. |
| `school_admin` | Scoped to their assigned school. Full CRUD on classrooms and students within their school only. |

### Permission Matrix

| Resource | Action | Superadmin | School Admin |
|----------|--------|:----------:|:------------:|
| **Schools** | Create |
| | List All | (sees own school only) |
| | View | (any) | (own school only) |
| | Update | 
| | Delete |
| **Users** | Assign School |
| **Classrooms** | Create |  (any school) |  (own school) |
| | List |  (any school) |  (own school only) |
| | View |  (any) |  (own school only) |
| | Update |  (any) |  (own school only) |
| | Delete |  (any) |  (own school only) |
| **Students** | Enroll |  (any school) |  (own school) |
| | List |  (any school) |  (own school only) |
| | View |  (any) |  (own school only) |
| | Update |  (any) |  (own school only) |
| | Delete |  (any) |  (own school only) |
| | Transfer (cross-school) | 
| | Transfer (within school) |  

### How Scoping Works

School admins are **automatically scoped** to their assigned school. Even if a school_admin passes a different `schoolId` in the request, the system ignores it and uses their assigned school from the JWT token. This is enforced via the `_getSchoolScope()` helper and `__schoolAdmin` middleware.

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌────────────────┐
│     User     │       │      School      │       │   Classroom    │
├──────────────┤       ├──────────────────┤       ├────────────────┤
│ _id          │       │ _id              │       │ _id            │
│ username *   │       │ name *           │       │ name *         │
│ email *      │──┐    │ address *        │    ┌──│ school *       │
│ password *   │  │    │ phone            │    │  │ capacity *     │
│ role *       │  │    │ email            │    │  │ resources []   │
│ schoolId     │──┼───►│ website          │◄───┘  │ grade          │
│ isDeleted    │  │    │ established      │       │ section        │
│ createdAt    │  │    │ description      │       │ createdBy *    │
│ updatedAt    │  │    │ createdBy *      │       │ isDeleted      │
└──────────────┘  │    │ isDeleted        │       │ createdAt      │
                  │    │ createdAt        │       │ updatedAt      │
                  │    │ updatedAt        │       └───────┬────────┘
                  │    └──────────────────┘               │
                  │                                       │
                  │    ┌──────────────────┐               │
                  │    │     Student      │               │
                  │    ├──────────────────┤               │
                  │    │ _id              │               │
                  │    │ firstName *      │               │
                  │    │ lastName *       │               │
                  │    │ email *          │               │
                  │    │ dateOfBirth *    │               │
                  │    │ school *         │───► School    │
                  │    │ classroom        │───► Classroom─┘
                  │    │ enrollmentDate   │
                  │    │ status           │ (active | transferred | graduated)
                  │    │ guardianInfo {}  │
                  └───►│ enrolledBy *     │
                       │ isDeleted        │
                       │ createdAt        │
                       │ updatedAt        │
                       └──────────────────┘

* = required field
```

### Indexes

| Collection | Index | Type |
|------------|-------|------|
| User | `{ email: 1 }` | Unique |
| User | `{ username: 1 }` | Unique |
| User | `{ role: 1 }` | Regular |
| User | `{ schoolId: 1 }` | Regular |
| User | `{ isDeleted: 1 }` | Regular |
| School | `{ name: 1 }` | Regular |
| School | `{ createdBy: 1 }` | Regular |
| School | `{ isDeleted: 1 }` | Regular |
| Classroom | `{ school: 1 }` | Regular |
| Classroom | `{ school: 1, name: 1 }` | Unique (compound) |
| Classroom | `{ createdBy: 1 }` | Regular |
| Classroom | `{ isDeleted: 1 }` | Regular |
| Student | `{ email: 1 }` | Unique |
| Student | `{ school: 1 }` | Regular |
| Student | `{ classroom: 1 }` | Regular |
| Student | `{ school: 1, status: 1 }` | Compound |
| Student | `{ enrolledBy: 1 }` | Regular |
| Student | `{ isDeleted: 1 }` | Regular |

---

## Error Codes & Handling

### HTTP Status Codes

| Status | Meaning | When |
|--------|---------|------|
| `200` | Success | Request processed successfully |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Insufficient permissions (wrong role, wrong school) |
| `500` | Internal Server Error | Unexpected server error |


### Error Handling Strategy

- **Validation errors** return `{ ok: false, errors: [...] }` with an array of field-level messages
- **Business logic errors** return `{ ok: false, message: "..." }` with a descriptive message
- **Unhandled exceptions** are caught by the global error handler and return a `500` status
- All errors are logged via Winston to `logs/error.log` with stack traces

---

## Security

| Feature | Implementation |
|---------|---------------|
| **Password Hashing** | bcrypt with 10 salt rounds (Mongoose pre-save hook) |
| **JWT Authentication** | Tokens verified on every authenticated request via middleware |
| **RBAC** | Role-based middleware (`__superadmin`, `__schoolAdmin`) enforced at the API layer |
| **School Scoping** | School admins are hard-scoped to their assigned school; `schoolId` from request body is ignored |
| **Helmet** | Sets secure HTTP headers (X-Frame-Options, CSP, HSTS, etc.) |
| **CORS** | Configurable Cross-Origin Resource Sharing |
| **Rate Limiting** | Redis-backed sliding window rate limiter (100 requests / 15 min per IP) |
| **Input Validation** | Schema-based validation on all inputs before business logic |
| **Soft Deletes** | Records are never physically removed; `isDeleted` flag is used |
| **Password Exclusion** | Password field is stripped from all JSON responses via `toJSON()` override |
| **Gzip Compression** | Response compression via `compression` middleware |
| **Request Size Limit** | Body parser limited to 10MB |

---

## Testing

```bash
# Run all tests with coverage
npm test

# Run specific test file
npx jest tests/auth.test.js
```

Tests use **Jest** and **Supertest** for HTTP endpoint testing.

---

## Docker Deployment

### Using Docker Compose (recommended)

```bash
# Build and start all services (app + MongoDB + Redis)
docker-compose up --build

# Run in detached mode
docker-compose up --build -d

# Stop services
docker-compose down
```

This starts:
- **App** on port `5111`
- **MongoDB** on port `27017` (with persistent volume)
- **Redis** on port `6379` (with persistent volume)

### Using Dockerfile only

```bash
docker build -t soar-school-management .
docker run -p 5111:5111 \
  -e MONGO_URI=mongodb://your-mongo:27017/school-management \
  -e REDIS_URI=redis://your-redis:6379 \
  -e LONG_TOKEN_SECRET=your-secret \
  -e SHORT_TOKEN_SECRET=your-secret \
  -e NACL_SECRET=your-secret \
  soar-school-management
```

---

## Assumptions & Design Decisions

1. **Two-role system**: The system supports exactly two roles — `superadmin` and `school_admin`. No student or parent login is required.

2. **School assignment is a separate step**: When a `school_admin` registers, they do not specify a school. A `superadmin` must explicitly assign a school to them via `PUT /api/user/assignSchool`. Until assigned, the school admin cannot access any school-scoped resources.

3. **Soft deletes**: All deletions are soft (setting `isDeleted: true`). This preserves data integrity and audit history. Deleted records are excluded from all queries.

4. **School scoping is server-enforced**: School admins are automatically scoped to their assigned school via JWT claims. Client-side `schoolId` is ignored for school admins, preventing privilege escalation.

5. **Classroom capacity enforcement**: Students cannot be enrolled or transferred into a classroom that has reached its capacity limit.

6. **Cross-school transfers are superadmin-only**: School admins can only transfer students within their own school (between classrooms). Transferring students between schools requires superadmin privileges.

7. **JWT long-lived tokens**: Long tokens have a 3-year expiry for convenience. In production, this should be shortened and a refresh token mechanism should be implemented.

8. **Password security**: Passwords are hashed with bcrypt (10 salt rounds) and are never returned in API responses.

9. **Unique constraints**: Emails are unique across both the User and Student collections. Classroom names are unique within a school (compound unique index).

10. **Pagination defaults**: List endpoints default to 10 results per page and support configurable `page` and `limit` query parameters.
