#!/usr/bin/env node
'use strict';
// npm run db:cleanup
// Removes expired sessions and used/expired password reset tokens.
// Safe to run at any time; schedule with cron in production.

require('dotenv').config();
const { getDb } = require('../src/db/database');

const db = getDb();

const deletedSessions = db.prepare(
  `DELETE FROM sessions WHERE expires_at <= datetime('now')`
).run().changes;

const deletedTokens = db.prepare(
  `DELETE FROM password_reset_tokens WHERE used = 1 OR expires_at <= datetime('now')`
).run().changes;

console.log('🧹 Database cleanup complete.');
console.log(`   Expired sessions removed      : ${deletedSessions}`);
console.log(`   Expired/used reset tokens removed: ${deletedTokens}`);
