'use strict';

require('dotenv').config();

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const dbPath = process.env.DB_PATH || './data/auth.db';
  if (dbPath === ':memory:') return 'file:./data/test.db';

  return dbPath.startsWith('file:') ? dbPath : `file:${dbPath}`;
}

const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    isProd: process.env.NODE_ENV === 'production',
  },

  db: {
    path: process.env.DB_PATH || './data/auth.db',
    url: resolveDatabaseUrl(),
  },

  session: {
    expiryHours: parseFloat(process.env.SESSION_EXPIRY_HOURS || '24'),
  },

  passwordReset: {
    expiryMinutes: parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES || '60', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
  },

  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  },

  rateLimit: {
    global: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_GLOBAL || '100', 10),
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_AUTH || '20', 10),
    },
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  },

  registration: {
    open: process.env.REGISTRATION_OPEN !== 'false',
  },
};

module.exports = config;
