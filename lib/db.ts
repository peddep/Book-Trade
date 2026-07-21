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

// Adds any missing columns to a table with a single PRAGMA check up front, so
// warm-and-cold requests don't pay a round-trip per column. Returns the names
// of columns that were actually added. Each `def` is "name TYPE ...".
async function addMissingColumns(table: string, defs: string[]): Promise<string[]> {
  const info = await getDb().execute(`PRAGMA table_info(${table})`);
  const existing = new Set(info.rows.map(r => String(r.name)));
  const added: string[] = [];
  for (const def of defs) {
    const name = def.split(' ')[0];
    if (existing.has(name)) continue;
    try {
      await getDb().execute(`ALTER TABLE ${table} ADD COLUMN ${def}`);
      added.push(name);
    } catch {
      // raced with another request; column now exists
    }
  }
  return added;
}

// Adds newer books columns (cover_url, title_en, price) to older databases.
let bookColumnsEnsured = false;
export async function ensureBookColumns() {
  if (bookColumnsEnsured) return;
  const added = await addMissingColumns('books', ['cover_url TEXT', 'title_en TEXT', 'price REAL', 'volume TEXT']);
  // Backfill random prices only when the price column was just created — no
  // point re-scanning the whole table on every cold start once it's done.
  if (added.includes('price')) {
    try {
      await getDb().execute('UPDATE books SET price = (50 + ABS(RANDOM() % 26) * 10) WHERE price IS NULL OR price <= 0');
    } catch { /* ignore */ }
  }
  bookColumnsEnsured = true;
}

// Back-compat alias.
export const ensureCoverColumn = ensureBookColumns;

// Adds the availability / class / contact / banned columns to older user tables.
let userColumnsEnsured = false;
export async function ensureUserColumns() {
  if (userColumnsEnsured) return;
  await addMissingColumns('users', ['availability TEXT', 'class_no TEXT', 'contact TEXT', 'real_name TEXT', 'banned INTEGER DEFAULT 0']);
  userColumnsEnsured = true;
}

// Adds the IRL-meetup confirmation columns to older trade tables.
let tradeColumnsEnsured = false;
export async function ensureTradeColumns() {
  if (tradeColumnsEnsured) return;
  await addMissingColumns('trades', ['requester_confirm TEXT', 'owner_confirm TEXT']);
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
        class_no TEXT,
        contact TEXT,
        real_name TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        title_en TEXT,
        price REAL,
        volume TEXT,
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
