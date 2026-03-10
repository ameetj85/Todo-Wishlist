#!/usr/bin/env node
"use strict";
// npm run db:seed
// Inserts sample users for development/testing.

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { prisma } = require("../src/db/prisma");
const { toSqliteDateOnly } = require("../src/utils/dates");
const config = require("../src/config");

const SEED_USERS = [
  { email: "admin@example.com", name: "Admin User", password: "AdminPass1" },
  { email: "alice@example.com", name: "Alice Smith", password: "AlicePass1" },
  { email: "bob@example.com", name: "Bob Jones", password: "BobPass123" },
  { email: "ameetj85@gmail.com", name: "Ameet Jayawant", password: "Welcome1*", isAdmin:true }
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

async function seedTodos() {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  if (users.length === 0) {
    console.log("   Skipped todo seeding (no users found)");
    return;
  }

  let inserted = 0;
  for (const user of users) {
    const todoCount = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < todoCount; i += 1) {
      const name = pickRandom(TODO_NAMES);
      const description = `${pickRandom(TODO_DESCRIPTIONS)} for ${user.name}`;
      const dueDate = randomDueDateOrNull();
      const category = pickRandom(TODO_CATEGORIES);
      const completed = Math.random() < 0.25;

      await prisma.todo.create({
        data: {
          userId: user.id,
          name,
          description,
          dueDate,
          category,
          completed,
          createdDate: toSqliteDateOnly(Date.now()),
        },
      });
      inserted += 1;
    }
  }

  console.log(`   Inserted ${inserted} todo items across ${users.length} users`);
}

async function seedWishlists() {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  if (users.length === 0) {
    console.log("   Skipped wishlist seeding (no users found)");
    return;
  }

  let inserted = 0;
  for (const user of users) {
    const wishlistCount = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < wishlistCount; i += 1) {
      const title = pickRandom(WISHLIST_TITLES);
      const description = `${pickRandom(WISHLIST_DESCRIPTIONS)} for ${user.name}`;
      const url = pickRandom(WISHLIST_URLS);
      const price = Number((Math.random() * 500 + 10).toFixed(2));
      const priority = Math.floor(Math.random() * 3);
      const quantity = Math.floor(Math.random() * 3) + 1;
      const purchased = Math.random() < 0.2;
      const sequence = i + 1;

      await prisma.wishlistItem.create({
        data: {
          userId: user.id,
          title,
          description,
          url,
          itemImage: null,
          price,
          priority,
          quantity,
          purchased,
          sequence,
          createdDate: toSqliteDateOnly(Date.now()),
        },
      });
      inserted += 1;
    }
  }

  console.log(`   Inserted ${inserted} wishlist items across ${users.length} users`);
}

async function seed() {
  console.log("Seeding database with sample users...\n");

  for (const u of SEED_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
      select: { id: true },
    });

    if (existing) {
      console.log(`   Skipped (already exists): ${u.email}`);
      continue;
    }

    const hash = await bcrypt.hash(u.password, config.bcrypt.saltRounds);
    const id = uuidv4();

    await prisma.user.create({
      data: {
        id,
        email: u.email,
        password: hash,
        name: u.name,
        isVerified: true,
      },
    });

    console.log(`   Created: ${u.email}  (password: ${u.password})`);
  }

  console.log("\nSeeding todos for users...\n");
  await seedTodos();

  console.log("\nSeeding wishlists for users...\n");
  await seedWishlists();

  console.log("\nDone.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
