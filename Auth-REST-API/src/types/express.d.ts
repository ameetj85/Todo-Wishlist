import type { AuthUser } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth; only read on routes mounted behind it.
      user: AuthUser;
      sessionId: string;
      token: string;
    }
  }
}

export {};
