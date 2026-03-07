'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb }  = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/email');
const config = require('../config');
const { validateSignup, validateLogin, validatePassword } = require('../validators');

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSqliteDate(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function sessionExpiry() {
  return toSqliteDate(Date.now() + config.session.expiryHours * 3_600_000);
}

function resetTokenExpiry() {
  return toSqliteDate(Date.now() + config.passwordReset.expiryMinutes * 60_000);
}

function createSession(db, userId, req) {
  const token     = uuidv4();
  const sessionId = uuidv4();
  db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, userId, token, sessionExpiry(), req.ip, req.headers['user-agent'] || null);
  return token;
}

// ─── POST /signup ─────────────────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;

  const err = validateSignup({ email, password, name });
  if (err) return res.status(400).json({ error: err });

  const db = getDb();
  const normalizedEmail = email.toLowerCase().trim();

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const hash   = await bcrypt.hash(password, config.bcrypt.saltRounds);
  const userId = uuidv4();

  db.prepare('INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)')
    .run(userId, normalizedEmail, hash, name.trim());

  const token = createSession(db, userId, req);

  return res.status(201).json({
    message:   'Account created successfully',
    token,
    expiresIn: `${config.session.expiryHours}h`,
    user: { id: userId, email: normalizedEmail, name: name.trim() },
  });
});

// ─── POST /login ──────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const err = validateLogin({ email, password });
  if (err) return res.status(400).json({ error: err });

  const db   = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

  // Always bcrypt-compare to prevent timing attacks
  const hash  = user?.password ?? '$2a$12$invalidhashfortimingpurposes000000000000000000';
  const match = await bcrypt.compare(password, hash);

  if (!user || !match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Purge this user's expired sessions
  db.prepare(`DELETE FROM sessions WHERE user_id = ? AND expires_at <= datetime('now')`).run(user.id);

  const token = createSession(db, user.id, req);

  return res.json({
    message:   'Login successful',
    token,
    expiresIn: `${config.session.expiryHours}h`,
    user: { id: user.id, email: user.email, name: user.name, isVerified: !!user.is_verified },
  });
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

router.post('/logout', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
  return res.json({ message: 'Logged out successfully' });
});

// ─── POST /logout-all ─────────────────────────────────────────────────────────

router.post('/logout-all', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  return res.json({ message: 'All sessions terminated' });
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

// ─── GET /sessions ────────────────────────────────────────────────────────────

router.get('/sessions', requireAuth, (req, res) => {
  const sessions = getDb().prepare(`
    SELECT id, created_at, expires_at, ip_address, user_agent,
           (id = ?) as is_current
    FROM   sessions
    WHERE  user_id = ? AND expires_at > datetime('now')
    ORDER  BY created_at DESC
  `).all(req.sessionId, req.user.id);

  return res.json({ sessions });
});

// ─── POST /forgot-password ────────────────────────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const db   = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

  if (user) {
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

    const resetToken = uuidv4();
    db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), user.id, resetToken, resetTokenExpiry());

    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    } catch (e) {
      console.error('[email] Failed to send reset email:', e.message);
    }
  }

  return res.json({
    message: 'If an account with that email exists, a password reset link has been sent',
  });
});

// ─── POST /reset-password ─────────────────────────────────────────────────────

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'token and password are required' });
  }

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const db = getDb();
  const record = db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE  token = ? AND used = 0 AND expires_at > datetime('now')
  `).get(token);

  if (!record) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const hash = await bcrypt.hash(password, config.bcrypt.saltRounds);

  db.transaction(() => {
    db.prepare(`UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(hash, record.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
      .run(record.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?')
      .run(record.user_id);
  })();

  return res.json({ message: 'Password reset successfully. Please log in with your new password.' });
});

module.exports = router;
