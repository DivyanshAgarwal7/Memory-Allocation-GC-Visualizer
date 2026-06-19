import jwt from 'jsonwebtoken';

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL  = process.env.ACCESS_TOKEN_TTL  || '15m';
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL || '7d';

// Fail loudly on startup rather than silently signing tokens with a weak/missing secret.
if (!ACCESS_SECRET || ACCESS_SECRET.length < 32) {
  throw new Error('JWT_ACCESS_SECRET is missing or shorter than 32 characters. Set it in .env');
}
if (!REFRESH_SECRET || REFRESH_SECRET.length < 32) {
  throw new Error('JWT_REFRESH_SECRET is missing or shorter than 32 characters. Set it in .env');
}
if (ACCESS_SECRET === REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

const isProd = process.env.NODE_ENV === 'production';

// httpOnly cookies — never readable from client-side JS (mitigates XSS token theft).
// secure=true in production forces HTTPS-only transmission.
export const cookieOptions = {
  access: {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  },
  refresh: {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth', // only sent to auth endpoints
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};
