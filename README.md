# Finance Dashboard Backend API

A production-quality backend for a multi-role finance dashboard system, built with **pure Node.js** - zero external runtime dependencies.

---

## 🚀 Deployment

Backend API is deployed on Railway:

🔗 https://finance-dashboard-backend-production-9c15.up.railway.app

### Health Check Endpoint
GET /api/health

Example:
https://finance-dashboard-backend-production-9c15.up.railway.app/api/health


## ⚠️ Note
The backend is hosted on Railway (free tier). In case the service is temporarily unavailable due to cold starts or DNS delays, please run the project locally.

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Runtime | Node.js v22+ | Built-in SQLite, crypto, http |
| Database | Node.js native SQLite (`node:sqlite`) | No install needed; auto-falls back to in-memory |
| Auth | HMAC-SHA256 JWT (built-in `crypto`) | No `jsonwebtoken` package required |
| Password hashing | `crypto.scrypt` | Built-in, secure, async |
| Validation | Manual schema validator | Zero deps; fully typed error messages |

---

## Quick Start

```bash
# Clone / unzip the project
cd finance-backend

# Start the API (no npm install needed!)
node src/app.js

# Start with demo data seeded
SEED=true node src/app.js

# Run all 53 tests
node src/tests/run.js
```

The server starts on **http://localhost:3000**.

---

## Demo Accounts (after seeding)

| Email | Password | Role |
|---|---|---|
| admin@finance.com | Admin@123 | Admin |
| analyst@finance.com | Analyst@123 | Analyst |
| viewer@finance.com | Viewer@123 | Viewer |

---

## Role Permissions

| Action | Viewer | Analyst | Admin |
|---|:---:|:---:|:---:|
| View records | ✅ | ✅ | ✅ |
| Create records | ❌ | ✅ | ✅ |
| Update own records | ❌ | ✅ | ✅ |
| Update any record | ❌ | ❌ | ✅ |
| Delete own records | ❌ | ✅ | ✅ |
| Delete any record | ❌ | ❌ | ✅ |
| Dashboard summaries | ❌ | ✅ | ✅ |
| List all users | ❌ | ❌ | ✅ |
| Update user roles | ❌ | ❌ | ✅ |

---

## API Reference

All responses follow this envelope:

```json
{ "success": true, "data": { ... }, "pagination": { ... } }
{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }
```

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Get JWT token |
| POST | `/api/auth/logout` | Bearer | Logout (client clears token) |
| GET  | `/api/auth/me` | Bearer | Current user profile |

**Register body:**
```json
{
  "name": "Alice Admin",
  "email": "alice@example.com",
  "password": "Secret@123",
  "role": "viewer"
}
```

