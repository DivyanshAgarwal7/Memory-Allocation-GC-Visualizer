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
};

export default db;
