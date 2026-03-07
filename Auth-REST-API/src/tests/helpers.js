"use strict";

const { getDb } = require("../db/database");

function resetDb() {
  const db = getDb();
  db.prepare("DELETE FROM users").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run("Todo");
}

function getUser(email) {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function getSession(token) {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
}

function getResetToken(userId) {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM password_reset_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(userId);
}

module.exports = {
  resetDb,
  getUser,
  getSession,
  getResetToken,
};
