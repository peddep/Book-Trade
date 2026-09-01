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
export async function addMissingColumns(table: string, defs: string[]): Promise<string[]> {
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

// Creates the core tables if they are not there yet, once per cold start.
// Everything else in the app already creates its own tables on demand, so an
// empty database used to fail on these three alone and needed `npm run db:init`
// from a terminal first. Now pointing the site at a brand-new database is
// enough — which is what makes a preview environment set-up-able from a phone.
// CREATE TABLE IF NOT EXISTS is a no-op against a database that already has
// them, so this costs one batch on the first request after a deploy.
let coreTablesEnsured = false;
async function ensureCoreTables() {
  if (coreTablesEnsured) return;
  try {
    await initDb();
  } catch {
    // Racing with another cold start, or a read-only replica: the tables are
    // either already there or the next call will report the real problem.
  }
  coreTablesEnsured = true;
}

// Adds newer books columns (cover_url, title_en, price) to older databases.
let bookColumnsEnsured = false;
export async function ensureBookColumns() {
  if (bookColumnsEnsured) return;
  await ensureCoreTables();
  // isbn: set when the book was added by scanning, so the next student to scan
  // the same barcode is answered from our own database instead of an API.
  // cover_source: 'api' | 'upload' | 'camera' — only 'api' covers are reused on
  // someone else's listing, since the other two are the student's own photo.
  const added = await addMissingColumns('books', [
    'cover_url TEXT', 'title_en TEXT', 'price REAL', 'volume TEXT', 'publisher TEXT',
    'isbn TEXT', 'cover_source TEXT',
    // A small copy of the cover, made the first time one is asked for and kept
    // so it is made once. Every place the app shows a cover shows it small —
    // a shelf tile, a card, the picture beside an offer — so sending the
    // full-size photograph to draw a 120px tile was most of what a page
    // weighed. Cleared whenever the cover itself changes.
    'thumb_url TEXT',
    // Set when a book is removed but a finished trade still refers to it, so
    // the other student's history keeps its two books.
    'deleted_at TEXT',
  ]);
  if (added.includes('isbn')) {
    try {
      await getDb().execute('CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn)');
    } catch { /* ignore */ }
  }
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
  await ensureCoreTables();
  await addMissingColumns('users', ['availability TEXT', 'class_no TEXT', 'contact TEXT', 'real_name TEXT', 'banned INTEGER DEFAULT 0', 'terms_accepted_at TEXT']);
  userColumnsEnsured = true;
}

// One account per address, one student per username — enforced by the database
// rather than only by the check in the signup route, which two people
// registering at the same moment can both slip past.
//
// Indexed on lower(...) because the table's own UNIQUE(email) compares exactly:
// it treats "Somchai@..." and "somchai@..." as different addresses, which is
// how the same student could end up with two accounts.
//
// Creating either index fails if the data already contains duplicates. That is
// left alone deliberately: dropping or renaming somebody's existing account is
// not something to do quietly on a deploy. The route's own check still applies,
// so no new duplicates can be created either way.
let uniqueAccountsEnsured = false;
export async function ensureUniqueAccounts() {
  if (uniqueAccountsEnsured) return;
  await ensureCoreTables();
  for (const sql of [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email))',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_lower ON users(lower(name))',
  ]) {
    try {
      await getDb().execute(sql);
    } catch (err) {
      console.warn('Could not enforce unique accounts (existing duplicates?):', String(err));
    }
  }
  uniqueAccountsEnsured = true;
}

// Adds the IRL-meetup confirmation columns to older trade tables.
let tradeColumnsEnsured = false;
export async function ensureTradeColumns() {
  if (tradeColumnsEnsured) return;
  await ensureCoreTables();
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
        terms_accepted_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        title_en TEXT,
        price REAL,
        volume TEXT,
        publisher TEXT,
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
