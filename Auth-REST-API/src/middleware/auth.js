'use strict';

const { getDb } = require('../db/database');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const db = getDb();
  const session = db.prepare(`
    SELECT s.id as session_id, s.expires_at,
           u.id, u.email, u.name, u.is_verified
    FROM   sessions s
    JOIN   users    u ON s.user_id = u.id
    WHERE  s.token = ? AND s.expires_at > datetime('now')
  `).get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  req.user      = { id: session.id, email: session.email, name: session.name, isVerified: !!session.is_verified };
  req.sessionId = session.session_id;
  req.token     = token;

  next();
}

module.exports = { requireAuth };
