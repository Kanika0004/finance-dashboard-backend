# Engineering Walkthrough: What I Built, How, and Why

## Overview

In this project, I built a **Finance Dashboard Backend** from scratch and made deliberate engineering decisions at every step. This walkthrough explains what I built, how I implemented it, and why I chose each approach — including the tradeoffs and what I would change in a real production environment.

---

## 1. The Core Decision: Zero External Dependencies

### What I did

I built the entire backend using **Node.js 22+** with **zero npm packages**. I did not use Express, jsonwebtoken, bcrypt, or any validation libraries.

### Why I did it

**To prove actual understanding.**
Instead of relying on libraries, I wanted to demonstrate that I understand what happens underneath them. So I implemented:
- My own HTTP router
- JWT authentication
- Password hashing
- Input validation

This ensures I'm not just using APIs — I understand the internals.

**Because Node.js 22 is powerful enough.**
Node now provides:
- `node:sqlite` for database
- `crypto.scrypt` for hashing
- `crypto.randomUUID()` for IDs
- `crypto.timingSafeEqual()` for secure comparisons
- Built-in `http` module

So there's no real limitation for a backend like this.

**For better security posture.**
Every dependency increases attack surface. Starting from zero and adding only what's necessary is a more secure mindset.

### Tradeoff

In a real production system, I would use:
- Express or Fastify (for stability and ecosystem)
- A proven JWT library

This approach is for demonstrating depth, not replacing industry tools.

---

## 2. Architecture: Layered Separation of Concerns

### What I built

```
HTTP Layer        (app.js + router.js)
       ↓
Middleware Layer  (authenticate → authorize → rateLimit)
       ↓
Controller Layer
       ↓
Data Access Layer (db.js)
       ↓
Database
```

### Why I designed it this way

I separated responsibilities so each layer does exactly one job:

| Layer | Responsibility |
|---|---|
| Router | Maps routes to handlers |
| Middleware | Handles cross-cutting concerns (auth, rate limiting) |
| Controllers | Manages request flow (validate → process → respond) |
| Database layer | Contains all queries |
| Utils | Reusable pure functions |

This ensures:
- Changes in one layer don't break others
- Code is easier to test and maintain
- Logic stays clean and modular

### Middleware Pipeline

Since I wasn't using Express, I implemented my own middleware chaining system using a `next()` pattern. This allowed me to:
- Compose middleware cleanly
- Short-circuit requests (e.g., unauthorized access)
- Replicate how real frameworks work internally

---

## 3. Authentication: Custom JWT + Secure Password Hashing

### What I did

I implemented JWT authentication manually using **HS256** (HMAC-SHA256).

The process:
1. Create token as `header.payload.signature`
2. Sign using `crypto.createHmac`
3. Verify by recomputing the signature
4. Use `timingSafeEqual` to prevent timing attacks
5. Validate expiration (`exp`)

### Why I chose this approach

**HS256 over RS256**
Since this is a single backend service, symmetric encryption is simpler and sufficient. As long as the secret is safe, it's secure.

**Password Hashing**
I used `crypto.scrypt` with:
- Random salt (16 bytes)
- Stored as `salt:hash`

Why:
- `scrypt` is memory-hard → resistant to brute-force attacks
- Prevents identical passwords from producing the same hash
- Protects against user enumeration by always running the hash comparison

---

## 4. Role-Based Access Control (RBAC)

### What I implemented

I created a strict role hierarchy:

```
viewer  (level 1)
  ↓
analyst (level 2)
  ↓
admin   (level 3)
```

Authorization checks use **role levels** instead of explicit role matching.

### Why

This simplifies logic:
- Higher roles automatically inherit lower permissions
- No need to define multiple allowed roles per route

### Ownership Logic

I added a second layer of control:
- Analysts can only modify their **own** records
- Admins can modify **everything**

Role-based access alone is not enough — ownership checks are critical for data protection.

### Extra Safety

I prevented admins from demoting themselves to avoid accidental system lockout.

---

## 5. Data Modeling

### What I did

I designed two main tables: **Users** and **Financial Records**.

### Why these choices

**Text-based timestamps (ISO 8601)**
- Works naturally with SQLite
- Strings are sortable and queryable without conversion

**Soft deletes (`deleted_at`)**
- Records are never permanently deleted
- Preserves full audit history
- A hard requirement in any real financial system

**Indexes on key fields**
- Indexed: `date`, `type`, `category`, `deleted_at`
- Improves query performance significantly at scale

---

## 6. Dashboard Analytics Design

### What I did

