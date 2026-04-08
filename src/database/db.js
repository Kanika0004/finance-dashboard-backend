/**
 * Database Layer
 * Uses Node.js built-in sqlite3 bindings via the `node:sqlite` module (Node 22.5+)
 * Falls back to a lightweight in-memory store if unavailable.
 */

let db;
let usingNativeSQLite = false;

// Try Node 22.5+ native SQLite
// Use ":memory:" for tests, file-based otherwise
const dbPath = process.env.DB_PATH || (process.env.NODE_ENV === "test" ? ":memory:" : "./finance.db");
try {
  const { DatabaseSync } = require("node:sqlite");
  db = new DatabaseSync(dbPath);
  usingNativeSQLite = true;
  if (dbPath !== ":memory:") console.log("\u2705 Using Node.js native SQLite");
} catch (e) {
  if (process.env.NODE_ENV !== "test") console.log("\u26a0\ufe0f  Native SQLite unavailable, using in-memory store");
}

// ─── In-Memory Fallback ───────────────────────────────────────────────────────
const memStore = {
  users: new Map(),
  records: new Map(),
  sessions: new Map(), // token → userId
};

// ─── DB Abstraction ───────────────────────────────────────────────────────────
function initializeDatabase() {
  if (usingNativeSQLite) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS financial_records (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_records_date ON financial_records(date);
      CREATE INDEX IF NOT EXISTS idx_records_type ON financial_records(type);
      CREATE INDEX IF NOT EXISTS idx_records_category ON financial_records(category);
      CREATE INDEX IF NOT EXISTS idx_records_deleted ON financial_records(deleted_at);
    `);
    console.log("✅ Database schema initialized");
  }
}

// ─── User Queries ─────────────────────────────────────────────────────────────
function createUser(user) {
  if (usingNativeSQLite) {
    const stmt = db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(user.id, user.name, user.email, user.password_hash, user.role, user.status, user.created_at, user.updated_at);
    return getUserById(user.id);
  }
  memStore.users.set(user.id, { ...user });
  return sanitizeUser(memStore.users.get(user.id));
}

function getUserById(id) {
  if (usingNativeSQLite) {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return row ? sanitizeUser(row) : null;
  }
  const u = memStore.users.get(id);
  return u ? sanitizeUser(u) : null;
}

function getUserByEmail(email) {
  if (usingNativeSQLite) {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email) || null;
  }
  for (const u of memStore.users.values()) {
    if (u.email === email) return u;
  }
  return null;
}

function getAllUsers({ page = 1, limit = 20, status } = {}) {
  const offset = (page - 1) * limit;
  if (usingNativeSQLite) {
    let query = "SELECT * FROM users";
    const params = [];
    if (status) { query += " WHERE status = ?"; params.push(status); }
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const rows = db.prepare(query).all(...params);
    const countQuery = status
      ? db.prepare("SELECT COUNT(*) as count FROM users WHERE status = ?").get(status)
      : db.prepare("SELECT COUNT(*) as count FROM users").get();
    return { users: rows.map(sanitizeUser), total: countQuery.count, page, limit };
  }
  let users = Array.from(memStore.users.values());
  if (status) users = users.filter((u) => u.status === status);
  users.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = users.length;
  return { users: users.slice(offset, offset + limit).map(sanitizeUser), total, page, limit };
}

function updateUser(id, updates) {
  if (usingNativeSQLite) {
    const fields = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...Object.values(updates), id);
    return getUserById(id);
  }
  const user = memStore.users.get(id);
  if (!user) return null;
  Object.assign(user, updates);
  memStore.users.set(id, user);
  return sanitizeUser(user);
}

function sanitizeUser(u) {
  if (!u) return null;
  const { password_hash, ...safe } = u;
  return safe;
}

// ─── Financial Record Queries ─────────────────────────────────────────────────
function createRecord(record) {
  if (usingNativeSQLite) {
    db.prepare(
      `INSERT INTO financial_records (id, amount, type, category, date, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(record.id, record.amount, record.type, record.category, record.date, record.notes || null, record.created_by, record.created_at, record.updated_at);
    return getRecordById(record.id);
  }
  memStore.records.set(record.id, { ...record });
  return memStore.records.get(record.id);
}

function getRecordById(id) {
  if (usingNativeSQLite) {
    return db.prepare("SELECT * FROM financial_records WHERE id = ? AND deleted_at IS NULL").get(id) || null;
  }
  const r = memStore.records.get(id);
  return r && !r.deleted_at ? r : null;
}

function getRecords({ page = 1, limit = 20, type, category, dateFrom, dateTo, search } = {}) {
  const offset = (page - 1) * limit;
  if (usingNativeSQLite) {
    let where = ["deleted_at IS NULL"];
    const params = [];
    if (type) { where.push("type = ?"); params.push(type); }
    if (category) { where.push("LOWER(category) = LOWER(?)"); params.push(category); }
    if (dateFrom) { where.push("date >= ?"); params.push(dateFrom); }
    if (dateTo) { where.push("date <= ?"); params.push(dateTo); }
    if (search) { where.push("(LOWER(notes) LIKE ? OR LOWER(category) LIKE ?)"); params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`); }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = db.prepare(`SELECT * FROM financial_records ${whereClause} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const { count } = db.prepare(`SELECT COUNT(*) as count FROM financial_records ${whereClause}`).get(...params);
    return { records: rows, total: count, page, limit };
  }
  let records = Array.from(memStore.records.values()).filter((r) => !r.deleted_at);
  if (type) records = records.filter((r) => r.type === type);
  if (category) records = records.filter((r) => r.category.toLowerCase() === category.toLowerCase());
  if (dateFrom) records = records.filter((r) => r.date >= dateFrom);
  if (dateTo) records = records.filter((r) => r.date <= dateTo);
  if (search) records = records.filter((r) => (r.notes || "").toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase()));
  records.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  const total = records.length;
  return { records: records.slice(offset, offset + limit), total, page, limit };
}

function updateRecord(id, updates) {
  if (usingNativeSQLite) {
    const fields = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE financial_records SET ${fields} WHERE id = ? AND deleted_at IS NULL`).run(...Object.values(updates), id);
    return getRecordById(id);
  }
  const record = memStore.records.get(id);
  if (!record || record.deleted_at) return null;
  Object.assign(record, updates);
  return record;
}

function softDeleteRecord(id, deletedAt) {
  return updateRecord(id, { deleted_at: deletedAt, updated_at: deletedAt });
}

// ─── Analytics Queries ────────────────────────────────────────────────────────
function getDashboardSummary({ dateFrom, dateTo } = {}) {
  if (usingNativeSQLite) {
    let where = ["deleted_at IS NULL"];
    const params = [];
    if (dateFrom) { where.push("date >= ?"); params.push(dateFrom); }
    if (dateTo) { where.push("date <= ?"); params.push(dateTo); }
    const whereClause = `WHERE ${where.join(" AND ")}`;

    const totals = db.prepare(
      `SELECT type, SUM(amount) as total, COUNT(*) as count FROM financial_records ${whereClause} GROUP BY type`
    ).all(...params);

    const byCategory = db.prepare(
      `SELECT category, type, SUM(amount) as total, COUNT(*) as count FROM financial_records ${whereClause} GROUP BY category, type ORDER BY total DESC`
    ).all(...params);

    const monthly = db.prepare(
      `SELECT strftime('%Y-%m', date) as month, type, SUM(amount) as total, COUNT(*) as count
       FROM financial_records ${whereClause} GROUP BY month, type ORDER BY month DESC LIMIT 24`
    ).all(...params);

    const recent = db.prepare(
      `SELECT * FROM financial_records ${whereClause} ORDER BY date DESC, created_at DESC LIMIT 10`
    ).all(...params);

    return buildSummary(totals, byCategory, monthly, recent);
  }

  const records = Array.from(memStore.records.values()).filter((r) => {
    if (r.deleted_at) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  });

  // Compute totals
  const totalsMap = {};
  const catMap = {};
  const monthMap = {};
  for (const r of records) {
    totalsMap[r.type] = totalsMap[r.type] || { type: r.type, total: 0, count: 0 };
    totalsMap[r.type].total += r.amount;
    totalsMap[r.type].count++;
    const catKey = `${r.category}__${r.type}`;
    catMap[catKey] = catMap[catKey] || { category: r.category, type: r.type, total: 0, count: 0 };
    catMap[catKey].total += r.amount;
    catMap[catKey].count++;
    const month = r.date.slice(0, 7);
    const mKey = `${month}__${r.type}`;
    monthMap[mKey] = monthMap[mKey] || { month, type: r.type, total: 0, count: 0 };
    monthMap[mKey].total += r.amount;
    monthMap[mKey].count++;
  }
  const totals = Object.values(totalsMap);
  const byCategory = Object.values(catMap).sort((a, b) => b.total - a.total);
  const monthly = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 24);
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  return buildSummary(totals, byCategory, monthly, recent);
}

function buildSummary(totals, byCategory, monthly, recent) {
  const incomeRow = totals.find((t) => t.type === "income") || { total: 0, count: 0 };
  const expenseRow = totals.find((t) => t.type === "expense") || { total: 0, count: 0 };
  return {
    total_income: round(incomeRow.total),
    total_expenses: round(expenseRow.total),
    net_balance: round(incomeRow.total - expenseRow.total),
    transaction_count: { income: incomeRow.count, expense: expenseRow.count, total: incomeRow.count + expenseRow.count },
    by_category: byCategory.map((c) => ({ ...c, total: round(c.total) })),
    monthly_trends: monthly.map((m) => ({ ...m, total: round(m.total) })),
    recent_activity: recent,
  };
}

function round(n) {
  return Math.round((n || 0) * 100) / 100;
}

// ─── Session Store ────────────────────────────────────────────────────────────
function saveSession(token, userId, expiresAt) {
  memStore.sessions.set(token, { userId, expiresAt });
}

function getSession(token) {
  const s = memStore.sessions.get(token);
  if (!s) return null;
  if (s.expiresAt && Date.now() > s.expiresAt) {
    memStore.sessions.delete(token);
    return null;
  }
  return s;
}

function deleteSession(token) {
  memStore.sessions.delete(token);
}

module.exports = {
  initializeDatabase,
  createUser, getUserById, getUserByEmail, getAllUsers, updateUser,
  createRecord, getRecordById, getRecords, updateRecord, softDeleteRecord,
  getDashboardSummary,
  saveSession, getSession, deleteSession,
};
