#!/usr/bin/env node
"use strict";
// npm run db:seed
// Inserts sample users for development/testing.

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../src/db/database");
const config = require("../src/config");

const SEED_USERS = [
  { email: "admin@example.com", name: "Admin User", password: "AdminPass1" },
  { email: "alice@example.com", name: "Alice Smith", password: "AlicePass1" },
  { email: "bob@example.com", name: "Bob Jones", password: "BobPass123" },
];

const TODO_CATEGORIES = ["Work", "Personal", "Health", "Finance", "Learning"];
const TODO_NAMES = [
  "Finish report",
  "Pay utility bill",
  "Grocery shopping",
  "Team follow-up",
  "Workout session",
  "Read documentation",
  "Plan weekly tasks",
  "Book appointment",
];

const TODO_DESCRIPTIONS = [
  "Complete and review before end of day",
  "Double-check details and submit",
  "Prepare required items and confirm schedule",
  "Track progress and update status",
  "Set reminders for pending steps",
  "Close all open action items",
];

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDueDateOrNull() {
  if (Math.random() < 0.35) return null;
  const now = new Date();
  const daysAhead = Math.floor(Math.random() * 21) + 1;
  now.setDate(now.getDate() + daysAhead);
  return now.toISOString().slice(0, 10);
}

function seedTodos(db) {
  const users = db.prepare("SELECT id, name FROM users").all();
  if (users.length === 0) {
    console.log("   ⏭  Skipped todo seeding (no users found)");
    return;
  }

  const insertTodo = db.prepare(`
    INSERT INTO Todo (user_id, name, description, due_date, category, completed)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const user of users) {
    const todoCount = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < todoCount; i += 1) {
      const name = pickRandom(TODO_NAMES);
      const description = `${pickRandom(TODO_DESCRIPTIONS)} for ${user.name}`;
      const dueDate = randomDueDateOrNull();
      const category = pickRandom(TODO_CATEGORIES);
      const completed = Math.random() < 0.25 ? 1 : 0;
      insertTodo.run(user.id, name, description, dueDate, category, completed);
      inserted += 1;
    }
  }

  console.log(
    `   ✅ Inserted ${inserted} todo items across ${users.length} users`,
  );
}

async function seed() {
  const db = getDb();

  console.log("🌱 Seeding database with sample users...\n");

  for (const u of SEED_USERS) {
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(u.email);
    if (existing) {
      console.log(`   ⏭  Skipped (already exists): ${u.email}`);
      continue;
    }

    const hash = await bcrypt.hash(u.password, config.bcrypt.saltRounds);
    const id = uuidv4();
    db.prepare(
      "INSERT INTO users (id, email, password, name, is_verified) VALUES (?, ?, ?, ?, 1)",
    ).run(id, u.email, hash, u.name);

    console.log(`   ✅ Created: ${u.email}  (password: ${u.password})`);
  }

  console.log("\n📝 Seeding todos for users...\n");
  seedTodos(db);

  console.log("\nDone.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
