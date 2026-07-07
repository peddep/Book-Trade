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

// Adds newer books columns (cover_url, title_en) to databases created before
// those features existed. Idempotent.
let bookColumnsEnsured = false;
export async function ensureBookColumns() {
  if (bookColumnsEnsured) return;
  for (const col of ['cover_url TEXT', 'title_en TEXT', 'price REAL']) {
    try {
      await getDb().execute(`ALTER TABLE books ADD COLUMN ${col}`);
    } catch {
      // column already exists
    }
  }
  // Backfill: give any book without a price a random one (50–300 baht,
  // rounded to the nearest 10) so no listing is left blank.
  try {
    await getDb().execute(
      'UPDATE books SET price = (50 + ABS(RANDOM() % 26) * 10) WHERE price IS NULL OR price <= 0'
    );
  } catch {
    // ignore if the column isn't ready yet
  }
  bookColumnsEnsured = true;
}

// Back-compat alias.
export const ensureCoverColumn = ensureBookColumns;

// Adds the availability column (weekly trade-time grid) to older user tables.
let userColumnsEnsured = false;
export async function ensureUserColumns() {
  if (userColumnsEnsured) return;
  try {
    await getDb().execute('ALTER TABLE users ADD COLUMN availability TEXT');
  } catch {
    // column already exists
  }
  userColumnsEnsured = true;
}

// Adds the IRL-meetup confirmation columns to older trade tables.
// Each side records 'happened' / 'not' once the meet-up time is up.
let tradeColumnsEnsured = false;
export async function ensureTradeColumns() {
  if (tradeColumnsEnsured) return;
  for (const col of ['requester_confirm TEXT', 'owner_confirm TEXT']) {
    try {
      await getDb().execute(`ALTER TABLE trades ADD COLUMN ${col}`);
    } catch {
      // column already exists
    }
  }
  tradeColumnsEnsured = true;
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
        availability TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        title_en TEXT,
        price REAL,
        author TEXT NOT NULL,
        subject TEXT,
        grade_level TEXT,
        condition TEXT NOT NULL DEFAULT 'Good',
        description TEXT,
        cover_color TEXT DEFAULT '#f59e0b',
        cover_url TEXT,
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
