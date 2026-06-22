# MEM SIM — Web App (Landing + Auth)

This is a new `frontend/` + `server/` pair that sits alongside your existing
C++ simulator project. It does **not** touch the C++ code or `simulator.js`'s
logic — those still work standalone if you want them to.

## Structure

```
memsim-web/
├── frontend/               # merge these into your existing frontend/ folder
│   ├── landing.html
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── account-panel.js / account-panel.css
│   ├── css/site.css
│   └── js/ (api.js, simulations-api.js, login.js, signup.js, dashboard.js,
│            heap-field.js, tilt-cards.js)
└── server/                  # drop this folder next to backend/ and frontend/
    ├── package.json
    ├── .env.example
    ├── .gitignore
    └── src/...
```

Your existing `index.html`, `style.css`, and `simulator.js` stay exactly where
they are in `frontend/`. `simulator.js`'s logic is untouched throughout this
whole build — `index.html` gained new markup (an account panel, an
auth-status slot) and `account-panel.js` is a second classic script loaded
after it, sharing its scope, never editing it.

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
- The simulator page (`index.html`) has a "MY ACCOUNT" panel in the sidebar:
  name a snapshot, click Save, it's stored against your account. Signed-out
  visitors see a "sign in to save" prompt instead — the simulator itself
  still works fully without an account.
- Each saved entry supports Load / Update / Rename / Delete in the
  simulator's sidebar (Update overwrites the saved snapshot with whatever's
  currently in the live heap), and Open / Rename / Delete on the dashboard
  (no Update there — no live heap on that page to overwrite with).
- Server-side: a `simulations` table, all five endpoints (`POST`, `GET` list,
  `GET` one, `PUT`, `DELETE`) behind `requireAuth`, ownership enforced in the
  SQL `WHERE` clause itself (a user literally cannot query or modify a row
  they don't own), strict zod validation of the snapshot shape (including a
  sum-of-block-sizes integrity check), and a 20-simulations-per-account cap.

## 3D push (task 2)

The simulator page (`index.html`) deliberately did not get decorative 3D
treatment — it's a dense functional tool with its own established terminal
aesthetic, and an animated background there would hurt usability, not help
it. The landing page's feature/step cards did need it though — they
previously just sat flat with a 2px lift on hover.

Added a subtle 3D tilt (`frontend/js/tilt-cards.js`) that follows the cursor
across each card — same progressive-enhancement pattern as the hero's
`heap-field.js`: CSS custom properties (`--rx`/`--ry`) drive the `transform`,
JS only updates the inputs on `mousemove`, gated behind
`prefers-reduced-motion` in both JS (skips attaching listeners) and CSS
(`!important` override as a second line of defense, since the JS check only
runs once at load and won't react to an OS setting changed mid-session).

The hero animation itself is intentionally CSS-only (transforms + animations)
rather than a Three.js scene — the "balanced" option you picked earlier:
visually 3D, but adds ~0 KB of extra JS and no WebGL context to spin up.

## Performance pass (task 3)

Measured actual file sizes first rather than guessing. Total page weight is
already small — the largest single file is `css/site.css` at ~14KB
uncompressed; a full simulator page load (HTML + both CSS files + both JS
files) is under 50KB uncompressed, well under "needs a bundler" territory.
A build/bundling step would be solving a problem that doesn't exist here, so
I didn't add one. What was actually missing:

- **No response compression.** The server now gzips everything via the
  `compression` package — the single highest-leverage fix, costs nothing.
- **No Cache-Control on static assets.** HTML always revalidates
  (`no-cache` — still allows a fast 304, just guarantees freshness). CSS/JS
  get a 5-minute cache for now, deliberately short: this app is still being
  actively iterated on, and a long cache is exactly what caused the "why
  isn't my CSS fix showing up" confusion earlier in this build. Once the app
  is stable for real deployment, switch to versioned filenames
  (`site.css?v=2`) and cache those for a year.
- **`index.html` was missing the `fonts.gstatic.com` preconnect** that every
  other page already had (a pre-existing gap in the original file) — costs
  one extra round-trip when the actual font file downloads. Fixed to match
  the other pages.

Script tags were already correctly placed at the end of `<body>` (non-
blocking) and stylesheet `<link>`s in `<head>` (correct, intentionally
render-blocking) from the start — no change needed there.

## How this maps to the security checklist you pasted

Your checklist assumes a Node app with a database — that infrastructure
**now exists**. Here's the honest status:

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
| Response compression | ✅ done |
| Generic error messages to client | ✅ done |
| File upload validation | — N/A, no uploads yet |
| AI/LLM rules | — N/A, no LLM calls in this app |
| `npm audit` / dependency pinning | ⚠️ **your action** — run `npm install` then `npm audit` once you have network access; commit the generated `package-lock.json` |
| HTTPS enforced | ⚠️ **deployment-time** — depends on your host; set `NODE_ENV=production` once behind HTTPS |
| DB not publicly exposed | ⚠️ **deployment-time** — SQLite file should stay on the server's private filesystem, not in a public bucket |

Items marked ⚠️ aren't code problems — they're things that only become real
once you deploy, and no amount of application code fixes them on its own.

## Security fix found in self-review

After all three original tasks were done, I went back through my own code
against the security checklist you gave me — specifically rule 3, "validate
and sanitize all string inputs... to prevent XSS." Found a real gap:
`simulator.js`'s `log()` function renders messages via `innerHTML`, which was
always safe in the original app (every call only ever passed hardcoded text
or numbers). My `account-panel.js` broke that assumption — it's the first
code to pass a free-text, user-controlled value (the saved simulation
`name`, up to 60 characters, no content restriction beyond length) into that
same sink, in 7 different places.

Today this is self-XSS only (no simulation-sharing feature exists yet), but
it directly violated the checklist regardless, and would become exploitable
against other people the moment sharing gets built later. Fixed by adding an
`escapeHtml()` helper in `account-panel.js` and wrapping every dynamic value
before it reaches `log()` — `simulator.js` itself was not touched, same as
everywhere else in this build. Re-audited every other file for the same
pattern (`dashboard.js`, `login.js`, `signup.js`, the block-table renderer in
`simulator.js`) — nothing else found; everything else already used
`textContent` or numeric-only values guaranteed by server-side zod
validation.

## Scoped out for now (explicit, not forgotten)

- Sharing a saved simulation, or any multi-user features.
- Password reset / email verification.
- Admin or multi-user roles — not relevant for a single-user simulator.
- Rename/Update currently use `window.prompt()` / `window.confirm()` for
  simplicity — fine functionally, but a proper inline-edit UI and a custom
  confirm dialog (matching the rest of the design) would read better. Swap
  this out if/when visual polish becomes the priority.