#!/usr/bin/env node
'use strict';
// npm run db:reset
// Drops all tables and re-initializes the schema. ALL DATA WILL BE LOST.

require('dotenv').config();
const readline = require('readline');
const path = require('path');
const fs   = require('fs');

const dbPath = process.env.DB_PATH || './data/auth.db';

function reset() {
  // Delete the DB file entirely and let getDb() recreate it
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑  Deleted existing database:', dbPath);
  }
  const { getDb } = require('../src/db/database');
  getDb();
  console.log('✅ Database reset and re-initialized.');
  console.log('   Path:', path.resolve(dbPath));
}

// Skip prompt when piped (e.g. echo y | npm run db:reset)
if (!process.stdin.isTTY) {
  reset();
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('⚠️  This will DELETE all data. Type "yes" to confirm: ', (answer) => {
  rl.close();
  if (answer.trim().toLowerCase() === 'yes') {
    reset();
  } else {
    console.log('Aborted.');
  }
});
