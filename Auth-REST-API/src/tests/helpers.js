"use strict";

const { prisma } = require("../db/prisma");

async function resetDb() {
  await prisma.user.deleteMany();
}

function getUser(email) {
  return prisma.user.findUnique({ where: { email } });
}

function getSession(token) {
  return prisma.session.findUnique({ where: { token } });
}

function getResetToken(userId) {
  return prisma.passwordResetToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  resetDb,
  getUser,
  getSession,
  getResetToken,
};
