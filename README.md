# MEM SIM — Web App (Landing + Auth)

This is a new `frontend/` + `server/` pair that sits alongside your existing
C++ simulator project. It does **not** touch the C++ code, `index.html`,
`style.css`, or `simulator.js` — those still work standalone if you want them to.

## Structure

```
memsim-web/
├── frontend/               # merge these into your existing frontend/ folder
│   ├── landing.html
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── css/site.css
│   └── js/ (api.js, login.js, signup.js, dashboard.js, heap-field.js)
└── server/                  # drop this folder next to backend/ and frontend/
    ├── package.json
    ├── .env.example
    ├── .gitignore
    └── src/...
```

Your existing `index.html`, `style.css`, and `simulator.js` stay exactly where
they are in `frontend/` — nothing to rename or copy. The new pages link to
`index.html` directly ("Open simulator").

## Running it

```bash
cd server
npm install
cp .env.example .env
# fill in JWT secrets - see server/README.md
npm run dev
```

Open `http://localhost:4000`. `/` serves `landing.html`; your existing
simulator is reachable at `/index.html`.

## What was built

**Auth (landing / login / signup / dashboard)**
- Landing page with a CSS-only 3D animated "heap field" hero, feature cards,
  and the real GC lifecycle (allocate → mark & sweep → coalesce).
- Signup / Login wired to a working auth API (bcrypt, JWT in httpOnly
  cookies, rate limiting, account lockout, zod validation).
- Dashboard showing the signed-in user's saved simulations.

**Saved simulations (the actual reason for having accounts)**
- The simulator page (`index.html`) now has a "MY ACCOUNT" panel in the
  sidebar: name a snapshot, click Save, and it's stored against your
  account. Signed-out visitors see a "sign in to save" prompt instead —
  the simulator itself still works fully without an account.
- The dashboard lists all your saved simulations with "Open" (loads it
  straight into the simulator) and "Delete".
- Server-side: a `simulations` table, all four endpoints behind
  `requireAuth`, ownership enforced in the SQL `WHERE` clause itself (a
  user literally cannot query a row they don't own), strict zod validation
  of the snapshot shape (including a sum-of-block-sizes integrity check),
  and a 20-simulations-per-account cap.
- **Important: `simulator.js` was not modified.** `account-panel.js` is a
  second classic (non-module) script loaded after it — classic scripts on
  the same page share one global scope, so it reads/reassigns `heap` and
  calls `refresh()`/`log()` directly. Only `index.html` gained new markup
  (a sidebar section, an auth-status slot in the header, two new
  `<link>`/`<script>` tags).

## Scoped out for now (explicit, not forgotten)

- Renaming or overwriting an existing saved simulation — each Save creates
  a new entry. Update-in-place is a clean follow-up once this is tested.
- Sharing a saved simulation, or any multi-user features.

The 3D effect is intentionally CSS-only (transforms + animations) rather than
a Three.js scene — it's the "balanced" option you picked: visually 3D, but
adds ~0 KB of extra JS and no WebGL context to spin up. If you want a heavier
Three.js hero later, that's a separate decision with a real load-time cost.

## How this maps to the security checklist you pasted

Your checklist assumes a Node app with a database — that infrastructure
**now exists** as of this task. Here's the honest status:

| Rule | Status |
|---|---|
| Secrets in `.env`, never in frontend | ✅ done |
| `.gitignore` excludes `.env*` | ✅ done |
| Rate limiting on auth endpoints | ✅ done (5/15min) |
| Rate limiting on general API | ✅ done (60/min, covers `/api/simulations` too) |
| Server-side input validation (zod) | ✅ done — including a strict schema for saved-simulation data |
| Parameterized DB queries | ✅ done (better-sqlite3 prepared statements, ownership checks built into the SQL itself) |
| Passwords hashed (bcrypt, cost 12) | ✅ done |
| JWT in httpOnly cookies, short expiry | ✅ done |
| Account lockout after failed logins | ✅ done |
| CORS allowlist | ✅ done |
| Security headers (helmet/CSP/HSTS) | ✅ done |
| Generic error messages to client | ✅ done |
| File upload validation | — N/A, no uploads yet |
| AI/LLM rules | — N/A, no LLM calls in this app |
| `npm audit` / dependency pinning | ⚠️ **your action** — run `npm install` then `npm audit` once you have network access; commit the generated `package-lock.json` |
| HTTPS enforced | ⚠️ **deployment-time** — depends on your host; set `NODE_ENV=production` once behind HTTPS |
| DB not publicly exposed | ⚠️ **deployment-time** — SQLite file should stay on the server's private filesystem, not in a public bucket |

Items marked ⚠️ aren't code problems — they're things that only become real
once you deploy, and no amount of application code fixes them on its own.

## Not built yet (by design, scoped for later)

- Renaming/overwriting an existing saved simulation in place.
- Password reset / email verification.
- Admin or multi-user roles — not relevant for a single-user simulator.
