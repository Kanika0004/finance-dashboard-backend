/**
 * Seed Script
 * Creates demo users and ~60 financial records for testing.
 * Run: SEED=true node src/app.js  OR  node src/utils/seed.js
 */

const { hashPassword, generateId } = require("./auth");
const {
  createUser, getUserByEmail,
  createRecord,
} = require("../database/db");

const USERS = [
  { name: "Alice Admin",   email: "admin@finance.com",   password: "Admin@123",   role: "admin" },
  { name: "Ana Analyst",   email: "analyst@finance.com", password: "Analyst@123", role: "analyst" },
  { name: "Victor Viewer", email: "viewer@finance.com",  password: "Viewer@123",  role: "viewer" },
];

const CATEGORIES = {
  income:  ["Salary", "Freelance", "Investments", "Rental Income", "Bonus"],
  expense: ["Rent", "Groceries", "Utilities", "Transport", "Healthcare", "Entertainment", "Software", "Office Supplies"],
};

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(daysBack = 180) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString().slice(0, 10);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  console.log("\n🌱 Seeding database...");

  // Create users
  const createdUsers = [];
  for (const u of USERS) {
    const existing = getUserByEmail(u.email);
    if (existing) {
      console.log(`  ⏭  User ${u.email} already exists`);
      createdUsers.push(existing);
      continue;
    }
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(u.password);
    const user = createUser({
      id: generateId(),
      name: u.name,
      email: u.email,
      password_hash: passwordHash,
      role: u.role,
      status: "active",
      created_at: now,
      updated_at: now,
    });
    createdUsers.push(user);
    console.log(`  ✅ Created user: ${u.email} (${u.role})`);
  }

  // Create financial records
  const adminUser = createdUsers.find((u) => u.role === "admin") || createdUsers[0];
  const analystUser = createdUsers.find((u) => u.role === "analyst") || createdUsers[0];

  let recordCount = 0;
  const recordDefs = [
    // Large regular income entries
    { type: "income", category: "Salary", amount: [8000, 12000], count: 6, creator: adminUser },
    { type: "income", category: "Freelance", amount: [500, 3000], count: 10, creator: analystUser },
    { type: "income", category: "Investments", amount: [200, 1500], count: 8, creator: adminUser },
    { type: "income", category: "Rental Income", amount: [1000, 2000], count: 4, creator: analystUser },
    { type: "income", category: "Bonus", amount: [1000, 5000], count: 3, creator: adminUser },
    // Expenses
    { type: "expense", category: "Rent", amount: [1200, 2500], count: 6, creator: adminUser },
    { type: "expense", category: "Groceries", amount: [100, 400], count: 12, creator: analystUser },
    { type: "expense", category: "Utilities", amount: [80, 250], count: 6, creator: adminUser },
    { type: "expense", category: "Transport", amount: [50, 300], count: 8, creator: analystUser },
    { type: "expense", category: "Healthcare", amount: [100, 800], count: 4, creator: adminUser },
    { type: "expense", category: "Entertainment", amount: [30, 300], count: 7, creator: analystUser },
    { type: "expense", category: "Software", amount: [10, 500], count: 5, creator: adminUser },
    { type: "expense", category: "Office Supplies", amount: [20, 200], count: 3, creator: analystUser },
  ];

  const notes = [
    "Monthly payment", "Q4 billing", "Auto-renewal", "One-time purchase",
    "Annual subscription", null, null, null, "Expense report",
  ];

  for (const def of recordDefs) {
    for (let i = 0; i < def.count; i++) {
      const now = new Date().toISOString();
      createRecord({
        id: generateId(),
        amount: randomAmount(...def.amount),
        type: def.type,
        category: def.category,
        date: randomDate(180),
        notes: pick(notes),
        created_by: def.creator.id || def.creator,
        created_at: now,
        updated_at: now,
      });
      recordCount++;
    }
  }

  console.log(`  ✅ Created ${recordCount} financial records`);
  console.log("🎉 Seed complete!\n");
}

// Allow running directly
if (require.main === module) {
  const { initializeDatabase } = require("../database/db");
  initializeDatabase();
  seed().catch(console.error);
}

module.exports = { seed };
