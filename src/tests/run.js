/**
 * Test Suite
 * Pure Node.js tests — no jest/supertest needed.
 * Run: node src/tests/run.js
 *
 * Tests cover: auth, RBAC, CRUD, validation, dashboard, edge cases.
 */

process.env.NODE_ENV = "test";
const http = require("http");
const { initializeDatabase } = require("../database/db");
const { seed } = require("../utils/seed");

// ─── Tiny HTTP Client ──────────────────────────────────────────────────────────
const BASE = "http://localhost:3001";

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "localhost",
      port: 3001,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Tiny Assertion Library ────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

function assertEq(actual, expected, label) {
  assert(actual === expected, `${label} (expected ${expected}, got ${actual})`);
}

// ─── Test Runner ──────────────────────────────────────────────────────────────
const server = require("../app_test");

async function runTests() {
  console.log("\n🧪 Running Finance Dashboard API Tests\n");
  let adminToken, analystToken, viewerToken, adminId;
  let recordId;

  // ── Auth Tests ────────────────────────────────────────────────────────────
  console.log("📌 Auth: Register & Login");

  {
    const r = await request("GET", "/api/health");
    assertEq(r.status, 200, "GET /api/health returns 200");
    assert(r.body.data?.status === "healthy", "Health check returns healthy status");
  }

  {
    const r = await request("POST", "/api/auth/register", {
      name: "Test Admin", email: "testadmin@test.com", password: "Secret@123", role: "admin",
    });
    assertEq(r.status, 201, "Register admin returns 201");
    assert(r.body.data?.token, "Register returns token");
    adminToken = r.body.data?.token;
    adminId = r.body.data?.user?.id;
  }

  {
    const r = await request("POST", "/api/auth/register", {
      name: "Test Analyst", email: "testanalyst@test.com", password: "Secret@123", role: "analyst",
    });
    assertEq(r.status, 201, "Register analyst returns 201");
    analystToken = r.body.data?.token;
  }

  {
    const r = await request("POST", "/api/auth/register", {
      name: "Test Viewer", email: "testviewer@test.com", password: "Secret@123", role: "viewer",
    });
    assertEq(r.status, 201, "Register viewer returns 201");
    viewerToken = r.body.data?.token;
  }

  {
    // Duplicate registration
    const r = await request("POST", "/api/auth/register", {
      name: "Dup", email: "testadmin@test.com", password: "Secret@123",
    });
    assertEq(r.status, 409, "Duplicate email returns 409");
  }

  {
    const r = await request("POST", "/api/auth/register", {
      name: "X", email: "bad-email", password: "123",
    });
    assertEq(r.status, 400, "Invalid register input returns 400");
    assert(Array.isArray(r.body.error?.details), "Returns validation error details");
  }

  {
    const r = await request("POST", "/api/auth/login", { email: "testadmin@test.com", password: "Secret@123" });
    assertEq(r.status, 200, "Login with valid creds returns 200");
    assert(r.body.data?.token, "Login returns token");
  }

  {
    const r = await request("POST", "/api/auth/login", { email: "testadmin@test.com", password: "wrongpass" });
    assertEq(r.status, 401, "Login with wrong password returns 401");
  }

  {
    const r = await request("GET", "/api/auth/me", null, adminToken);
    assertEq(r.status, 200, "GET /auth/me returns 200");
    assertEq(r.body.data?.user?.role, "admin", "Me returns correct role");
  }

  {
    const r = await request("GET", "/api/auth/me");
    assertEq(r.status, 401, "GET /auth/me without token returns 401");
  }

  // ── RBAC: User Management ─────────────────────────────────────────────────
  console.log("\n📌 RBAC: User Management");

  {
    const r = await request("GET", "/api/users", null, adminToken);
    assertEq(r.status, 200, "Admin can list users");
    assert(Array.isArray(r.body.data), "Users list is array");
  }

  {
    const r = await request("GET", "/api/users", null, viewerToken);
    assertEq(r.status, 403, "Viewer cannot list users");
  }

  {
    const r = await request("GET", "/api/users", null, analystToken);
    assertEq(r.status, 403, "Analyst cannot list users");
  }

  {
    const r = await request("GET", `/api/users/${adminId}`, null, adminToken);
    assertEq(r.status, 200, "Admin can view any user");
  }

  // ── Financial Records ─────────────────────────────────────────────────────
  console.log("\n📌 Records: CRUD");

  {
    const r = await request("POST", "/api/records", {
      amount: 1500.00, type: "income", category: "Salary",
      date: "2024-06-15", notes: "June salary",
    }, analystToken);
    assertEq(r.status, 201, "Analyst can create record");
    assert(r.body.data?.record?.id, "Create returns record with id");
    recordId = r.body.data?.record?.id;
  }

  {
    const r = await request("POST", "/api/records", {
      amount: -100, type: "income", category: "Test", date: "2024-01-01",
    }, analystToken);
    assertEq(r.status, 400, "Negative amount returns 400");
  }

  {
    const r = await request("POST", "/api/records", {
      amount: 100, type: "income", category: "Test", date: "not-a-date",
    }, analystToken);
    assertEq(r.status, 400, "Invalid date format returns 400");
  }

  {
    const r = await request("POST", "/api/records", {
      amount: 100, type: "invalid_type", category: "Test", date: "2024-01-01",
    }, analystToken);
    assertEq(r.status, 400, "Invalid type returns 400");
  }

  {
    const r = await request("POST", "/api/records", {
      amount: 100, type: "expense", category: "Groceries", date: "2024-01-01",
    }, viewerToken);
    assertEq(r.status, 403, "Viewer cannot create record");
  }

  {
    const r = await request("GET", "/api/records", null, viewerToken);
    assertEq(r.status, 200, "Viewer can list records");
    assert(typeof r.body.data !== "undefined", "Returns records");
  }

  {
    const r = await request("GET", `/api/records/${recordId}`, null, viewerToken);
    assertEq(r.status, 200, "Viewer can get specific record");
  }

  {
    const r = await request("PUT", `/api/records/${recordId}`, { amount: 2000, notes: "Updated" }, analystToken);
    assertEq(r.status, 200, "Analyst can update own record");
    assertEq(r.body.data?.record?.amount, 2000, "Amount updated correctly");
  }

  {
    const r = await request("PUT", `/api/records/${recordId}`, { amount: 999 }, viewerToken);
    assertEq(r.status, 403, "Viewer cannot update record");
  }

  {
    const r = await request("GET", "/api/records?type=income", null, analystToken);
    assertEq(r.status, 200, "Filter by type=income works");
  }

  {
    const r = await request("GET", "/api/records?page=1&limit=5", null, analystToken);
    assertEq(r.status, 200, "Pagination params work");
    assert(r.body.pagination, "Pagination metadata returned");
  }

  {
    const r = await request("DELETE", `/api/records/${recordId}`, null, analystToken);
    assertEq(r.status, 200, "Analyst can delete own record");
  }

  {
    const r = await request("GET", `/api/records/${recordId}`, null, adminToken);
    assertEq(r.status, 404, "Soft-deleted record returns 404");
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  console.log("\n📌 Dashboard Analytics");

  {
    const r = await request("GET", "/api/dashboard/summary", null, analystToken);
    assertEq(r.status, 200, "Analyst can access dashboard summary");
    assert(typeof r.body.data?.net_balance === "number", "Summary has net_balance");
    assert(typeof r.body.data?.total_income === "number", "Summary has total_income");
    assert(typeof r.body.data?.total_expenses === "number", "Summary has total_expenses");
    assert(Array.isArray(r.body.data?.by_category), "Summary has by_category array");
    assert(Array.isArray(r.body.data?.monthly_trends), "Summary has monthly_trends");
    assert(Array.isArray(r.body.data?.recent_activity), "Summary has recent_activity");
  }

  {
    const r = await request("GET", "/api/dashboard/summary", null, viewerToken);
    assertEq(r.status, 403, "Viewer cannot access dashboard summary");
  }

  {
    const r = await request("GET", "/api/dashboard/summary?date_from=2024-01-01&date_to=2024-12-31", null, adminToken);
    assertEq(r.status, 200, "Dashboard summary with date filter works");
  }

  {
    const r = await request("GET", "/api/dashboard/summary?date_from=bad-date", null, adminToken);
    assertEq(r.status, 400, "Invalid date_from returns 400");
  }

  {
    const r = await request("GET", "/api/dashboard/trends", null, analystToken);
    assertEq(r.status, 200, "Weekly trends endpoint works");
    assert(Array.isArray(r.body.data?.weekly_trends), "Returns weekly_trends array");
  }

  {
    const r = await request("GET", "/api/dashboard/categories", null, adminToken);
    assertEq(r.status, 200, "Category breakdown endpoint works");
    assert(Array.isArray(r.body.data?.categories), "Returns categories array");
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  console.log("\n📌 Edge Cases");
  {
    const r = await request("GET", "/api/nonexistent", null, adminToken);
    assertEq(r.status, 404, "Unknown route returns 404");
  }

  {
    const r = await request("GET", `/api/records/nonexistent-id`, null, adminToken);
    assertEq(r.status, 404, "Nonexistent record id returns 404");
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  if (failed === 0) console.log("🎉 All tests passed!\n");
  else console.log(`⚠️  ${failed} test(s) failed\n`);

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

// Start server on port 3001 and run tests
setTimeout(runTests, 300);
