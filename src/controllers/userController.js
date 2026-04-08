/**
 * User Controller
 * GET    /api/users         (admin)
 * GET    /api/users/:id     (admin or self)
 * PATCH  /api/users/:id     (admin)
 * PATCH  /api/users/:id/status (admin)
 */

const { getAllUsers, getUserById, updateUser } = require("../database/db");
const { validate, updateUserSchema } = require("../validators");
const { ok, badRequest, notFound, forbidden } = require("../utils/response");

function listUsers(req, res) {
  const { page = "1", limit = "20", status } = req.query || {};
  const result = getAllUsers({
    page: Math.max(1, parseInt(page) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
    status,
  });
  return ok(res, result.users, { pagination: { total: result.total, page: result.page, limit: result.limit, pages: Math.ceil(result.total / result.limit) } });
}

function getUser(req, res) {
  const { id } = req.params;
  // Non-admin users can only view themselves
  if (req.user.role !== "admin" && req.user.id !== id) {
    return forbidden(res, "You can only view your own profile");
  }
  const user = getUserById(id);
  if (!user) return notFound(res, "User not found");
  return ok(res, { user });
}

function updateUserProfile(req, res) {
  const { id } = req.params;
  const { valid, errors } = validate(updateUserSchema, req.body);
  if (!valid) return badRequest(res, "Validation failed", errors);

  // Prevent role escalation by non-admins
  if (req.user.role !== "admin" && req.body.role) {
    return forbidden(res, "Only admins can change roles");
  }
  // Prevent self-demotion for last admin (simplified: just disallow admin demoting self)
  if (req.user.id === id && req.body.role && req.body.role !== "admin" && req.user.role === "admin") {
    return badRequest(res, "Admins cannot demote themselves");
  }

  const existing = getUserById(id);
  if (!existing) return notFound(res, "User not found");

  const updates = {};
  if (req.body.name) updates.name = req.body.name.trim();
  if (req.body.role) updates.role = req.body.role;
  if (req.body.status) updates.status = req.body.status;
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length === 1) {
    return badRequest(res, "No valid fields to update");
  }

  const updated = updateUser(id, updates);
  return ok(res, { user: updated });
}

module.exports = { listUsers, getUser, updateUserProfile };
