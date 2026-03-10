'use strict';

const nodemailer = require('nodemailer');
const config = require('../config');

function createTransporter() {
  return nodemailer.createTransport({
    host:   config.email.host,
    port:   config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
}

async function sendPasswordResetEmail(email, name, resetToken) {
  const resetUrl     = `${config.passwordReset.appUrl}/reset-password?token=${resetToken}`;
  const expiryMins   = config.passwordReset.expiryMinutes;

  console.log(`Sending password reset email to ${email} with token ${resetToken}`);
  console.log(`Email Login: ${config.email.user}, Password: ${config.email.pass}`);

  const transporter = createTransporter({
    service: "Gmail",
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  const mailOptions = {
    from: config.email.from,
    to: email,
    subject: "Password Reset Request",
    text: `Hi ${name},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in ${expiryMins} minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest,\nAuth API Team`,
    html: `<p>Hi ${name},</p><p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link will expire in ${expiryMins} minutes.</p><p>If you didn't request this, please ignore this email.</p><p>Best,<br/>Auth API Team</p>`,
  };
  
  await transporter.sendMail(mailOptions);
}

module.exports = { sendPasswordResetEmail, createTransporter };