I implemented analytics directly in SQL using `SUM`, `COUNT`, `GROUP BY`, and `strftime`.

### Why

Databases are optimized for aggregation. Using SQL is faster, more scalable, and more memory-efficient than iterating application-layer arrays.

### Features implemented
- Total income and expenses
- Net balance
- Category-wise breakdown with percentages
- Monthly trends
- Recent transactions

### Tradeoff

For weekly trends, I used multiple sequential queries. In production, I would replace this with SQL window functions or precomputed materialized views.

---

## 7. Validation

### What I did

I created a **schema-based validation system**. Instead of writing multiple `if` statements, I defined rules declaratively as data.

### Why
- Easier to extend — adding a field means one line in the schema
- Cleaner, self-documenting code
- Returns **all errors at once** (better developer and user experience)

---

## 8. Input Sanitization

### What I handled

| Input | Treatment |
|---|---|
| Emails | Lowercased before storage and lookup |
| Strings (name, notes, category) | `.trim()`'d on write |
| Amount | `parseFloat` + rounded to 2 decimal places |
| Dates | Validated beyond regex — checked as real calendar dates |

### Why

Prevents invalid data, inconsistent storage, and hard-to-trace edge-case bugs.

---

## 9. Rate Limiting

### What I did

Per-IP rate limiting using a sliding window in memory:
- `POST /auth/register` → 10 requests / minute
- `POST /auth/login` → 20 requests / minute

Responses include standard headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.

### Why

Protects against brute-force attacks and abuse of authentication endpoints.

### Tradeoff

Currently uses in-process `Map` storage. In production, I would use **Redis** for rate limiting that works across multiple server instances.

---

## 10. Error Handling

### What I did

I standardized all API responses with a consistent envelope:

```json
{
  "success": true,
  "data": { "..." : "..." }
}
```

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Requires 'analyst' role or higher",
    "details": []
  }
}
```

### Why
- Predictable, uniform client-side handling
- `code` is machine-readable; `message` is human-readable
- Async errors are caught at the pipeline level — the server never crashes on an unhandled exception

---

## 11. In-Memory Fallback

### What I did

If `node:sqlite` is unavailable (Node < 22.5), the system transparently switches to an in-memory database backed by JavaScript `Map` objects. Both paths implement the exact same interface.

### Why

This follows the **adapter pattern** — controllers never know which storage backend is active. The system stays functional in all environments without code changes.

---

## 12. Testing Strategy

### What I did

I built a full integration test suite using only Node's native `http` module — no Jest, no Supertest.

### Why
- Zero external dependencies, consistent with the project philosophy
- Tests real HTTP endpoints end-to-end, not mocked internals
- Validates the full system behaviour in one pass

### Coverage — 53 tests across:
- Authentication flows (register, login, token validation)
- Role-based access (every forbidden access pattern)
- Full CRUD lifecycle for financial records
- Input validation errors (invalid types, negative amounts, bad dates)
- Soft delete (record disappears from GET after DELETE)
- Dashboard data shape and numeric correctness
- Edge cases (unknown routes, nonexistent IDs)

Integration testing gives higher confidence than unit tests alone for a backend like this.

---

## What I Would Change in Production

| Area | Current | Production |
|---|---|---|
| Framework | Custom router | Express or Fastify |
| Database | SQLite | PostgreSQL |
| JWT | Custom HS256 | `jsonwebtoken` library |
| Rate limiting | In-memory Map | Redis-backed |
| Password policy | Min 6 chars | Strength enforcement + history |
| Token refresh | Not implemented | Refresh token rotation |
| Logging | `console.log` | Structured JSON (e.g. Pino) |
| Monitoring | None | OpenTelemetry + tracing |
| DB migrations | DDL in code | Dedicated migration tool |
| Config | Hardcoded defaults | 12-factor env vars + secrets manager |
| Testing | Custom runner | Jest + Supertest |
| Deployment | Manual | Docker + CI/CD pipeline |

---

## Summary

Through this project, I demonstrated:

- **Backend fundamentals** by building every layer — routing, auth, validation, and storage — from scratch
- **Clean architecture** with strict separation of concerns across HTTP, middleware, controller, and data layers
- **Secure authentication** using HS256 JWT with timing-safe verification and memory-hard password hashing
- **Practical RBAC** with a role hierarchy and record-level ownership enforcement
- **Efficient data modeling** with proper indexing, soft deletes, and SQL-based aggregation
- **Robust validation** that returns all errors at once with clear field-level messages
- **Full integration testing** with 53 passing tests and no external test framework

This project focuses on **depth of understanding, correctness, and system design thinking** — not assembling libraries.
