/**
 * Auth Utilities
 * Uses Node.js built-in `crypto` for HMAC-based JWT-compatible tokens
 * and bcrypt-style hashing (using crypto.scrypt).
 */

const crypto = require("crypto");

const SECRET = process.env.JWT_SECRET || "finance-dashboard-secret-key-change-in-prod";
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Password Hashing ──────────────────────────────────────────────────────────
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

async function verifyPassword(password, hash) {
  return new Promise((resolve, reject) => {
    const [salt, storedKey] = hash.split(":");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(crypto.timingSafeEqual(Buffer.from(storedKey, "hex"), derivedKey));
    });
  });
}

// ─── Token Generation ──────────────────────────────────────────────────────────
// Simple HS256-style JWT using built-in crypto
function generateToken(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + TOKEN_EXPIRY_MS }));
  const sig = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const expectedSig = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function base64url(str) {
  return Buffer.from(str).toString("base64url");
}

function generateId() {
  return crypto.randomUUID();
}

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken, generateId };
