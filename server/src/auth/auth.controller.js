import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { queries } from '../db.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  cookieOptions,
} from '../utils/tokens.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';

const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function setAuthCookies(res, user) {
  res.cookie('access_token', signAccessToken(user), cookieOptions.access);
  res.cookie('refresh_token', signRefreshToken(user), cookieOptions.refresh);
}

// Only ever send these fields to the client - never password_hash, attempt counters, etc.
function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at,
  };
}

// ── POST /api/auth/signup ──────────────────────────────────────
export async function signup(req, res, next) {
  try {
    const { username, email, password } = req.validated;

    if (queries.findByEmail.get(email) || queries.findByUsername.get(username)) {
      return res.status(409).json({ error: 'An account with that email or username already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const info = queries.insertUser.run(username, email, passwordHash);
    const user = queries.findPublicById.get(info.lastInsertRowid);

    setAuthCookies(res, user);
    return res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    return next(err);
  }
}

// ── POST /api/auth/login ───────────────────────────────────────
export async function login(req, res, next) {
  try {
    const { email, password } = req.validated;
    const row = queries.findByEmail.get(email);

    // Same generic message whether the account doesn't exist or the
    // password is wrong - don't reveal which one to an attacker.
    const invalidCredentials = () =>
      res.status(401).json({ error: 'Incorrect email or password.' });

    if (!row) return invalidCredentials();

    if (row.locked_until && row.locked_until > Date.now()) {
      return res.status(423).json({
        error: 'This account is temporarily locked due to repeated failed logins. Try again later.',
      });
    }

    const passwordMatches = await bcrypt.compare(password, row.password_hash);

    if (!passwordMatches) {
      queries.recordFailedLogin.run(row.id);
      const updated = queries.findByEmail.get(email);

      if (updated.failed_attempts >= MAX_FAILED_ATTEMPTS) {
        queries.lockAccount.run(Date.now() + LOCKOUT_MS, row.id);
      }
      return invalidCredentials();
    }

    queries.resetLoginAttempts.run(row.id);
    setAuthCookies(res, row);
    return res.json({ user: toPublicUser(row) });
  } catch (err) {
    return next(err);
  }
}

// ── POST /api/auth/refresh ─────────────────────────────────────
// Issues a new short-lived access token using the httpOnly refresh cookie.
export function refresh(req, res) {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const payload = verifyRefreshToken(token);
    const row = queries.findPublicById.get(payload.sub);
    if (!row) return res.status(401).json({ error: 'Not authenticated.' });

    res.cookie('access_token', signAccessToken(row), cookieOptions.access);
    return res.json({ ok: true });
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// ── POST /api/auth/logout ──────────────────────────────────────
export function logout(req, res) {
  res.clearCookie('access_token', { path: cookieOptions.access.path });
  res.clearCookie('refresh_token', { path: cookieOptions.refresh.path });
  return res.json({ ok: true });
}

// ── POST /api/auth/forgot-password ──────────────────────────────
// Always returns the same generic message, whether or not the email
// belongs to an account - this is deliberate: a different response for
// "no such account" vs "email sent" lets an attacker enumerate which
// emails have accounts here. The frontend always shows the same thing.
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.validated;
    const row = queries.findByEmail.get(email);

    if (row) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      // Store only a hash of the token (same principle as password_hash) -
      // the raw token only ever exists in the email link and briefly in
      // memory here, never in the database.
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      queries.setResetToken.run(tokenHash, Date.now() + RESET_TOKEN_TTL_MS, row.id);

      const baseUrl = (process.env.ALLOWED_ORIGIN || 'http://localhost:4000').replace(/\/$/, '');
      const resetUrl = `${baseUrl}/reset-password.html?token=${rawToken}`;

      // Don't let a slow/failing email provider turn into a request that
      // hangs or 500s - log it and still return the generic success
      // response either way.
      sendPasswordResetEmail(row.email, resetUrl).catch((err) =>
        console.error(`[${new Date().toISOString()}] Failed to send password reset email:`, err)
      );
    }

    return res.json({
      message: "If an account exists for that email, we've sent a link to reset your password.",
    });
  } catch (err) {
    return next(err);
  }
}

// ── POST /api/auth/reset-password ───────────────────────────────
export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.validated;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const row = queries.findByResetToken.get(tokenHash, Date.now());
    if (!row) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    queries.commitNewPassword.run(passwordHash, row.id);

    return res.json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    return next(err);
  }
}

// ── GET /api/auth/me ────────────────────────────────────────────
export function me(req, res) {
  const row = queries.findPublicById.get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: toPublicUser(row) });
}
