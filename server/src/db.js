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
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash   TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
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
    'SELECT id, name, created_at, updated_at FROM simulations WHERE user_id = ? ORDER BY updated_at DESC'
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
};

export default db;
