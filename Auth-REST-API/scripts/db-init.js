#!/usr/bin/env node
'use strict';
// npm run db:init
// Initializes the database schema (safe to re-run — uses CREATE IF NOT EXISTS)

require('dotenv').config();
const { getDb } = require('../src/db/database');

const db = getDb();
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('✅ Database initialized successfully.');
console.log('   Tables:', tables.map(t => t.name).join(', '));
console.log('   Path  :', process.env.DB_PATH || './data/auth.db');