**Login response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": "24h",
    "user": { "id": "...", "name": "...", "role": "admin" }
  }
}
```

---

### Financial Records

| Method | Path | Min Role | Description |
|---|---|---|---|
| GET    | `/api/records` | viewer | List records (paginated, filtered) |
| POST   | `/api/records` | analyst | Create a record |
| GET    | `/api/records/:id` | viewer | Get single record |
| PUT    | `/api/records/:id` | analyst | Update record (own or admin) |
| DELETE | `/api/records/:id` | analyst | Soft-delete (own or admin) |

**Query params for GET /api/records:**
| Param | Type | Example |
|---|---|---|
| `type` | `income` or `expense` | `?type=income` |
| `category` | string | `?category=Salary` |
| `date_from` | YYYY-MM-DD | `?date_from=2024-01-01` |
| `date_to` | YYYY-MM-DD | `?date_to=2024-12-31` |
| `search` | string | `?search=monthly` |
| `page` | integer | `?page=2` |
| `limit` | integer (max 100) | `?limit=10` |

**Create/Update body:**
```json
{
  "amount": 1500.00,
  "type": "income",
  "category": "Salary",
  "date": "2024-06-01",
  "notes": "June salary payment"
}
```

---

### Dashboard

| Method | Path | Min Role | Description |
|---|---|---|---|
| GET | `/api/dashboard/summary` | analyst | Full dashboard metrics |
| GET | `/api/dashboard/trends` | analyst | 8-week rolling trends |
| GET | `/api/dashboard/categories` | analyst | Category breakdown with % |

**GET /api/dashboard/summary** supports `?date_from=` and `?date_to=` filters.

**Summary response:**
```json
{
  "total_income": 45200.00,
  "total_expenses": 18350.50,
  "net_balance": 26849.50,
  "transaction_count": { "income": 31, "expense": 51, "total": 82 },
  "by_category": [
    { "category": "Salary", "type": "income", "total": 24000, "count": 2 }
  ],
  "monthly_trends": [
    { "month": "2024-06", "type": "income", "total": 9500, "count": 4 }
  ],
  "recent_activity": [ ... ]
}
```

---

### Users

| Method | Path | Min Role | Description |
|---|---|---|---|
| GET   | `/api/users` | admin | List all users (paginated) |
| GET   | `/api/users/:id` | self or admin | Get user profile |
| PATCH | `/api/users/:id` | admin | Update name, role, status |

**PATCH /api/users/:id body:**
```json
{
  "name": "New Name",
  "role": "analyst",
  "status": "inactive"
}
```

---

## Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid input or missing required fields |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token |
| 403 | `FORBIDDEN` | Authenticated but insufficient role |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `CONFLICT` | Email already registered |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server-side error |

---

## Project Structure

```
src/
├── app.js                  # HTTP server entry point
├── app_test.js             # Test server (port 3001)
├── router.js               # URL dispatch table
├── database/
│   └── db.js               # SQLite + in-memory store abstraction
├── controllers/
│   ├── authController.js   # Register, login, logout, me
│   ├── userController.js   # User CRUD
│   ├── recordController.js # Financial record CRUD
│   └── dashboardController.js # Analytics endpoints
├── middleware/
│   └── index.js            # authenticate, authorize, rateLimit
├── validators/
│   └── index.js            # Input validation schemas
├── utils/
│   ├── auth.js             # JWT, password hashing
│   ├── response.js         # HTTP response helpers
│   └── seed.js             # Demo data seeder
└── tests/
    └── run.js              # 53-test suite (no test framework needed)
```

---

## Assumptions & Design Decisions

1. **Zero dependencies** — The entire backend runs on Node.js 22+ with no `npm install`. This is intentional: it demonstrates understanding of what Node.js can do natively and avoids supply-chain risk.

2. **Node.js native SQLite** — Available since Node 22.5 as an experimental feature. On older Node versions the system gracefully falls back to in-memory storage, so the code always runs.

3. **Soft delete** — Records are never physically removed; a `deleted_at` timestamp is set. This preserves audit history and is reversible.

4. **Role hierarchy** — Roles are ordered (viewer < analyst < admin). The `authorize(minRole)` middleware checks `>=`, so an admin always passes an analyst gate automatically.

5. **Analyst record ownership** — Analysts can only edit/delete their own records. Admins can act on any record. This mirrors real-world access patterns.

6. **JWT implementation** — Standard HS256 structure (header.payload.signature) using `crypto.createHmac`. Token verification uses `timingSafeEqual` to prevent timing attacks.

7. **Password hashing** — Uses `crypto.scrypt` (memory-hard algorithm, OWASP-recommended). Salt is randomly generated per password.

8. **User enumeration prevention** — Login always runs the full password check regardless of whether the email exists, preventing timing-based user enumeration.

9. **Rate limiting** — Auth endpoints are rate-limited (10 register/min, 20 login/min) using an in-memory sliding window per IP.

10. **Pagination** — All list endpoints support `page` and `limit` parameters with a max limit of 100. Response includes `pagination` metadata.

---

## Running Tests

```bash
node src/tests/run.js
```

Output: `53 passed, 0 failed` covering auth, RBAC, CRUD, validation, soft delete, dashboard analytics, and edge cases.
