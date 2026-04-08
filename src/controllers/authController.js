/**
 * Auth Controller
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 */

const { hashPassword, verifyPassword, generateToken, generateId } = require("../utils/auth");
const { createUser, getUserByEmail, getUserById } = require("../database/db");
const { validate, registerSchema, loginSchema } = require("../validators");
const { ok, created, badRequest, unauthorized, conflict, serverError } = require("../utils/response");

async function register(req, res) {
  const { valid, errors } = validate(registerSchema, req.body);
  if (!valid) return badRequest(res, "Validation failed", errors);

  const { name, email, password, role = "viewer" } = req.body;

  // Check uniqueness
  const existing = getUserByEmail(email.toLowerCase());
  if (existing) return conflict(res, "Email already registered");

  try {
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const user = createUser({
      id: generateId(),
      name: name.trim(),
      email: email.toLowerCase(),
      password_hash: passwordHash,
      role,
      status: "active",
      created_at: now,
      updated_at: now,
    });

    const token = generateToken({ userId: user.id, role: user.role });
    return created(res, { user, token, token_type: "Bearer", expires_in: "24h" });
  } catch (err) {
    console.error("Register error:", err);
    return serverError(res, "Failed to create user");
  }
}

async function login(req, res) {
  const { valid, errors } = validate(loginSchema, req.body);
  if (!valid) return badRequest(res, "Validation failed", errors);

  const { email, password } = req.body;
  const user = getUserByEmail(email.toLowerCase());

  // Constant-time path to prevent user enumeration
  const dummyHash = "0000000000000000:0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const isMatch = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyPassword(password, dummyHash).catch(() => false);

  if (!user || !isMatch) {
    return unauthorized(res, "Invalid email or password");
  }
  if (user.status === "inactive") {
    return unauthorized(res, "Account is inactive");
  }

  const token = generateToken({ userId: user.id, role: user.role });
  const { password_hash, ...safeUser } = user;
  return ok(res, { user: safeUser, token, token_type: "Bearer", expires_in: "24h" });
}

function logout(req, res) {
  // Token invalidation is client-side for stateless JWT; we acknowledge it
  return ok(res, { message: "Logged out successfully" });
}

function getMe(req, res) {
  return ok(res, { user: req.user });
}

module.exports = { register, login, logout, getMe };
