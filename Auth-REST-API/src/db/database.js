const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

let db;

function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || "./data/auth.db";
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      name        TEXT NOT NULL,
      is_verified INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT UNIQUE NOT NULL,
      expires_at  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      ip_address  TEXT,
      user_agent  TEXT
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT UNIQUE NOT NULL,
      expires_at  TEXT NOT NULL,
      used        INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Todo (
      todo_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL,
      due_date     TEXT,
      created_date TEXT NOT NULL DEFAULT (date('now')),
      category     TEXT NOT NULL,
      completed    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      item_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      userid        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      description   TEXT,
      url           TEXT,
      item_image    BLOB,
      price         REAL NOT NULL DEFAULT 0.00 CHECK (price >= 0),
      priority      INTEGER NOT NULL DEFAULT 1 CHECK (priority IN (0, 1, 2)),
      quantity      INTEGER NOT NULL DEFAULT 1,
      purchased     INTEGER NOT NULL DEFAULT 0 CHECK (purchased IN (0, 1)),
      sequence      INTEGER NOT NULL DEFAULT 0,
      created_date  TEXT NOT NULL DEFAULT (date('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token    ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id  ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_reset_token       ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_todo_user_id      ON Todo(user_id);
    CREATE INDEX IF NOT EXISTS idx_todo_due_date     ON Todo(due_date);
    CREATE INDEX IF NOT EXISTS idx_wishlist_userid_sequence ON wishlist(userid, sequence);
  `);

  const todoColumns = db.prepare("PRAGMA table_info(Todo)").all();
  const hasCreatedDate = todoColumns.some(
    (column) => column.name === "created_date",
  );
  const hasAddedDate = todoColumns.some(
    (column) => column.name === "added_date",
  );

  if (!hasCreatedDate && hasAddedDate) {
    try {
      db.exec("ALTER TABLE Todo RENAME COLUMN added_date TO created_date");
    } catch {
      db.exec("ALTER TABLE Todo ADD COLUMN created_date TEXT");
      db.exec(
        "UPDATE Todo SET created_date = added_date WHERE created_date IS NULL",
      );
    }
  }

  if (!hasCreatedDate && !hasAddedDate) {
    db.exec("ALTER TABLE Todo ADD COLUMN created_date TEXT");
  }

  db.exec(
    "UPDATE Todo SET created_date = date('now') WHERE created_date IS NULL",
  );

  db.exec("DROP TRIGGER IF EXISTS trg_todo_set_added_date");
  db.exec("DROP TRIGGER IF EXISTS trg_todo_set_created_date");
  db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_todo_set_created_date
      AFTER INSERT ON Todo
      FOR EACH ROW
      WHEN NEW.created_date IS NULL
      BEGIN
        UPDATE Todo SET created_date = date('now') WHERE todo_id = NEW.todo_id;
      END;
    `);

  db.exec("DROP INDEX IF EXISTS idx_todo_user_added_date_desc");
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_todo_user_created_date_desc ON Todo(user_id, created_date DESC)",
  );

  const wishlistColumns = db.prepare("PRAGMA table_info(wishlist)").all();
  const hasWishlistPrice = wishlistColumns.some(
    (column) => column.name === "price",
  );

  if (!hasWishlistPrice) {
    db.exec(
      "ALTER TABLE wishlist ADD COLUMN price REAL NOT NULL DEFAULT 0.00 CHECK (price >= 0)",
    );
  }

  db.exec("UPDATE wishlist SET price = 0.00 WHERE price IS NULL OR price < 0");

  db.exec("DROP TRIGGER IF EXISTS trg_wishlist_set_sequence");
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_wishlist_set_sequence
    AFTER INSERT ON wishlist
    FOR EACH ROW
    WHEN NEW.sequence = 0
    BEGIN
      UPDATE wishlist
      SET sequence = (
        SELECT COALESCE(MAX(sequence), 0) + 1
        FROM wishlist
        WHERE userid = NEW.userid AND item_id <> NEW.item_id
      )
      WHERE item_id = NEW.item_id;
    END;
  `);
}

module.exports = { getDb };
