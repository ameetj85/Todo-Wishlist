'use strict';

const { prisma } = require('../db/prisma');
const { toSqliteDate } = require('../utils/dates');

async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const session = await prisma.session.findFirst({
    where: {
      token,
      expiresAt: { gt: toSqliteDate(Date.now()) },
    },
    include: { user: true },
  });

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  req.user      = { id: session.user.id, email: session.user.email, name: session.user.name, isVerified: !!session.user.isVerified };
  req.sessionId = session.id;
  req.token     = token;

  next();
}

module.exports = { requireAuth };
