import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) {
      throw new Error('TURSO_DATABASE_URL is not set. Add it to your environment (.env.local locally, Vercel env vars in production).');
    }
    client = createClient({ url, authToken });
  }
  return client;
}

export async function initDb() {
  const db = getDb();
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
}
