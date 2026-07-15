import { getDb, ensureBookColumns } from './db';

// Premium Plan limits (this app runs everyone on the Premium Plan).
export const PLAN = {
  name: 'Premium',
  wonderBoxSlots: 1,
  gtsSlots: 3,
  roomMax: 20,
};

// Price rule lives in lib/price.ts (client-safe); re-exported for server callers.
import { priceDiffOk } from './price';
export { MAX_PRICE_DIFF, priceDiffOk } from './price';

let ensured = false;

export async function ensureHubTables() {
  if (ensured) return;
  await ensureBookColumns();
  const db = getDb();
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS wonder_box (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        matched_trade_id INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS gts_deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        wanted_title TEXT,
        wanted_subject TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        matched_trade_id INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        owner_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS room_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        received_book_id INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      // Community chat. user_id is null for system trade announcements.
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        kind TEXT NOT NULL DEFAULT 'chat',
        body TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      // Reports of books or users, reviewed by the admin.
      `CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id INTEGER NOT NULL,
        target_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    ],
    'write'
  );
  ensured = true;
}

// True when a user is banned. Cheap single-row lookup used by write endpoints.
export async function isBanned(userId: number): Promise<boolean> {
  try {
    const r = await getDb().execute({ sql: 'SELECT banned FROM users WHERE id = ?', args: [userId] });
    return Number(r.rows[0]?.banned) === 1;
  } catch {
    return false; // column may not exist yet on very old databases
  }
}

// Posts a system announcement to the community chat when a trade completes.
export async function announceTrade(tradeId: number) {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT ru.name AS requester_name, ou.name AS owner_name,
                 ob.title AS offered_title, wb.title AS wanted_title
          FROM trades t
          JOIN users ru ON t.requester_id = ru.id
          JOIN users ou ON t.owner_id = ou.id
          JOIN books ob ON t.offered_book_id = ob.id
          JOIN books wb ON t.wanted_book_id = wb.id
          WHERE t.id = ?`,
    args: [tradeId],
  });
  const r = res.rows[0] as any;
  if (!r) return;
  const body = `${r.requester_name} ⇄ ${r.owner_name} · ${r.offered_title} ⇄ ${r.wanted_title}`;
  await db.execute({
    sql: "INSERT INTO messages (user_id, kind, body) VALUES (NULL, 'announcement', ?)",
    args: [body],
  });
}

// A book is "busy" when it's already committed to some trade avenue.
export async function isBookBusy(bookId: number): Promise<boolean> {
  const db = getDb();
  const checks = await Promise.all([
    db.execute({ sql: "SELECT 1 FROM wonder_box WHERE book_id = ? AND status IN ('waiting','matched') LIMIT 1", args: [bookId] }),
    db.execute({ sql: "SELECT 1 FROM gts_deposits WHERE book_id = ? AND status = 'open' LIMIT 1", args: [bookId] }),
    db.execute({ sql: "SELECT 1 FROM room_members rm JOIN rooms r ON rm.room_id = r.id WHERE rm.book_id = ? AND r.status = 'open' LIMIT 1", args: [bookId] }),
    db.execute({ sql: "SELECT 1 FROM trades WHERE status = 'pending' AND offered_book_id = ? LIMIT 1", args: [bookId] }),
  ]);
  return checks.some(c => c.rows.length > 0);
}

// Validates a book belongs to the user and is free to commit to a trade.
export async function getFreeOwnedBook(userId: number, bookId: number) {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT * FROM books WHERE id = ? AND owner_id = ? AND available = 1',
    args: [bookId, userId],
  });
  const book = res.rows[0];
  if (!book) return null;
  if (await isBookBusy(bookId)) return null;
  return book;
}

// Creates an already-accepted trade between two users (used by Wonder Box,
// GTS and Room Trade), marks both books unavailable and cancels competing
// pending offers.
export async function createInstantTrade(
  requesterId: number,
  ownerId: number,
  offeredBookId: number,
  wantedBookId: number,
  tag: string
): Promise<number> {
  const db = getDb();
  const result = await db.execute({
    sql: "INSERT INTO trades (requester_id, owner_id, offered_book_id, wanted_book_id, status, message) VALUES (?, ?, ?, ?, 'accepted', ?)",
    args: [requesterId, ownerId, offeredBookId, wantedBookId, tag],
  });
  await db.execute({ sql: 'UPDATE books SET available = 0 WHERE id = ? OR id = ?', args: [offeredBookId, wantedBookId] });
  await db.execute({
    sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE status = 'pending' AND (offered_book_id IN (?, ?) OR wanted_book_id IN (?, ?))",
    args: [offeredBookId, wantedBookId, offeredBookId, wantedBookId],
  });
  return Number(result.lastInsertRowid);
}

// Wonder Box matchmaker: pairs waiting deposits from different users
// (oldest first) into instant trades.
export async function runWonderBoxMatcher() {
  const db = getDb();
  const waiting = await db.execute(
    "SELECT wb.id, wb.user_id, wb.book_id, b.price FROM wonder_box wb JOIN books b ON wb.book_id = b.id WHERE wb.status = 'waiting' AND b.available = 1 ORDER BY wb.created_at"
  );
  const pool = [...waiting.rows] as any[];
  let guard = 0;
  while (pool.length >= 2 && guard++ < 1000) {
    const a = pool.shift()!;
    // Pair with the oldest waiting deposit from another user whose price is close enough.
    const idx = pool.findIndex(d => Number(d.user_id) !== Number(a.user_id) && priceDiffOk(a.price, d.price));
    if (idx === -1) continue; // no compatible partner for `a` right now; leave it waiting
    const b = pool.splice(idx, 1)[0];
    const tradeId = await createInstantTrade(
      Number(a.user_id), Number(b.user_id), Number(a.book_id), Number(b.book_id), 'Wonder Box'
    );
    await db.execute({
      sql: "UPDATE wonder_box SET status = 'matched', matched_trade_id = ? WHERE id IN (?, ?)",
      args: [tradeId, Number(a.id), Number(b.id)],
    });
  }
}

export function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
