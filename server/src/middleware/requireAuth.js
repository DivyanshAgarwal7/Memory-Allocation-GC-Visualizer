import { verifyAccessToken } from '../utils/tokens.js';

/**
 * Requires a valid, unexpired access token cookie.
 * Attaches { id, username } to req.user on success.
 * Returns 401 (never a stack trace) on failure - frontend should
 * try POST /api/auth/refresh and retry once before redirecting to login.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired.' });
  }
}
