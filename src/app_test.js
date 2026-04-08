/**
 * Test app — runs on port 3001 with a fresh in-memory store.
 */

process.env.NODE_ENV = "test";
const http = require("http");
const { router } = require("./router");
const { initializeDatabase } = require("./database/db");

initializeDatabase();

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try { req.body = body ? JSON.parse(body) : {}; }
    catch { req.body = {}; }
    router(req, res);
  });
});

server.listen(3001);
module.exports = server;
