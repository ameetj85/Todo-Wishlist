#!/usr/bin/env node
'use strict';
// npm run check:env
// Validates all required environment variables before starting the server.

require('dotenv').config();

const REQUIRED = [
  { key: 'JWT_SECRET',   hint: 'A long random secret string' },
  { key: 'SMTP_HOST',    hint: 'e.g. smtp.gmail.com' },
  { key: 'SMTP_USER',    hint: 'Your SMTP username/email' },
  { key: 'SMTP_PASS',    hint: 'Your SMTP password or app password' },
  { key: 'EMAIL_FROM',   hint: 'The From address for emails' },
];

const OPTIONAL = [
  { key: 'PORT',                       default: '3000' },
  { key: 'NODE_ENV',                   default: 'development' },
  { key: 'SESSION_EXPIRY_HOURS',       default: '24' },
  { key: 'DATABASE_URL',               default: '(derived from DB_PATH when omitted)' },
  { key: 'DB_PATH',                    default: './data/auth.db' },
  { key: 'SMTP_PORT',                  default: '587' },
  { key: 'SMTP_SECURE',                default: 'false' },
  { key: 'RESET_TOKEN_EXPIRY_MINUTES', default: '60' },
  { key: 'APP_URL',                    default: 'http://localhost:3000' },
  { key: 'BCRYPT_ROUNDS',              default: '12' },
  { key: 'RATE_LIMIT_GLOBAL',          default: '100' },
  { key: 'RATE_LIMIT_AUTH',            default: '20' },
];

let hasErrors = false;

console.log('\n🔍 Checking environment variables...\n');

console.log('Required:');
for (const { key, hint } of REQUIRED) {
  if (process.env[key]) {
    console.log(`  ✅  ${key}`);
  } else {
    console.log(`  ❌  ${key}  — MISSING  (${hint})`);
    hasErrors = true;
  }
}

console.log('\nOptional (with defaults):');
for (const { key, default: def } of OPTIONAL) {
  const val = process.env[key];
  console.log(`  ${val ? '✅' : '⚙️ '}  ${key} = ${val || `(default: ${def})`}`);
}

if (hasErrors) {
  console.log('\n❌ Some required variables are missing. Copy .env.example to .env and fill them in.\n');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set.\n');
}
