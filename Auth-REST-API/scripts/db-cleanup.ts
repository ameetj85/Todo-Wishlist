#!/usr/bin/env node
// npm run db:cleanup
// Removes expired sessions and used/expired password reset tokens.
// Safe to run at any time; schedule with cron in production.

import dotenv from 'dotenv';

dotenv.config();

import { prisma } from '../src/db/prisma';
import { toSqliteDate } from '../src/utils/dates';

async function main() {
  const now = toSqliteDate(Date.now());

  const deletedSessions = await prisma.session.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  const deletedTokens = await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [{ used: true }, { expiresAt: { lte: now } }],
    },
  });

  console.log('Database cleanup complete.');
  console.log(`   Expired sessions removed      : ${deletedSessions.count}`);
  console.log(`   Expired/used reset tokens removed: ${deletedTokens.count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
