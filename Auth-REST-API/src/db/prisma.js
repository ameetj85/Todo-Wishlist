'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const dbPath = process.env.DB_PATH || './data/auth.db';

  // SQLite in-memory mode is not stable across pooled connections; use a temp file for tests.
  if (dbPath === ':memory:') {
    return 'file:./data/test.db';
  }

  const absoluteDbPath = path.isAbsolute(dbPath)
    ? dbPath
    : path.resolve(process.cwd(), dbPath);

  const dir = path.dirname(absoluteDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return `file:${absoluteDbPath}`;
}

function getDatabaseUrl() {
  const url = resolveDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

getDatabaseUrl();

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

module.exports = { prisma, getDatabaseUrl };
