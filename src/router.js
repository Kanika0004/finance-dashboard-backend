/**
 * Router
 * Pure Node.js URL dispatch — no express needed.
 * Pattern: { method, regex, params, middlewares[], handler }
 */

const { authenticate, authorize, rateLimit, runMiddleware } = require("./middleware");
const authCtrl = require("./controllers/authController");
const userCtrl = require("./controllers/userController");
const recordCtrl = require("./controllers/recordController");
const dashCtrl = require("./controllers/dashboardController");
const { notFound, serverError } = require("./utils/response");
const url = require("url");

// ─── Route Table ──────────────────────────────────────────────────────────────
const routes = [
  // Health
  { method: "GET", pattern: "/api/health", middlewares: [], handler: healthCheck },

  // Auth
  { method: "POST", pattern: "/api/auth/register", middlewares: [rateLimit({ max: 10, windowMs: 60000 })], handler: authCtrl.register },
  { method: "POST", pattern: "/api/auth/login",    middlewares: [rateLimit({ max: 20, windowMs: 60000 })], handler: authCtrl.login },
  { method: "POST", pattern: "/api/auth/logout",   middlewares: [authenticate], handler: authCtrl.logout },
  { method: "GET",  pattern: "/api/auth/me",       middlewares: [authenticate], handler: authCtrl.getMe },

  // Users  (admin-only except GET self)
  { method: "GET",   pattern: "/api/users",      middlewares: [authenticate, authorize("admin")], handler: userCtrl.listUsers },
  { method: "GET",   pattern: "/api/users/:id",  middlewares: [authenticate], handler: userCtrl.getUser },
  { method: "PATCH", pattern: "/api/users/:id",  middlewares: [authenticate, authorize("admin")], handler: userCtrl.updateUserProfile },

  // Financial Records
  { method: "GET",    pattern: "/api/records",      middlewares: [authenticate, authorize("viewer")],  handler: recordCtrl.listRecords },
  { method: "POST",   pattern: "/api/records",      middlewares: [authenticate, authorize("analyst")], handler: recordCtrl.createFinancialRecord },
  { method: "GET",    pattern: "/api/records/:id",  middlewares: [authenticate, authorize("viewer")],  handler: recordCtrl.getRecord },
  { method: "PUT",    pattern: "/api/records/:id",  middlewares: [authenticate, authorize("analyst")], handler: recordCtrl.updateFinancialRecord },
  { method: "DELETE", pattern: "/api/records/:id",  middlewares: [authenticate, authorize("analyst")], handler: recordCtrl.deleteFinancialRecord },

  // Dashboard (analyst+)
  { method: "GET", pattern: "/api/dashboard/summary",    middlewares: [authenticate, authorize("analyst")], handler: dashCtrl.getSummary },
  { method: "GET", pattern: "/api/dashboard/trends",     middlewares: [authenticate, authorize("analyst")], handler: dashCtrl.getWeeklyTrends },
  { method: "GET", pattern: "/api/dashboard/categories", middlewares: [authenticate, authorize("analyst")], handler: dashCtrl.getCategoryBreakdown },
];

// ─── Compile patterns to regex ────────────────────────────────────────────────
const compiled = routes.map((r) => {
  const paramNames = [];
  const regexStr = r.pattern.replace(/:([a-zA-Z]+)/g, (_, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  return { ...r, regex: new RegExp(`^${regexStr}$`), paramNames };
});

// ─── Router ───────────────────────────────────────────────────────────────────
function router(req, res) {
  const parsed = url.parse(req.url, true);
  req.path = parsed.pathname.replace(/\/$/, "") || "/";
  req.query = parsed.query;

  for (const route of compiled) {
    if (route.method !== req.method) continue;
    const match = route.regex.exec(req.path);
    if (!match) continue;

    // Extract path params
    req.params = {};
    route.paramNames.forEach((name, i) => {
      req.params[name] = match[i + 1];
    });

    // Run middleware chain → handler
    return runMiddleware(route.middlewares, req, res, (req, res) => {
      try {
        const result = route.handler(req, res);
        if (result && typeof result.catch === "function") {
          result.catch((err) => {
            console.error("Handler error:", err);
            serverError(res);
          });
        }
      } catch (err) {
        console.error("Sync handler error:", err);
        serverError(res);
      }
    });
  }

  return notFound(res, `Route ${req.method} ${req.path} not found`);
}

function healthCheck(req, res) {
  const { ok } = require("./utils/response");
  return ok(res, {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    service: "Finance Dashboard API",
  });
}

module.exports = { router };
