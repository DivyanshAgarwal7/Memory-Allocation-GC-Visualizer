import bcrypt from 'bcryptjs';
import { queries } from '../db.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  cookieOptions,
} from '../utils/tokens.js';

const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

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

// ── GET /api/auth/me ────────────────────────────────────────────
export function me(req, res) {
  const row = queries.findPublicById.get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: toPublicUser(row) });
}
