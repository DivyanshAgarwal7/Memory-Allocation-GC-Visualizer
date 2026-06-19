# MEM SIM — Auth Server

Node.js + Express API that handles signup, login, sessions, and serves the
frontend (`../frontend`). SQLite database, created automatically on first run.

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

## 3. Run

```bash
npm run dev     # auto-restarts on file changes (Node 18+)
# or
npm start
```

Visit `http://localhost:4000`. The landing page, login, and signup pages are
served directly by this server — no separate frontend build step.

## API endpoints

| Method | Path                | Auth required | Notes |
|--------|---------------------|---------------|-------|
| POST   | `/api/auth/signup`  | no  | 5 requests / 15 min per IP |
| POST   | `/api/auth/login`   | no  | 5 requests / 15 min per IP; locks account for 15 min after 5 bad attempts |
| POST   | `/api/auth/refresh` | refresh cookie | issues a new short-lived access token |
| POST   | `/api/auth/logout`  | no  | clears both cookies |
| GET    | `/api/auth/me`      | access cookie | returns the current user |

## Security notes (what's already covered)

- Passwords hashed with bcrypt, cost 12.
- Access token (15 min) + refresh token (7 days), both **httpOnly** cookies —
  never readable from JS, so an XSS bug can't steal a session by reading
  `localStorage`.
- All auth input validated server-side with `zod` before touching the database.
- All DB access via `better-sqlite3` prepared statements — no string-built SQL.
- `helmet` sets CSP, frame-ancestors, HSTS-on-prod, etc. `X-Powered-By` removed.
- CORS locked to `ALLOWED_ORIGIN`.
- Rate limiting on auth routes (5/15min) and general API (60/min).
- Account lockout after 5 failed logins (15 min).
- Generic "incorrect email or password" message — doesn't reveal which one was wrong.
- Errors never leak stack traces to the client; full details go to `console.error` only.

## Deliberately deferred (next steps, not yet built)

- Saving/loading simulation snapshots per user (dashboard currently shows an
  empty state for this).
- Password reset flow (forgot-password email).
- HTTPS termination — handled by your hosting platform / reverse proxy, not this app.
  Set `NODE_ENV=production` once you're behind HTTPS so cookies get `secure: true`.
