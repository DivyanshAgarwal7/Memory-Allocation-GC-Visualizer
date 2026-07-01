import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DB_PATH || './data/memsim.db';
const resolvedPath = path.isAbsolute(dbPath)
  ? dbPath
  : path.join(__dirname, '..', dbPath);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    username               TEXT UNIQUE NOT NULL,
    email                  TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash          TEXT NOT NULL,
    failed_attempts        INTEGER NOT NULL DEFAULT 0,
    locked_until           INTEGER,
    reset_token_hash       TEXT,      -- sha256 of the reset token, never the raw token (same
                                       -- principle as password_hash - a DB leak alone shouldn't
                                       -- let someone reset accounts)
    reset_token_expires_at INTEGER,
    created_at             TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS simulations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    data        TEXT NOT NULL,   -- JSON snapshot, same shape as VirtualHeap.serialize()
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_simulations_user ON simulations(user_id);
`);

// SQLite has no clean "add column if not exists" - this lets the two new
// columns get added to a database file created before this feature
// existed, without forcing anyone to delete their existing data.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColumns.includes('reset_token_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN reset_token_hash TEXT');
}
if (!userColumns.includes('reset_token_expires_at')) {
  db.exec('ALTER TABLE users ADD COLUMN reset_token_expires_at INTEGER');
}

// ── Prepared statements (parameterized — never string-concatenated) ──
export const queries = {
  findByEmail:        db.prepare('SELECT * FROM users WHERE email = ?'),
  findByUsername:     db.prepare('SELECT * FROM users WHERE username = ?'),
  findPublicById:     db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?'),
  insertUser:         db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'),
  recordFailedLogin:  db.prepare('UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?'),
  lockAccount:        db.prepare('UPDATE users SET locked_until = ? WHERE id = ?'),
  resetLoginAttempts: db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?'),

  countSimulationsByUser: db.prepare('SELECT COUNT(*) AS count FROM simulations WHERE user_id = ?'),
  insertSimulation:       db.prepare('INSERT INTO simulations (user_id, name, data) VALUES (?, ?, ?)'),
  listSimulationsByUser:  db.prepare(
    'SELECT id, name, data, created_at, updated_at FROM simulations WHERE user_id = ? ORDER BY updated_at DESC'
  ),
  // user_id is part of the WHERE clause itself, so a user can never
  // read/delete a row they don't own - not an app-level "if" check
  // bolted on afterward.
  getSimulationOwned:     db.prepare('SELECT * FROM simulations WHERE id = ? AND user_id = ?'),
  deleteSimulationOwned:  db.prepare('DELETE FROM simulations WHERE id = ? AND user_id = ?'),

  // Three fixed variants instead of building SQL dynamically - the
  // controller picks the right one based on which fields were sent.
  updateNameOwned: db.prepare(
    "UPDATE simulations SET name = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ),
  updateDataOwned: db.prepare(
    "UPDATE simulations SET data = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ),
  updateNameAndDataOwned: db.prepare(
    "UPDATE simulations SET name = ?, data = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ),

  setResetToken:    db.prepare('UPDATE users SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?'),
  findByResetToken: db.prepare(
    'SELECT * FROM users WHERE reset_token_hash = ? AND reset_token_expires_at > ?'
  ),
  // Resetting a password also clears any lockout - a successful reset is
  // strong proof of ownership, no reason to keep the account locked out
  // afterward.
  commitNewPassword: db.prepare(`
    UPDATE users
    SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL,
        failed_attempts = 0, locked_until = NULL
    WHERE id = ?
  `),
};

export default db;
