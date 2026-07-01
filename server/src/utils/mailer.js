import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

/**
 * Sends the password reset email, or - if no SMTP_* env vars are set -
 * logs the reset link to the console instead. This is what makes the
 * feature testable on a local machine with no email provider account:
 * the link still appears, just in the terminal instead of an inbox.
 * Wire in real SMTP_HOST/SMTP_USER/SMTP_PASS (see .env.example) to send
 * actual emails - no code change needed, this function picks it up
 * automatically.
 */
export async function sendPasswordResetEmail(toEmail, resetUrl) {
  if (!smtpConfigured) {
    console.log(
      `\n[DEV] No SMTP configured - password reset link for ${toEmail}:\n  ${resetUrl}\n` +
        `  (Set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to send a real email instead.)\n`
    );
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: toEmail,
    subject: 'Reset your MEM SIM password',
    text: `Reset your password by visiting this link (expires in 30 minutes):\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>Reset your password by clicking the link below (expires in 30 minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });
}
