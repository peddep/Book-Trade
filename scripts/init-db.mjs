// One-time database setup: creates the tables in your Turso database.
// Run with:  npm run db:init
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('\n❌ TURSO_DATABASE_URL is not set. Put it in .env.local first.\n');
  process.exit(1);
}

const db = createClient({ url, authToken });

console.log('Creating tables...');

await db.batch(
  [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      grade TEXT,
      avatar_color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      subject TEXT,
      grade_level TEXT,
      condition TEXT NOT NULL DEFAULT 'Good',
      description TEXT,
      cover_color TEXT DEFAULT '#f59e0b',
      available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL REFERENCES users(id),
      owner_id INTEGER NOT NULL REFERENCES users(id),
      offered_book_id INTEGER NOT NULL REFERENCES books(id),
      wanted_book_id INTEGER NOT NULL REFERENCES books(id),
      status TEXT NOT NULL DEFAULT 'pending',
      message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS catalog_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      author TEXT,
      publisher TEXT,
      source TEXT DEFAULT 'harvest',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ],
  'write'
);

console.log('✅ Done! Your database is ready.');
process.exit(0);
