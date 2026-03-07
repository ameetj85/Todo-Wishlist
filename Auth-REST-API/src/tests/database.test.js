"use strict";

process.env.DB_PATH = ":memory:";

const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { getDb } = require("../db/database");
const { resetDb } = require("./helpers");

describe("Database", () => {
  before(() => {
    getDb();
  });
  beforeEach(resetDb);

  it("creates required tables", () => {
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    assert.ok(tables.includes("users"));
    assert.ok(tables.includes("sessions"));
    assert.ok(tables.includes("password_reset_tokens"));
    assert.ok(tables.includes("Todo"));
    assert.ok(tables.includes("wishlist"));
  });

  it("enforces unique email on users", () => {
    const db = getDb();
    const id1 = require("crypto").randomUUID();
    const id2 = require("crypto").randomUUID();
    db.prepare(
      "INSERT INTO users (id, email, password, name) VALUES (?, 'a@b.com', 'hash', 'Test')",
    ).run(id1);
    assert.throws(() => {
      db.prepare(
        "INSERT INTO users (id, email, password, name) VALUES (?, 'a@b.com', 'hash', 'Test2')",
      ).run(id2);
    });
  });

  it("cascades session delete when user is deleted", () => {
    const db = getDb();
    const uid = require("crypto").randomUUID();
    const sid = require("crypto").randomUUID();
    db.prepare(
      "INSERT INTO users (id, email, password, name) VALUES (?, 'b@b.com', 'h', 'B')",
    ).run(uid);
    db.prepare(
      "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, 'tok', '2099-01-01 00:00:00')",
    ).run(sid, uid);
    db.prepare("DELETE FROM users WHERE id = ?").run(uid);
    const sess = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sid);
    assert.equal(sess, undefined);
  });

  it("cascades todo delete when user is deleted", () => {
    const db = getDb();
    const uid = require("crypto").randomUUID();
    db.prepare(
      "INSERT INTO users (id, email, password, name) VALUES (?, 'todo@b.com', 'h', 'Todo User')",
    ).run(uid);
    const result = db
      .prepare(
        "INSERT INTO Todo (user_id, name, description, due_date, category, completed) VALUES (?, 'Task', 'Desc', '2099-01-01', 'Work', 0)",
      )
      .run(uid);

    db.prepare("DELETE FROM users WHERE id = ?").run(uid);
    const todo = db
      .prepare("SELECT * FROM Todo WHERE todo_id = ?")
      .get(result.lastInsertRowid);
    assert.equal(todo, undefined);
  });

  it("sets default created_date for todos", () => {
    const db = getDb();
    const uid = require("crypto").randomUUID();
    db.prepare(
      "INSERT INTO users (id, email, password, name) VALUES (?, 'date@b.com', 'h', 'Date User')",
    ).run(uid);

    const result = db
      .prepare(
        "INSERT INTO Todo (user_id, name, description, due_date, category, completed) VALUES (?, 'Task', 'Desc', NULL, 'Work', 0)",
      )
      .run(uid);

    const todo = db
      .prepare("SELECT created_date FROM Todo WHERE todo_id = ?")
      .get(result.lastInsertRowid);

    assert.ok(todo.created_date);
    assert.match(todo.created_date, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("creates Todo index on user_id and created_date desc", () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'Todo'",
      )
      .all()
      .map((row) => row.name);

    assert.ok(indexes.includes("idx_todo_user_created_date_desc"));
  });

  it("sets wishlist defaults and auto sequence", () => {
    const db = getDb();
    const uid = require("crypto").randomUUID();

    db.prepare(
      "INSERT INTO users (id, email, password, name) VALUES (?, 'wish@b.com', 'h', 'Wish User')",
    ).run(uid);

    const first = db
      .prepare("INSERT INTO wishlist (userid, title) VALUES (?, ?)")
      .run(uid, "First item");
    const second = db
      .prepare("INSERT INTO wishlist (userid, title) VALUES (?, ?)")
      .run(uid, "Second item");

    const row1 = db
      .prepare(
        "SELECT priority, quantity, purchased, sequence, created_date FROM wishlist WHERE item_id = ?",
      )
      .get(first.lastInsertRowid);
    const row2 = db
      .prepare("SELECT sequence FROM wishlist WHERE item_id = ?")
      .get(second.lastInsertRowid);

    assert.equal(row1.priority, 1);
    assert.equal(row1.quantity, 1);
    assert.equal(row1.purchased, 0);
    assert.equal(row1.sequence, 1);
    assert.equal(row2.sequence, 2);
    assert.match(row1.created_date, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("cascades wishlist delete when user is deleted", () => {
    const db = getDb();
    const uid = require("crypto").randomUUID();

    db.prepare(
      "INSERT INTO users (id, email, password, name) VALUES (?, 'wish2@b.com', 'h', 'Wish User2')",
    ).run(uid);

    const inserted = db
      .prepare("INSERT INTO wishlist (userid, title) VALUES (?, ?)")
      .run(uid, "Cascade item");

    db.prepare("DELETE FROM users WHERE id = ?").run(uid);
    const item = db
      .prepare("SELECT * FROM wishlist WHERE item_id = ?")
      .get(inserted.lastInsertRowid);

    assert.equal(item, undefined);
  });

  it("creates wishlist index on userid and sequence", () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'wishlist'",
      )
      .all()
      .map((row) => row.name);

    assert.ok(indexes.includes("idx_wishlist_userid_sequence"));
  });
});
