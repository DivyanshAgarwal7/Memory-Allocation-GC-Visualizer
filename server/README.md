# MEM SIM — Auth Server

Node.js + Express API that handles signup, login, sessions, password reset,
saved simulations, and serves the frontend (`../frontend`). SQLite database,
created automatically on first run.

## 1. Install dependencies

```bash
cd server
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Generate two **different** random secrets (32+ chars each) and paste them into `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run it twice — once for `JWT_ACCESS_SECRET`, once for `JWT_REFRESH_SECRET`.
The server refuses to start if either secret is missing, too short, or identical.

Leave the `SMTP_*` variables blank for local development — see "Password
reset emails" below.

## 3. Run

```bash
npm run dev     # auto-restarts on file changes (Node 18+)
# or
npm start
```

Visit `http://localhost:4000`. All frontend pages (landing, login, signup,
forgot/reset password, dashboard, simulator) are served directly by this
server — no separate frontend build step.

## API endpoints

| Method | Path                          | Auth required   | Notes |
|--------|-------------------------------|-----------------|-------|
| POST   | `/api/auth/signup`            | no              | 5 requests / 15 min per IP |
| POST   | `/api/auth/login`             | no              | 5 requests / 15 min per IP; locks account for 15 min after 5 bad attempts |
| POST   | `/api/auth/refresh`           | refresh cookie  | issues a new short-lived access token |
| POST   | `/api/auth/logout`            | no              | clears both cookies |
| GET    | `/api/auth/me`                | access cookie   | returns the current user |
| POST   | `/api/auth/forgot-password`   | no              | 5/15min per IP; always returns the same generic message |
| POST   | `/api/auth/reset-password`    | no (token-based)| 5/15min per IP; token is single-use, expires in 30 min |
| POST   | `/api/simulations`            | access cookie   | save current heap state |
| GET    | `/api/simulations`            | access cookie   | list saved simulations + preview stats |
| GET    | `/api/simulations/:id`        | access cookie   | full saved simulation data |
| PUT    | `/api/simulations/:id`        | access cookie   | rename and/or overwrite data |
| DELETE | `/api/simulations/:id`        | access cookie   | delete |

## Password reset emails

With `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` left blank in `.env`, the server
logs the reset link to the console instead of sending a real email — the
whole forgot/reset-password flow is testable locally with zero email setup.
Fill in real SMTP credentials (any provider: SendGrid, Mailgun, your own
mail server) to send actual emails; no code change needed, `mailer.js`
detects the configured vars automatically.

## Security notes (what's already covered)

- Passwords hashed with bcrypt, cost 12.
- Access token (15 min) + refresh token (7 days), both **httpOnly** cookies —
  never readable from JS, so an XSS bug can't steal a session by reading
  `localStorage`.
- Password reset tokens: `crypto.randomBytes(32)`, only the SHA-256 hash is
  stored (same principle as `password_hash`), 30-minute expiry, single-use.
- All input validated server-side with `zod` before touching the database.
- All DB access via `better-sqlite3` prepared statements — no string-built SQL.
- `helmet` sets CSP, frame-ancestors, HSTS-on-prod, etc. `X-Powered-By` removed.
- CORS locked to `ALLOWED_ORIGIN`.
- Response compression (gzip) on all routes.
- Rate limiting: auth routes including forgot/reset-password (5/15min),
  general API (60/min).
- Account lockout after 5 failed logins (15 min); a successful password
  reset also clears any lockout.
- Generic error messages everywhere an attacker could otherwise enumerate
  accounts ("incorrect email or password", "if an account exists...").
- Errors never leak stack traces to the client; full details go to `console.error` only.

## Deliberately deferred (next steps, not yet built)

- Resetting a password does not force other active sessions to log out —
  existing access/refresh tokens keep working until they naturally expire.
  Fixing this needs a token-version field threaded through every token
  verification; deferred as a real auth-model change, not a quick add.
- Email verification on signup — anyone can currently sign up with any
  email address; nothing confirms they own it.
- HTTPS termination — handled by your hosting platform / reverse proxy, not
  this app. Set `NODE_ENV=production` once you're behind HTTPS so cookies
  get `secure: true`.
