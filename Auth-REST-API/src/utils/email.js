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
  const resetUrl     = `${config.passwordReset.appUrl}/api/auth/reset-password?token=${resetToken}`;
  const expiryMins   = config.passwordReset.expiryMinutes;
  const transporter  = createTransporter();

  await transporter.sendMail({
    from:    `"Auth System" <${config.email.from}>`,
    to:      email,
    subject: 'Password Reset Request',
    text: `Hi ${name},\n\nReset your password here:\n${resetUrl}\n\nExpires in ${expiryMins} minutes.\n\nIf you did not request this, ignore this email.`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <h2 style="color:#4F46E5">Password Reset Request</h2>
  <p>Hi <strong>${name}</strong>,</p>
  <p>You requested a password reset. Click the button below:</p>
  <p style="text-align:center;margin:30px 0">
    <a href="${resetUrl}"
       style="background:#4F46E5;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold">
      Reset Password
    </a>
  </p>
  <p style="font-size:13px;color:#666">Or copy this link:<br><a href="${resetUrl}">${resetUrl}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">
    This link expires in <strong>${expiryMins} minutes</strong>.<br>
    If you did not request a password reset, please ignore this email.
  </p>
</body>
</html>`,
  });
}

module.exports = { sendPasswordResetEmail, createTransporter };
