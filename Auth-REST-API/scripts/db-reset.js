#!/usr/bin/env node
'use strict';
// npm run db:reset
// Drops all tables and re-initializes the schema. ALL DATA WILL BE LOST.

require('dotenv').config();
const readline = require('readline');
const path = require('path');
const fs   = require('fs');
const { getDatabaseUrl } = require('../src/db/prisma');

function resolveDbPathFromUrl() {
  const url = getDatabaseUrl();
  if (!url.startsWith('file:')) {
    throw new Error('db:reset supports SQLite file URLs only');
  }
  return url.replace(/^file:/, '');
}

function reset() {
  const dbPath = resolveDbPathFromUrl();
  // Delete the DB file; run `npm run db:init` (prisma db push) to recreate schema.
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑  Deleted existing database:', dbPath);
  }
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
