import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb, ensureBookColumns, ensureUserColumns, ensureTradeColumns, addMissingColumns } from './db';
import { overlap } from './meeting';
import { SUB_SLOT_TIMES, SLOTS_PER_PERIOD, type Period } from './meetingSlots';

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
      // Things that happened to a student while they were not looking. The text
      // is not stored: `kind` plus the two parameters are rendered and
      // translated in the client, so a Thai student and an English one see the
      // same notification in their own language.
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        actor TEXT,
        subject TEXT,
        link TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      // Suggestions and bug reports from students, for the admin to work through.
      `CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL DEFAULT 'suggestion',
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      // Donation pledges: the student says who's transferring and how much;
      // the admin verifies against the real bank statement.
      `CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        bank_name TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
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
      // One row per device that has granted push permission. `endpoint` is the
      // push service's own URL for that device and is unique to it, which is
      // what lets the same student get a notification on every phone or
      // browser they signed in on, and what lets a device that uninstalled or
      // revoked permission be dropped without touching the others.
      `CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
    ],
    'write'
  );
  // Donations used to be posted as plain announcements, which the chat labels
  // "trade completed" — so past donations read as trades. Move them onto their
  // own kind. Matches the 💜 the old bodies always started with, so nothing
  // else is touched. Runs once per cold start and is a no-op after the first.
  try {
    await db.execute("UPDATE messages SET kind = 'donation' WHERE kind = 'announcement' AND body LIKE '💜%'");
  } catch { /* older database without the messages table yet */ }
  // Set when an admin edits a message. Shown in the chat, because a message
  // still carries the student's name and avatar after it has been changed.
  await addMissingColumns('messages', ['edited_at TEXT']);
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
  const r = res.rows[0] as unknown as { requester_name: string; owner_name: string; offered_title: string; wanted_title: string } | undefined;
  if (!r) return;
  const body = `${r.requester_name} ⇄ ${r.owner_name} · ${r.offered_title} ⇄ ${r.wanted_title}`;
  await db.execute({
    sql: "INSERT INTO messages (user_id, kind, body) VALUES (NULL, 'announcement', ?)",
    args: [body],
  });
}


// ── Assigning an actual meet-up appointment ─────────────────────────────
//
// The library has room for one pair at a time, so a period is only ever
// good for two: whoever gets there first, and whoever comes right after.
// Deciding who gets which of a period's two ten-minute windows — and what
// happens once both are taken — needs to see every other pair's
// appointment, which a browser cannot: two students accepting a trade
// don't know about each other's plans. So, unlike the shared-period math in
// lib/meeting.ts, this runs server-side and is stored once decided.
//
// The stored calendar date is the school's own wall-clock date (e.g.
// "2026-09-08"), not a UTC instant — deliberately, so a server that always
// runs in UTC never has to be trusted to also be in Bangkok. The only place
// that matters here is figuring out, from the real current instant, what
// day *in Bangkok* "next Monday" or "still before 16:05" means; once that's
// settled the result is plain wall-clock fields a browser in the same
// timezone can read back at face value.
const BANGKOK_OFFSET_MS = 7 * 60 * 60_000;

// `instant` shifted by the Bangkok offset, so its own UTC getters
// (getUTCDay, getUTCHours, ...) read as Bangkok wall-clock fields instead.
function asBangkokFields(instant: Date): Date {
  return new Date(instant.getTime() + BANGKOK_OFFSET_MS);
}

// The next time `targetDow` (JS convention: Sunday = 0) falls at `hh:mm`
// Bangkok time, strictly after `from` — as a wall-clock 'YYYY-MM-DD' date
// string, plus the shifted instant (for sorting several of these against
// each other; never compare it to a real, un-shifted Date).
function nextBangkokOccurrence(from: Date, targetDow: number, hh: number, mm: number): { dateStr: string; shiftedAt: number } | null {
  const bkNow = asBangkokFields(from);
  for (let add = 0; add <= 7; add++) {
    const cand = new Date(bkNow);
    cand.setUTCDate(bkNow.getUTCDate() + add);
    cand.setUTCHours(hh, mm, 0, 0);
    if (cand.getUTCDay() === targetDow && cand.getTime() > bkNow.getTime()) {
      const y = cand.getUTCFullYear();
      const m = String(cand.getUTCMonth() + 1).padStart(2, '0');
      const d = String(cand.getUTCDate()).padStart(2, '0');
      return { dateStr: `${y}-${m}-${d}`, shiftedAt: cand.getTime() };
    }
  }
  return null;
}

// The Bangkok instant of a stored (date, period, sub) — the inverse of
// nextBangkokOccurrence's dateStr, for using an existing appointment as the
// `from` of a new search ("strictly after the one you're being moved off").
export function bangkokInstantOf(dateStr: string, period: Period, sub: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = SUB_SLOT_TIMES[period][sub] ?? SUB_SLOT_TIMES[period][0];
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0) - BANGKOK_OFFSET_MS);
}

export interface MeetingAssignment { date: string; period: Period; sub: number }

// Finds the soonest shared period, after `from`, that still has room — trying
// every period the two share, in true chronological order (not grid order:
// the soonest *actual* date wins, whichever period it is), and picking the
// first whose two seats for that specific calendar date aren't both taken.
// Returns null when every shared period is full for its next occurrence —
// callers leave the trade "waiting" rather than searching further weeks
// ahead, so a spot freeing up (someone cancels, or moves on) is what lets it
// resolve, not an ever-later date nobody asked for.
export async function assignMeetingSlot(
  availA: string | null | undefined,
  availB: string | null | undefined,
  from: Date,
): Promise<MeetingAssignment | null> {
  const shared = overlap(availA, availB);
  if (shared.length === 0) return null;
  await ensureTradeColumns();
  const db = getDb();

  const candidates: Array<{ period: Period; dateStr: string; shiftedAt: number }> = [];
  for (const key of shared) {
    const [slot, dayStr] = key.split('-') as [Period, string];
    if (!(slot in SUB_SLOT_TIMES)) continue;
    const targetDow = Number(dayStr) + 1; // grid day 0 = Monday; JS Sunday = 0
    const [hh, mm] = SUB_SLOT_TIMES[slot][0]; // the period's own day, not which sub-slot
    const occ = nextBangkokOccurrence(from, targetDow, hh, mm);
    if (occ) candidates.push({ period: slot, dateStr: occ.dateStr, shiftedAt: occ.shiftedAt });
  }
  candidates.sort((a, b) => a.shiftedAt - b.shiftedAt);

  for (const c of candidates) {
    const taken = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM trades WHERE status = 'accepted' AND meeting_date = ? AND meeting_period = ?",
      args: [c.dateStr, c.period],
    });
    const n = Number(taken.rows[0]?.n ?? 0);
    if (n < SLOTS_PER_PERIOD) return { date: c.dateStr, period: c.period, sub: n };
  }
  return null;
}

// Re-tries every currently-waiting trade (one whose shared periods were all
// full when it last looked) against the slots as they stand now — called
// after something frees one up (a cancellation, a no-show, a trade completing,
// or someone else's meet-up moving on). Oldest wait first. Returns what
// changed, so the caller — which already has lib/notify.ts in scope, and
// importing it here would cycle back through lib/push.ts to this file — can
// tell the newly-scheduled pairs.
export async function sweepWaitingMeetings(): Promise<Array<{ id: number; requesterId: number; ownerId: number; assignment: MeetingAssignment }>> {
  await ensureTradeColumns();
  const db = getDb();
  const waiting = await db.execute(
    `SELECT t.id, t.requester_id, t.owner_id,
            ru.availability AS requester_availability, ru.grade AS requester_grade, ru.class_no AS requester_class,
            ou.availability AS owner_availability, ou.grade AS owner_grade, ou.class_no AS owner_class
     FROM trades t JOIN users ru ON t.requester_id = ru.id JOIN users ou ON t.owner_id = ou.id
     WHERE t.status = 'accepted' AND t.meeting_date IS NULL
     ORDER BY t.updated_at ASC`
  );
  const resolved: Array<{ id: number; requesterId: number; ownerId: number; assignment: MeetingAssignment }> = [];
  for (const r of waiting.rows as unknown as Array<{
    id: number; requester_id: number; owner_id: number;
    requester_availability: string | null; requester_grade: string | null; requester_class: string | null;
    owner_availability: string | null; owner_grade: string | null; owner_class: string | null;
  }>) {
    // Same-class pairs are never given a library slot at all (they swap in
    // class), so a null meeting_date here means "not applicable", not
    // "waiting" — nothing must ever sweep them into a seat.
    if (r.requester_grade === r.owner_grade && r.requester_class === r.owner_class) continue;
    const assignment = await assignMeetingSlot(r.requester_availability, r.owner_availability, new Date());
    if (!assignment) continue;
    await db.execute({
      sql: 'UPDATE trades SET meeting_date = ?, meeting_period = ?, meeting_sub = ? WHERE id = ?',
      args: [assignment.date, assignment.period, assignment.sub, r.id],
    });
    resolved.push({ id: r.id, requesterId: Number(r.requester_id), ownerId: Number(r.owner_id), assignment });
  }
  return resolved;
}

// Removing a book, for the owner and for the admin alike.
//
// Two things make this more than a DELETE. The trades table points at books, so
// the database refuses to delete a row a finished trade still refers to — and
// that trade is the other student's history, which is not ours to tear a hole
// in. And a book may be sitting in a box or a room, or be the subject of offers
// that have not been answered.
//
// Returns what happened: 'deleted' when the row itself went, 'hidden' when a
// trade still refers to it and it was marked removed instead, or
// 'in_agreed_trade' when somebody is expecting to be handed it and force was
// not given.
export async function removeBook(bookId: number, opts: { force?: boolean } = {}): Promise<'deleted' | 'hidden' | 'in_agreed_trade'> {
  const db = getDb();
  await ensureBookColumns();
  await ensureHubTables();

  const agreed = await db.execute({
    sql: "SELECT 1 FROM trades WHERE status = 'accepted' AND (offered_book_id = ? OR wanted_book_id = ?) LIMIT 1",
    args: [bookId, bookId],
  });
  if (agreed.rows.length > 0 && !opts.force) return 'in_agreed_trade';

  // Offers and meet-ups involving this book end with it. When an agreed one is
  // cancelled the other book goes back on the market — it should not be left
  // reserved for a trade that can no longer happen.
  const live = await db.execute({
    sql: "SELECT offered_book_id, wanted_book_id FROM trades WHERE status IN ('pending','accepted') AND (offered_book_id = ? OR wanted_book_id = ?)",
    args: [bookId, bookId],
  });
  await db.execute({
    sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE status IN ('pending','accepted') AND (offered_book_id = ? OR wanted_book_id = ?)",
    args: [bookId, bookId],
  });
  for (const row of live.rows as unknown as Array<{ offered_book_id: number; wanted_book_id: number }>) {
    const other = Number(row.offered_book_id) === bookId ? Number(row.wanted_book_id) : Number(row.offered_book_id);
    await db.execute({ sql: 'UPDATE books SET available = 1 WHERE id = ?', args: [other] });
  }

  for (const sql of [
    'DELETE FROM wonder_box WHERE book_id = ?',
    'DELETE FROM gts_deposits WHERE book_id = ?',
    'DELETE FROM room_members WHERE book_id = ?',
  ]) {
    try { await db.execute({ sql, args: [bookId] }); } catch { /* table not there yet */ }
  }

  const referenced = await db.execute({
    sql: 'SELECT 1 FROM trades WHERE offered_book_id = ? OR wanted_book_id = ? LIMIT 1',
    args: [bookId, bookId],
  });
  if (referenced.rows.length > 0) {
    await db.execute({
      sql: "UPDATE books SET deleted_at = datetime('now'), available = 0 WHERE id = ?",
      args: [bookId],
    });
    return 'hidden';
  }
  await db.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [bookId] });
  return 'deleted';
}

// Deleting an account. Admin-only — reachable from the admin dashboard's
// student list, not self-service.
//
// The users row is never actually removed. Two things point at it that
// matter to someone other than this student: a finished trade is the other
// side's own history (`JOIN users` in every trades/admin listing), and a
// community-chat announcement names them. Hard-deleting the row would silently
// erase this student from both — the same reason removeBook() marks a book
// "hidden" instead of dropping it when a trade still refers to it. So this
// scrubs everything personal (name, email, contact, password, availability)
// and bans the row shut, rather than deleting it.
//
// Refuses while an agreed trade is outstanding — somebody is expecting to be
// handed a book at the library, and disappearing out from under that would
// leave them standing there with no explanation. Everything else this
// student holds (books, pending offers, room seats, wonder box, GTS deposits,
// push subscriptions, notifications) is torn down the same way removing it
// individually already would.
export async function deleteAccount(userId: number): Promise<'deleted' | 'in_agreed_trade'> {
  const db = getDb();
  await ensureUserColumns();
  await ensureHubTables();

  const agreed = await db.execute({
    sql: "SELECT 1 FROM trades WHERE status = 'accepted' AND (requester_id = ? OR owner_id = ?) LIMIT 1",
    args: [userId, userId],
  });
  if (agreed.rows.length > 0) return 'in_agreed_trade';

  const books = await db.execute({ sql: 'SELECT id FROM books WHERE owner_id = ?', args: [userId] });
  for (const row of books.rows as unknown as Array<{ id: number }>) {
    await removeBook(Number(row.id));
  }

  // Any pending offer this student made on someone else's book, or received
  // on their own — the loop above already cleared their own books' offers,
  // this catches offers on books they don't own.
  const pending = await db.execute({
    sql: "SELECT id FROM trades WHERE status = 'pending' AND (requester_id = ? OR owner_id = ?)",
    args: [userId, userId],
  });
  for (const row of pending.rows as unknown as Array<{ id: number }>) {
    await db.execute({ sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", args: [row.id] });
  }

  for (const sql of [
    'DELETE FROM wonder_box WHERE user_id = ?',
    'DELETE FROM gts_deposits WHERE user_id = ?',
    'DELETE FROM room_members WHERE user_id = ?',
    'DELETE FROM push_subscriptions WHERE user_id = ?',
    'DELETE FROM notifications WHERE user_id = ?',
  ]) {
    try { await db.execute({ sql, args: [userId] }); } catch { /* table not there yet */ }
  }

  // A random, never-typeable password (nobody can sign back in with it) and
  // an unguessable placeholder email/name — unique, since both columns carry
  // a unique index, and the name still shows up wherever a past trade of
  // theirs is listed.
  const placeholder = `${userId}-${crypto.randomBytes(6).toString('hex')}`;
  const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  await db.execute({
    sql: `UPDATE users SET
            name = ?, email = ?, password_hash = ?, real_name = NULL, contact = NULL,
            availability = NULL, grade = NULL, class_no = NULL, google_sub = NULL, banned = 1
          WHERE id = ?`,
    args: [`ผู้ใช้ที่ลบบัญชี-${placeholder}`, `deleted-${placeholder}@deleted.invalid`, hash, userId],
  });
  return 'deleted';
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
  const pool = [...waiting.rows] as unknown as Array<{ id: number; user_id: number; book_id: number; price: number | null }>;
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
    // This runs on a schedule, so neither student is present when it happens —
    // without a note, a matched box sits unopened.
    const { notifyBoth } = await import('./notify');
    await notifyBoth(Number(a.user_id), Number(b.user_id), 'wonderbox_match', { link: '/trade/wonderbox' });
  }
}

export function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
