/**
 * Middleware
 * authenticate: verifies JWT token and attaches req.user
 * authorize:    checks role hierarchy
 * rateLimit:    simple in-memory rate limiter
 */

const { verifyToken } = require("../utils/auth");
const { getUserById } = require("../database/db");
const { unauthorized, forbidden, badRequest } = require("../utils/response");

// ─── Role Hierarchy ────────────────────────────────────────────────────────────
const ROLE_LEVELS = { viewer: 1, analyst: 2, admin: 3 };

function hasRole(userRole, requiredRole) {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 0);
}

// ─── authenticate ──────────────────────────────────────────────────────────────
async function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorized(res, "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return unauthorized(res, "Invalid or expired token");
  }
  const user = getUserById(payload.userId);
  if (!user) {
    return unauthorized(res, "User no longer exists");
  }
  if (user.status === "inactive") {
    return unauthorized(res, "Account is inactive");
  }
  req.user = user;
  req.token = token;
  next();
}

// ─── authorize ─────────────────────────────────────────────────────────────────
function authorize(requiredRole) {
  return (req, res, next) => {
    if (!req.user) return unauthorized(res);
    if (!hasRole(req.user.role, requiredRole)) {
      return forbidden(res, `Requires '${requiredRole}' role or higher`);
    }
    next();
  };
}

// ─── Rate Limiter ──────────────────────────────────────────────────────────────
const rateLimitStore = new Map(); // ip → { count, resetAt }

function rateLimit({ windowMs = 60000, max = 60, message = "Too many requests" } = {}) {
  return (req, res, next) => {
    const ip = req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    let entry = rateLimitStore.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(ip, entry);
    }
    entry.count++;
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: { code: "RATE_LIMIT_EXCEEDED", message } }));
      return;
    }
    next();
  };
}

// ─── Ownership check ───────────────────────────────────────────────────────────
// Admin can modify anything; others can only modify their own records
function canModifyRecord(user, record) {
  if (user.role === "admin") return true;
  return record.created_by === user.id;
}

// ─── Pipeline runner ───────────────────────────────────────────────────────────
// Allows composing middleware arrays without express
function runMiddleware(middlewares, req, res, finalHandler) {
  let idx = 0;
  function next(err) {
    if (err) return;
    const mw = middlewares[idx++];
    if (mw) mw(req, res, next);
    else finalHandler(req, res);
  }
  next();
}

module.exports = { authenticate, authorize, rateLimit, canModifyRecord, runMiddleware, hasRole };
