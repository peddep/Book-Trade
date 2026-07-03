import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables, getFreeOwnedBook, createInstantTrade, PLAN } from '@/lib/hub';
import { titlesMatch } from '@/lib/books-catalog';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';

  // My open deposits
  const mine = await db.execute({
    sql: `SELECT g.*, b.title, b.cover_color FROM gts_deposits g JOIN books b ON g.book_id = b.id
          WHERE g.user_id = ? AND g.status = 'open' ORDER BY g.created_at DESC`,
    args: [user.id],
  });

  // Other users' open deposits (searchable by offered title)
  let sql = `
    SELECT g.id, g.wanted_title, g.wanted_subject, g.created_at,
      b.title, b.author, b.condition, b.cover_color, b.subject,
      u.name AS owner_name, u.avatar_color AS owner_avatar
    FROM gts_deposits g
    JOIN books b ON g.book_id = b.id
    JOIN users u ON g.user_id = u.id
    WHERE g.status = 'open' AND g.user_id != ? AND b.available = 1
  `;
  const args: unknown[] = [user.id];
  if (q) {
    sql += ' AND b.title LIKE ?';
    args.push(`%${q}%`);
  }
  sql += ' ORDER BY g.created_at DESC LIMIT 50';
  const open = await db.execute({ sql, args: args as any[] });

  return NextResponse.json({ mine: mine.rows, open: open.rows, slots: PLAN.gtsSlots });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const db = getDb();
  const { book_id, wanted_title, wanted_subject } = await req.json();

  const active = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM gts_deposits WHERE user_id = ? AND status = 'open'",
    args: [user.id],
  });
  if (Number(active.rows[0].n) >= PLAN.gtsSlots) {
    return NextResponse.json({ error: 'gts_full' }, { status: 400 });
  }

  const book = await getFreeOwnedBook(user.id, Number(book_id));
  if (!book) return NextResponse.json({ error: 'book_unavailable' }, { status: 400 });

  await db.execute({
    sql: 'INSERT INTO gts_deposits (user_id, book_id, wanted_title, wanted_subject) VALUES (?, ?, ?, ?)',
    args: [user.id, Number(book_id), wanted_title?.trim() || null, wanted_subject || null],
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// Fulfill someone's deposit with one of my books that matches their wish.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const db = getDb();
  const { deposit_id, offered_book_id } = await req.json();

  const depRes = await db.execute({
    sql: `SELECT g.*, b.available FROM gts_deposits g JOIN books b ON g.book_id = b.id WHERE g.id = ? AND g.status = 'open'`,
    args: [Number(deposit_id)],
  });
  const dep = depRes.rows[0] as any;
  if (!dep || Number(dep.available) !== 1) return NextResponse.json({ error: 'deposit_gone' }, { status: 400 });
  if (Number(dep.user_id) === user.id) return NextResponse.json({ error: 'own_deposit' }, { status: 400 });

  const myBook = await getFreeOwnedBook(user.id, Number(offered_book_id));
  if (!myBook) return NextResponse.json({ error: 'book_unavailable' }, { status: 400 });

  // My book must satisfy the depositor's wish. A wanted title is strict:
  // only that exact book (or its Thai/English variant of the same catalog
  // entry) can complete the trade.
  if (dep.wanted_title && !titlesMatch(String(dep.wanted_title), String(myBook.title ?? ''))) {
    return NextResponse.json({ error: 'not_a_match' }, { status: 400 });
  }
  if (dep.wanted_subject && myBook.subject !== dep.wanted_subject) {
    return NextResponse.json({ error: 'not_a_match' }, { status: 400 });
  }

  const tradeId = await createInstantTrade(user.id, Number(dep.user_id), Number(offered_book_id), Number(dep.book_id), 'GTS');
  await db.execute({
    sql: "UPDATE gts_deposits SET status = 'completed', matched_trade_id = ? WHERE id = ?",
    args: [tradeId, Number(deposit_id)],
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const id = new URL(req.url).searchParams.get('id');
  await getDb().execute({
    sql: "DELETE FROM gts_deposits WHERE id = ? AND user_id = ? AND status = 'open'",
    args: [Number(id), user.id],
  });
  return NextResponse.json({ ok: true });
}
