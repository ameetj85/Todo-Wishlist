'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../utils/email');
const { toSqliteDate } = require('../utils/dates');
const config = require('../config');
const { validateSignup, validateLogin, validatePassword } = require('../validators');

const router = express.Router();

function sessionExpiry() {
  return toSqliteDate(Date.now() + config.session.expiryHours * 3_600_000);
}

function resetTokenExpiry() {
  return toSqliteDate(Date.now() + config.passwordReset.expiryMinutes * 60_000);
}

async function createSession(userId, req) {
  const token = uuidv4();
  const sessionId = uuidv4();

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      token,
      expiresAt: sessionExpiry(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
    },
  });

  return token;
}

router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;

  const err = validateSignup({ email, password, name });
  if (err) return res.status(400).json({ error: err });

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const hash = await bcrypt.hash(password, config.bcrypt.saltRounds);
  const userId = uuidv4();

  await prisma.user.create({
    data: {
      id: userId,
      email: normalizedEmail,
      password: hash,
      name: name.trim(),
    },
  });

  // Generate verification token (re-using password_reset_tokens table)
  const verificationToken = uuidv4();
  await prisma.passwordResetToken.create({
    data: {
      id: uuidv4(),
      userId: userId,
      token: verificationToken,
      expiresAt: resetTokenExpiry(),
    },
  });

  // Send verification email
  try {
    await sendVerificationEmail(normalizedEmail, name.trim(), verificationToken);
    console.log(`Verification email sent to ${normalizedEmail}`);
  } catch (e) {
    console.error('[email] Failed to send verification email:', e.message);
    // Still consider signup successful even if email fails
  }

  return res.status(201).json({
    message: 'Account created successfully. Please check your email to verify your account.',
    requiresVerification: true,
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const err = validateLogin({ email, password });
  if (err) return res.status(400).json({ error: err });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  const hash = user?.password ?? '$2a$12$invalidhashfortimingpurposes000000000000000000';
  const match = await bcrypt.compare(password, hash);

  if (!user || !match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.isVerified) {
    return res.status(403).json({
      error: 'Your account is not verified yet. Please check your email for verification steps before signing in.',
      code: 'UNVERIFIED_ACCOUNT',
    });
  }

  await prisma.session.deleteMany({
    where: {
      userId: user.id,
      expiresAt: { lte: toSqliteDate(Date.now()) },
    },
  });

  const token = await createSession(user.id, req);

  return res.json({
    message: 'Login successful',
    token,
    expiresIn: `${config.session.expiryHours}h`,
    user: { id: user.id, email: user.email, name: user.name, isVerified: !!user.isVerified },
  });
});

router.post('/logout', requireAuth, async (req, res) => {
  await prisma.session.deleteMany({ where: { id: req.sessionId } });
  return res.json({ message: 'Logged out successfully' });
});

router.post('/logout-all', requireAuth, async (req, res) => {
  await prisma.session.deleteMany({ where: { userId: req.user.id } });
  return res.json({ message: 'All sessions terminated' });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

router.get('/sessions', requireAuth, async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: {
      userId: req.user.id,
      expiresAt: { gt: toSqliteDate(Date.now()) },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      ipAddress: true,
      userAgent: true,
    },
  });

  return res.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      created_at: session.createdAt,
      expires_at: session.expiresAt,
      ip_address: session.ipAddress,
      user_agent: session.userAgent,
      is_current: session.id === req.sessionId ? 1 : 0,
    })),
  });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (user) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const resetToken = uuidv4();
    await prisma.passwordResetToken.create({
      data: {
        id: uuidv4(),
        userId: user.id,
        token: resetToken,
        expiresAt: resetTokenExpiry(),
      },
    });

    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
      console.log(`Password reset email sent to ${user.email}`);
    } catch (e) {
      console.error('[email] Failed to send reset email:', e.message);
    }
  }

  return res.json({
    message: 'If an account with that email exists, a password reset link has been sent',
  });
});

// Compatibility route: old reset links may target the API endpoint via GET.
router.get('/reset-password', async (req, res) => {
  const token = String(req.query.token ?? '').trim();
  const appUrl = String(config.passwordReset.appUrl ?? '').replace(/\/$/, '');

  if (!appUrl) {
    return res.status(500).json({ error: 'Missing APP_URL configuration' });
  }

  if (!token) {
    return res.redirect(`${appUrl}/reset-password`);
  }

  return res.redirect(`${appUrl}/reset-password?token=${encodeURIComponent(token)}`);
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'token and password are required' });
  }

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      token,
      used: false,
      expiresAt: { gt: toSqliteDate(Date.now()) },
    },
  });

  if (!record) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const hash = await bcrypt.hash(password, config.bcrypt.saltRounds);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        password: hash,
        updatedAt: toSqliteDate(Date.now()),
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
    prisma.session.deleteMany({
      where: { userId: record.userId },
    }),
  ]);

  return res.json({ message: 'Password reset successfully. Please log in with your new password.' });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' });
  }

  const pwErr = validatePassword(new_password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, password: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const currentMatches = await bcrypt.compare(current_password, user.password);

  if (!currentMatches) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const isSamePassword = await bcrypt.compare(new_password, user.password);
  if (isSamePassword) {
    return res.status(400).json({ error: 'New password must be different from current password' });
  }

  const hash = await bcrypt.hash(new_password, config.bcrypt.saltRounds);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hash,
        updatedAt: toSqliteDate(Date.now()),
      },
    }),
    prisma.session.deleteMany({
      where: {
        userId: req.user.id,
        id: { not: req.sessionId },
      },
    }),
  ]);

  return res.json({ message: 'Password changed successfully' });
});

// Compatibility route: old verification links may target the API endpoint via GET.
router.get('/verify-email', async (req, res) => {
  const token = String(req.query.token ?? '').trim();
  const appUrl = String(config.passwordReset.appUrl ?? '').replace(/\/$/, '');

  if (!appUrl) {
    return res.status(500).json({ error: 'Missing APP_URL configuration' });
  }

  if (!token) {
    return res.redirect(`${appUrl}/verify-email`);
  }

  return res.redirect(`${appUrl}/verify-email?token=${encodeURIComponent(token)}`);
});

router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      token,
      used: false,
      expiresAt: { gt: toSqliteDate(Date.now()) },
    },
  });

  if (!record) {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }

  // Mark token as used and set user as verified
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        isVerified: true,
        updatedAt: toSqliteDate(Date.now()),
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    }),
  ]);

  return res.json({ message: 'Email verified successfully. You can now log in.' });
});

module.exports = router;
