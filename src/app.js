/**
 * Finance Dashboard Backend
 * Entry point - pure Node.js (no external dependencies)
 */

const http = require("http");
const { router } = require("./router");
const { initializeDatabase } = require("./database/db");
const { seed } = require("./utils/seed");

const PORT = process.env.PORT || 8000;

// Initialize DB before starting server
initializeDatabase();

// Optionally seed demo data
if (process.env.SEED === "true") {
  seed();
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Parse body then route
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      req.body = body ? JSON.parse(body) : {};
    } catch {
      req.body = {};
    }
    router(req, res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Finance Dashboard API running on port ${PORT}`);
  console.log(`📄 Health check: /api/health`);
  console.log(`\nDefault accounts (after SEED=true):`);
  console.log(`  admin@finance.com / Admin@123`);
  console.log(`  analyst@finance.com / Analyst@123`);
  console.log(`  viewer@finance.com / Viewer@123\n`);
});

module.exports = server;
