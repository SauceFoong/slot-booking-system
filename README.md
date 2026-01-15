# Slot Booking System

A production-ready REST API for managing time slot bookings, built with Node.js, Express, TypeScript, and Prisma. The system handles concurrent booking requests using pessimistic locking and maintains data consistency under high load.

## Table of Contents

- [System Design](#system-design)
- [Design Decisions and Trade-offs](#design-decisions-and-trade-offs)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Docker Commands](#docker-commands)
- [Prisma Commands](#prisma-commands)
- [API Endpoints](#api-endpoints)
- [Test Cases](#test-cases)
- [Project Structure](#project-structure)
- [Agentic Workflow Write Up](#agentic-workflow-write-up)
- [Core Requirements Checklist](#core-requirements-checklist)

---

## System Design

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|     Clients      |     |   Application    |     |    Database      |
|                  |     |                  |     |                  |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         |   HTTP Requests        |                        |
         | ---------------------> |                        |
         |                        |                        |
         |               +--------v---------+              |
         |               |                  |              |
         |               |     Express      |              |
         |               |     Server       |              |
         |               |                  |              |
         |               +--------+---------+              |
         |                        |                        |
         |               +--------v---------+     +------------------+
         |               |                  |     |                  |
         |               |   Middleware     |     |      Redis       |
         |               | - Rate Limiter  -|---->| - Rate Limits    |
         |               | - Error Handler  |     | - Queue Jobs     |
         |               | - Request Logger |     |                  |
         |               | - User Context   |     +------------------+
         |               |                  |              |
         |               +--------+---------+              |
         |                        |                        |
         |               +--------v---------+              |
         |               |                  |              |
         |               |     Routes       |              |
         |               | - /users         |              |
         |               | - /slots         |              |
         |               | - /bookings      |              |
         |               | - /admin         |              |
         |               |                  |              |
         |               +--------+---------+              |
         |                        |                        |
         |               +--------v---------+              |
         |               |                  |              |
         |               |   Controllers    |              |
         |               | - Validation     |              |
         |               | - Request Parse  |              |
         |               |                  |              |
         |               +--------+---------+              |
         |                        |                        |
         |                        | (Optional Queue Mode)  |
         |               +--------v---------+              |
         |               |                  |              |
         |               |  Booking Queue   |              |
         |               |    (BullMQ)     -|------------->|
         |               |                  |              |
         |               +--------+---------+              |
         |                        |                        |
         |               +--------v---------+              |
         |               |                  |              |
         |               |     Worker       |              |
         |               | - FCFS Processing|              |
         |               |                  |              |
         |               +--------+---------+              |
         |                        |                        |
         |               +--------v---------+              |
         |               |                  |              |
         |               |    Services      |              |
         |               | - Business Logic |              |
         |               | - Transactions   |              |
         |               |                  |              |
         |               +--------+---------+              |
         |                        |                        |
         |               +--------v---------+              |
         |               |                  |              |
         |               |  Repositories    |              |
         |               | - Data Access    |              |
         |               |                  |              |
         |               +--------+---------+              |
         |                        |                        |
         |                        |   Prisma ORM           |
         |                        | ---------------------> |
         |                        |                        |
         |                        |               +--------v---------+
         |                        |               |                  |
         |                        |               |   PostgreSQL     |
         |                        |               | - Users          |
         |                        |               | - Slots          |
         |                        |               | - Bookings       |
         |                        |               |                  |
         |                        |               +------------------+
         |                        |                        |
         |   JSON Response        |                        |
         | <--------------------- |                        |
         |                        |                        |
+--------+---------+     +--------+---------+     +--------+---------+
```

### Architecture Layers

| Layer        | Responsibility                                           |
|--------------|----------------------------------------------------------|
| Routes       | Define API endpoints and apply middleware                |
| Controllers  | Handle HTTP request/response and input validation        |
| Services     | Contain business logic, orchestration, and transactions  |
| Repositories | Abstract database operations                             |
| Prisma       | ORM layer for database communication                     |

### Concurrency Handling

The system uses pessimistic locking (SELECT FOR UPDATE) to prevent double-booking:

```
Transaction 1: SELECT * FROM Slot WHERE id = X FOR UPDATE  (acquires lock)
Transaction 2: SELECT * FROM Slot WHERE id = X FOR UPDATE  (waits for lock)
Transaction 1: UPDATE slot, CREATE booking, COMMIT         (releases lock)
Transaction 2: Reads updated slot, sees status = BOOKED    (returns 409)
```

### Queue-Based Booking (Optional)

For high-demand scenarios requiring true FCFS (First-Come-First-Served) ordering, the system supports Redis + BullMQ queue:

![Sequence Diagram](assets/sequence-diagram.png)

**To Enable Queue Mode, add this to you .env file:**
```bash
USE_BOOKING_QUEUE=true
```

**Benefits:**
- True FCFS ordering (queue processes in strict order)
- Handles burst traffic gracefully
- Pessimistic locking still applies as backup
- Synchronous response maintained

### Rate Limiting

The booking endpoint is protected by Redis-based rate limiting to prevent spam:

| Setting | Value |
|---------|-------|
| Limit | 10 requests per minute |
| Scope | Per user |
| Endpoint | POST /bookings |

**Response Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1737012345
```

**When Rate Limited (429):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 45 seconds."
  }
}
```

---

## Design Decisions and Trade-offs

### Why Pessimistic Locking (SELECT FOR UPDATE)?

| Option | Pros | Cons |
|--------|------|------|
| **Pessimistic Locking** (chosen) | Guarantees consistency, simple mental model, no retry logic needed | Blocks concurrent transactions, potential deadlocks |
| Optimistic Locking | Better throughput, no blocking | Requires retry logic, complex conflict resolution |

**Decision:** Booking a slot is a high-stakes operation where consistency matters more than throughput. Users expect immediate confirmation, not "please retry." Pessimistic locking ensures exactly one user wins without application-level retry complexity.

### Why Redis for Rate Limiting?

| Option | Pros | Cons |
|--------|------|------|
| **Redis** (chosen) | Shared across instances, persistent, atomic operations | External dependency |
| In-memory | No dependencies, fast | Lost on restart, not shared across instances |
| Database | Already available | Too slow for rate limiting, adds load |

**Decision:** Rate limiting must work across multiple server instances in production. Redis provides atomic INCR operations with TTL, making it ideal for distributed rate limiting with minimal latency.

### Why BullMQ for Queue?

| Option | Pros | Cons |
|--------|------|------|
| **BullMQ** (chosen) | Redis-based, reliable, built-in retries, TypeScript support | Requires Redis |
| RabbitMQ | Feature-rich, enterprise-grade | Additional infrastructure, more complex |
| AWS SQS | Managed, scalable | Vendor lock-in, added latency |
| In-memory queue | Simple | Lost on restart, single instance only |

**Decision:** BullMQ leverages the same Redis instance used for rate limiting, avoiding additional infrastructure. It provides reliable job processing with built-in retries and dead-letter handling.

### Synchronous vs Asynchronous Booking Response

| Approach | User Experience | Implementation |
|----------|-----------------|----------------|
| **Synchronous** (chosen) | Immediate confirmation/rejection | `job.waitUntilFinished()` blocks until processed |
| Asynchronous | Returns job ID, poll for result | Better throughput, worse UX |

**Decision:** Users expect immediate feedback when booking. The queue ensures FCFS ordering while `waitUntilFinished()` maintains synchronous response semantics. This trades some throughput for better user experience.

### Clean Architecture (Layered Design)

```
Controller → Service → Repository → Database
```

| Layer | Responsibility | Testability |
|-------|----------------|-------------|
| Controller | HTTP concerns, validation | Mock services |
| Service | Business logic, transactions | Mock repositories |
| Repository | Data access | Mock Prisma |

**Trade-off:** More boilerplate code, but each layer is independently testable and replaceable. Business logic in services remains framework-agnostic.

### Defense in Depth (Multiple Safety Nets)

The system uses three layers to prevent double-booking:

| Layer | Mechanism | Catches |
|-------|-----------|---------|
| Application | Slot status check | Most cases |
| Transaction | `SELECT FOR UPDATE` | Race conditions |
| Database | Partial unique index | Edge cases, bugs |

**Trade-off:** Redundant checks add overhead, but booking integrity is critical. If any layer fails, others catch the error.

### Fixed Window vs Sliding Window Rate Limiting

| Algorithm | Accuracy | Complexity | Memory |
|-----------|----------|------------|--------|
| **Fixed Window** (chosen) | Good enough | Simple | O(1) per user |
| Sliding Window Log | Precise | Complex | O(n) per user |
| Sliding Window Counter | Good | Moderate | O(1) per user |

**Decision:** Fixed window is simple and sufficient for this use case. The edge case (burst at window boundary) is acceptable given the 10 req/min limit.

---

## Entity Relationship Diagram

![ERD Diagram](assets/erd-diagram-v1.png)

**Relationships:**
- User to Slot: One-to-Many (a user can host multiple slots)
- User to Booking: One-to-Many (a user can make multiple bookings)
- Slot to Booking: One-to-Many (a slot can have multiple bookings over time, but only one confirmed at a time)

**Enums:**
- UserRole: HOST, GUEST
- SlotStatus: AVAILABLE, BOOKED, CANCELLED
- BookingStatus: CONFIRMED, CANCELLED

### Table Descriptions

| Table   | Description                                                |
|---------|------------------------------------------------------------|
| User    | Stores user accounts with email, name, and roles           |
| Slot    | Time slots created by hosts with start/end times           |
| Booking | Links a user to a slot, one booking per slot maximum       |

### Key Constraints

- User.email is unique
- Booking.slotId is unique (ensures one booking per slot)
- Slot overlap prevention via PostgreSQL exclusion constraint
- Cascade delete: Deleting a user removes their slots and bookings

---

## Tech Stack

| Component   | Technology              |
|-------------|-------------------------|
| Runtime     | Node.js 18+             |
| Framework   | Express.js              |
| Language    | TypeScript              |
| ORM         | Prisma                  |
| Database    | PostgreSQL              |
| Validation  | Zod                     |
| Testing     | Jest + Supertest        |
| API Docs    | Swagger/OpenAPI         |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Docker
- npm

### Installation

```bash
git clone https://github.com/SauceFoong/slot-booking-system.git
cd slot-booking-system
npm install
```

### Environment Setup

Create a `.env` file:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/slot_booking?schema=public"
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
USE_BOOKING_QUEUE=true
```

### Start Database and Server

```bash
docker-compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The API will be available at http://localhost:3000

Swagger documentation: http://localhost:3000/docs

---

## Docker Commands

| Command                     | Description                              |
|-----------------------------|------------------------------------------|
| `docker-compose up -d`      | Start PostgreSQL and Redis in background |
| `docker-compose down`       | Stop and remove containers               |
| `docker-compose logs -f`    | View container logs                      |
| `docker ps`                 | List running containers                  |
| `docker-compose down -v`    | Stop containers and remove volumes       |

### Docker Compose Configuration

The `docker-compose.yml` provides:

**PostgreSQL 16:**

| Property        | Value                    |
|-----------------|--------------------------|
| Container Name  | slot-booking-db          |
| Port            | 5432                     |
| Username        | postgres                 |
| Password        | postgres                 |
| Database        | slot_booking             |

**Redis 7:**

| Property        | Value                    |
|-----------------|--------------------------|
| Container Name  | slot-booking-redis       |
| Port            | 6379                     |

---

## Prisma Commands

| Command                       | Description                                      |
|-------------------------------|--------------------------------------------------|
| `npm run prisma:generate`     | Generate Prisma Client from schema               |
| `npm run prisma:migrate`      | Create and apply database migrations             |
| `npm run prisma:migrate:deploy` | Apply pending migrations (production)          |
| `npm run prisma:studio`       | Open visual database browser (localhost:5555)    |
| `npm run prisma:seed`         | Seed database with sample data                   |
| `npm run db:reset`            | Reset database (drops all data, re-runs migrations) |

### Typical Workflow

First time setup:
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed        # optional
```

After changing schema.prisma:
```bash
npm run prisma:migrate
```

To view database contents:
```bash
npm run prisma:studio
```

---

## API Endpoints

### Authentication

All authenticated endpoints require the `x-user-id` header:

```bash
curl -H "x-user-id: <user-uuid>" http://localhost:3000/api/slots
```

### Health Check

| Method | Endpoint      | Description         |
|--------|---------------|---------------------|
| GET    | /api/health   | API health status   |

### Users

| Method | Endpoint      | Auth | Description               |
|--------|---------------|------|---------------------------|
| POST   | /api/users    | No   | Create a new user         |
| GET    | /api/users/me | Yes  | Get current user profile  |

**Create User Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "roles": ["GUEST"]
}
```

### Slots

| Method | Endpoint        | Auth | Description                        |
|--------|-----------------|------|------------------------------------|
| POST   | /api/slots      | Yes  | Create a slot (HOST role required) |
| GET    | /api/slots      | Yes  | List available slots               |
| GET    | /api/slots/host | Yes  | List host's own slots              |
| GET    | /api/slots/:id  | Yes  | Get slot by ID                     |
| DELETE | /api/slots/:id  | Yes  | Delete unbooked slot (owner only)  |

**Create Slot Request:**
```json
{
  "startTime": "2026-02-01T10:00:00Z",
  "endTime": "2026-02-01T11:00:00Z"
}
```

**Query Parameters for GET /api/slots:**
| Parameter | Type   | Description                |
|-----------|--------|----------------------------|
| hostId    | string | Filter by host ID          |
| startDate | string | Filter slots after date    |
| endDate   | string | Filter slots before date   |
| page      | number | Page number (default: 1)   |
| limit     | number | Items per page (default: 20) |

### Bookings

| Method | Endpoint          | Auth | Description              |
|--------|-------------------|------|--------------------------|
| POST   | /api/bookings     | Yes  | Create a booking         |
| GET    | /api/bookings     | Yes  | List user's bookings     |
| GET    | /api/bookings/:id | Yes  | Get booking by ID        |
| DELETE | /api/bookings/:id | Yes  | Cancel booking           |

**Create Booking Request:**
```json
{
  "slotId": "<slot-uuid>"
}
```

**Business Rules:**
- Users cannot book their own slots
- Maximum 5 active bookings per user
- Only one active booking per host (cannot book multiple slots from same host)
- A slot can be re-book after it was cancelled
- Cancellation only allowed more than 1 hour before slot start

### Analytics

| Method | Endpoint            | Auth | Description              |
|--------|---------------------|------|--------------------------|
| GET    | /api/admin/analytics | No  | Get booking statistics   |

**Query Parameters:**
| Parameter   | Type   | Required | Description          |
|-------------|--------|----------|----------------------|
| start_date  | string | Yes      | Start of date range  |
| end_date    | string | Yes      | End of date range    |

**Response:**
```json
{
  "success": true,
  "data": {
    "totalBookings": 150,
    "cancellationRate": 12.5,
    "bookingsPerDay": [
      { "date": "2026-01-15", "count": 25 }
    ],
    "topHosts": [
      { "hostId": "...", "hostName": "Alice", "bookingCount": 45 }
    ]
  }
}
```

### Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Slot is no longer available"
  }
}
```

| Status | Code              | Description                     |
|--------|-------------------|---------------------------------|
| 400    | VALIDATION_ERROR  | Invalid request data            |
| 401    | UNAUTHORIZED      | Missing user context            |
| 403    | FORBIDDEN         | Permission denied               |
| 404    | NOT_FOUND         | Resource not found              |
| 409    | CONFLICT          | Conflict (double-booking, etc.) |
| 500    | INTERNAL_ERROR    | Server error                    |

---

## Test Cases

### Running Tests

| Command                                      | Description                        |
|----------------------------------------------|------------------------------------|
| `npm test`                                   | Run all tests                      |
| `npm run test:watch`                         | Run tests in watch mode            |
| `npm run test:coverage`                      | Run tests with coverage report     |
| `npm test -- --testPathPattern=queue`        | Run queue tests only               |
| `npm test -- --testPathPattern=concurrency`  | Run concurrency tests only         |

Note: Queue tests require Redis to be running (`docker-compose up -d`).

### Test Files

| File                  | Description                              |
|-----------------------|------------------------------------------|
| slots.test.ts         | Slot creation, listing, deletion tests   |
| bookings.test.ts      | Booking creation, cancellation tests     |
| concurrency.test.ts   | Race condition and double-booking tests  |
| analytics.test.ts     | Analytics endpoint tests                 |
| queue.test.ts         | Queue-based FCFS and high-load tests     |
| rateLimit.test.ts     | Rate limiting tests                      |

### Test Case Summary

**Slot Tests:**
| Test Case                              | Expected Result                     |
|----------------------------------------|-------------------------------------|
| Create slot with valid times           | 201 Created                         |
| Create slot in the past                | 400 Bad Request                     |
| Create overlapping slot                | 409 Conflict                        |
| Delete own unbooked slot               | 200 OK                              |
| Delete another host's slot             | 403 Forbidden                       |
| Delete booked slot                     | 409 Conflict                        |

**Booking Tests:**
| Test Case                              | Expected Result                     |
|----------------------------------------|-------------------------------------|
| Book available slot                    | 201 Created                         |
| Book own slot                          | 400 Bad Request                     |
| Book already booked slot               | 409 Conflict                        |
| Book past slot                         | 400 Bad Request                     |
| Exceed max bookings (5)                | 409 Conflict                        |
| Cancel booking (more than 1hr before)  | 200 OK                              |
| Cancel booking (less than 1hr before)  | 400 Bad Request                     |
| Cancel other user's booking            | 403 Forbidden                       |

**Concurrency Tests:**
| Test Case                              | Expected Result                     |
|----------------------------------------|-------------------------------------|
| 10 users book same slot simultaneously | 1 success (201), 9 conflicts (409)  |
| 20 users book 5 slots concurrently     | Max 5 bookings, no double-bookings  |
| Sequential booking (first-come-first-served) | First request wins           |

**Analytics Tests:**
| Test Case                              | Expected Result                     |
|----------------------------------------|-------------------------------------|
| Get statistics with valid date range   | 200 OK with data                    |
| Missing date parameters                | 400 Bad Request                     |
| Calculate cancellation rate            | Correct percentage                  |
| Return top hosts by booking count      | Sorted list of hosts                |

**Queue Tests (requires Redis):**
| Test Case                              | Expected Result                     |
|----------------------------------------|-------------------------------------|
| Process booking through queue          | Job completes, booking created      |
| Reject duplicate booking via queue     | Second job fails with CONFLICT      |
| 20 users book 1 slot via queue         | 1 success, 19 rejected              |
| 25 users book 5 slots via queue        | 5 successes (one per slot)          |
| Stress test: 30 concurrent requests    | 1 success, proper queue processing  |

### Concurrency Test Example

The concurrency test verifies the system prevents double-booking:

```typescript
// 10 users attempt to book the same slot simultaneously
const bookingPromises = users.map((user) =>
  request(app)
    .post('/api/bookings')
    .set('x-user-id', user.id)
    .send({ slotId: slot.id })
);

const results = await Promise.all(bookingPromises);

// Exactly 1 booking succeeds, 9 receive conflict errors
expect(results.filter(r => r.status === 201).length).toBe(1);
expect(results.filter(r => r.status === 409).length).toBe(9);
```

---

## Project Structure

```
slot-booking-system/
  prisma/
    schema.prisma           # Database schema definition
    migrations/             # SQL migration files
    seed.ts                 # Sample data seeder
  src/
    controllers/            # HTTP request handlers
      userController.ts
      slotController.ts
      bookingController.ts
      analyticsController.ts
    services/               # Business logic layer
      userService.ts
      slotService.ts
      bookingService.ts
      analyticsService.ts
    repositories/           # Database access layer
      userRepository.ts
      slotRepository.ts
      bookingRepository.ts
      analyticsRepository.ts
    routes/                 # Express route definitions
      userRoutes.ts
      slotRoutes.ts
      bookingRoutes.ts
      analyticsRoutes.ts
    middlewares/            # Express middleware
      errorHandler.ts
      requestLogger.ts
      userContext.ts
    types/                  # TypeScript interfaces
      index.ts
    utils/                  # Helpers and constants
      constants.ts
      validation.ts
      prisma.ts
    config/
      swagger.ts            # Swagger/OpenAPI configuration
    index.ts                # Application entry point
  tests/
    integration/            # API integration tests
      slots.test.ts
      bookings.test.ts
      concurrency.test.ts
      analytics.test.ts
      queue.test.ts
      rateLimit.test.ts
    setup.ts                # Test configuration
    helpers.ts              # Test utilities
  docker-compose.yml        # Docker configuration
  package.json
  tsconfig.json
  README.md
```

---

## Environment Variables

| Variable            | Description                      | Default                   |
|---------------------|----------------------------------|---------------------------|
| DATABASE_URL        | PostgreSQL connection string     | Required                  |
| PORT                | Server port                      | 3000                      |
| NODE_ENV            | Environment mode                 | development               |
| REDIS_URL           | Redis connection string          | redis://localhost:6379    |
| USE_BOOKING_QUEUE   | Enable queue-based booking       | false                     |

---

## Agentic Workflow Write Up
Please refer to `Agentic_Workflow_Write_up.md` in the root path

---

## Core Requirements Checklist


### Slot Management

| Requirement                                           | Status | Evidence                        |
| ----------------------------------------------------- | ------ | ------------------------------- |
| Hosts can create available slots with start/end times | ✅ Done | `POST /api/slots`               |
| Hosts can view their own slots (all statuses)         | ✅ Done | `GET /api/slots/host`           |
| Hosts can cancel or delete unbooked slots             | ✅ Done | `DELETE /api/slots/:id`         |
| Slots cannot overlap for the same host                | ✅ Done | PostgreSQL exclusion constraint |


---

### Booking Flow

| Requirement                                                 | Status | Evidence                      |
| ----------------------------------------------------------- | ------ | ----------------------------- |
| Users can view available slots (filter by host, date range) | ✅ Done | `GET /api/slots` with filters |
| Users can book an available slot                            | ✅ Done | `POST /api/bookings`          |
| Users can view their own bookings                           | ✅ Done | `GET /api/bookings`           |
| Users can cancel their booking (cancellation window logic)  | ✅ Done | `DELETE /api/bookings/:id`    |

---

### Concurrency & Race Conditions (Critical)

| Requirement                        | Status | Evidence                                   |
| ---------------------------------- | ------ | ------------------------------------------ |
| Double-booking prevention          | ✅ Done | Pessimistic locking + partial unique index |
| Consistent state under concurrency | ✅ Done | `SELECT FOR UPDATE` in transaction         |
| Clear feedback on race condition   | ✅ Done | `409 Conflict` response                    |
| Concurrency approach documented    | ✅ Done | README – *Concurrency Handling*            |


---

### Constraints & Business Rules

| Requirement                                         | Status | Evidence           |
| --------------------------------------------------- | ------ | ------------------ |
| User cannot book their own slot                     | ✅ Done | `bookings.test.ts` |
| Slots in the past cannot be booked                  | ✅ Done | `bookings.test.ts` |
| Cancellation only allowed up to 1 hour before start | ✅ Done | `bookings.test.ts` |
| Max 5 active bookings per user                      | ✅ Done | `bookings.test.ts` |


---

### High-Demand Booking Flow (Critical)

| Requirement                          | Status | Evidence                       |
| ------------------------------------ | ------ | ------------------------------ |
| System remains responsive under load | ✅ Done | BullMQ queue (FCFS)            |
| Bookings processed fairly (FCFS)     | ✅ Done | Queue concurrency = 1          |
| Users receive clear feedback         | ✅ Done | `waitUntilFinished`            |
| No double-bookings under heavy load  | ✅ Done | `queue.test.ts`                |
| Approach documented                  | ✅ Done | README – *Queue-Based Booking* |


---

### Analytics Endpoint

| Requirement                  | Status | Evidence                   |
| ---------------------------- | ------ | -------------------------- |
| Analytics endpoint available | ✅ Done | `GET /api/admin/analytics` |
| Returns total bookings       | ✅ Done | `analytics.test.ts`        |
| Returns cancellation rate    | ✅ Done | `analytics.test.ts`        |
| Returns bookings per day     | ✅ Done | `analytics.test.ts`        |
| Returns top 5 busiest hosts  | ✅ Done | `analytics.test.ts`        |


---

### API Endpoints (Minimum Required)

| Endpoint               | Status |
| ---------------------- | ------ |
| `POST /slots`          | ✅ Done |
| `GET /slots`           | ✅ Done |
| `POST /bookings`       | ✅ Done |
| `GET /bookings`        | ✅ Done |
| `DELETE /bookings/:id` | ✅ Done |
| `GET /admin/analytics` | ✅ Done |


---

### Non-Functional Requirements

- [x] **Appropriate HTTP status codes**  
  _Evidence:_ `200, 201, 400, 401, 403, 404, 409, 429, 500`

| Requirement                        | Status | Evidence                                    |
| ---------------------------------- | ------ | ------------------------------------------- |
| Proper HTTP status codes           | ✅ Done | 200, 201, 400, 401, 403, 404, 409, 429, 500 |
| Clear, actionable error messages   | ✅ Done | Consistent error format                     |
| Testing strategy documented        | ✅ Done | README – *Test Cases*                       |
| Critical behavior covered by tests | ✅ Done | 6 test files                                |
| Concurrent booking test            | ✅ Done | `concurrency.test.ts`                       |
| Single command to run tests        | ✅ Done | `npm test`                                  |


---

### Deliverables


| Deliverable                        | Status | Evidence                       |
| ---------------------------------- | ------ | ------------------------------ |
| Source code in Git repository      | ✅ Done | GitHub repository              |
| Setup and run instructions         | ✅ Done | README – *Quick Start*         |
| API documentation                  | ✅ Done | README + Swagger (`/docs`)     |
| Design decisions & trade-offs      | ✅ Done | README section                 |
| Concurrency handling approach      | ✅ Done | README section                 |
| High-demand / scalability approach | ✅ Done | README – *Queue-Based Booking* |
| Testing strategy                   | ✅ Done | README – *Test Cases*          |
| Agentic workflow write-up          | ✅ Done | `Agentic_Workflow_Write_up.md` |


---

### Stretch Goals (Optional)

| Goal              | Status            |
| ----------------- | ----------------- |
| Recurring slots   | ❌ Not implemented |
| Waitlist          | ❌ Not implemented |
| Timezone handling | ❌ Not implemented |
| Rate limiting     | ✅ Done (bonus)    |

