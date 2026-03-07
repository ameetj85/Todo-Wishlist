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

const WISHLIST_TITLES = [
  "Mechanical keyboard",
  "Noise-canceling headphones",
  "Standing desk",
  "4K monitor",
  "Travel backpack",
  "Fitness tracker",
  "Espresso machine",
  "Bluetooth speaker",
  "Smart desk lamp",
  "Running shoes",
];

const WISHLIST_DESCRIPTIONS = [
  "Save for next quarter purchase",
  "Compare prices across vendors",
  "Need this for improving daily workflow",
  "Potential gift idea",
  "Research completed, waiting for discount",
  "Useful for home office setup",
];

const WISHLIST_URLS = [
  "https://example.com/products/keyboard",
  "https://example.com/products/headphones",
  "https://example.com/products/desk",
  "https://example.com/products/monitor",
  "https://example.com/products/backpack",
  "https://example.com/products/tracker",
  "https://example.com/products/speaker",
  "https://example.com/products/lamp",
  null,
  null,
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

function seedWishlists(db) {
  const users = db.prepare("SELECT id, name FROM users").all();
  if (users.length === 0) {
    console.log("   ⏭  Skipped wishlist seeding (no users found)");
    return;
  }

  const insertWishlist = db.prepare(`
    INSERT INTO wishlist (
      userid,
      title,
      description,
      url,
      item_image,
      price,
      priority,
      quantity,
      purchased,
      sequence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const user of users) {
    const wishlistCount = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < wishlistCount; i += 1) {
      const title = pickRandom(WISHLIST_TITLES);
      const description = `${pickRandom(WISHLIST_DESCRIPTIONS)} for ${user.name}`;
      const url = pickRandom(WISHLIST_URLS);
      const price = Number((Math.random() * 500 + 10).toFixed(2));
      const priority = Math.floor(Math.random() * 3); // 0,1,2
      const quantity = Math.floor(Math.random() * 3) + 1;
      const purchased = Math.random() < 0.2 ? 1 : 0;
      const sequence = i + 1;

      insertWishlist.run(
        user.id,
        title,
        description,
        url,
        null,
        price,
        priority,
        quantity,
        purchased,
        sequence,
      );
      inserted += 1;
    }
  }

  console.log(
    `   ✅ Inserted ${inserted} wishlist items across ${users.length} users`,
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

  console.log("\n🎁 Seeding wishlists for users...\n");
  seedWishlists(db);

  console.log("\nDone.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
