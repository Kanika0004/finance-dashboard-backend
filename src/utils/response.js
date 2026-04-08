/**
 * HTTP Response Helpers
 */

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function ok(res, data, meta = {}) {
  send(res, 200, { success: true, data, ...meta });
}

function created(res, data) {
  send(res, 201, { success: true, data });
}

function noContent(res) {
  res.writeHead(204);
  res.end();
}

function badRequest(res, message, errors = null) {
  const body = { success: false, error: { code: "BAD_REQUEST", message } };
  if (errors) body.error.details = errors;
  send(res, 400, body);
}

function unauthorized(res, message = "Authentication required") {
  send(res, 401, { success: false, error: { code: "UNAUTHORIZED", message } });
}

function forbidden(res, message = "Insufficient permissions") {
  send(res, 403, { success: false, error: { code: "FORBIDDEN", message } });
}

function notFound(res, message = "Resource not found") {
  send(res, 404, { success: false, error: { code: "NOT_FOUND", message } });
}

function conflict(res, message) {
  send(res, 409, { success: false, error: { code: "CONFLICT", message } });
}

function serverError(res, message = "Internal server error") {
  send(res, 500, { success: false, error: { code: "INTERNAL_ERROR", message } });
}

module.exports = { ok, created, noContent, badRequest, unauthorized, forbidden, notFound, conflict, serverError };
