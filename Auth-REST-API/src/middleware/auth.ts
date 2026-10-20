import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { toSqliteDate } from '../utils/dates';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isVerified: boolean;
  isAdmin: boolean;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

  req.user      = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isVerified: !!session.user.isVerified,
    isAdmin: !!session.user.isAdmin,
  };
  req.sessionId = session.id;
  req.token     = token;

  next();
}
