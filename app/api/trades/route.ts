import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureBookColumns, ensureUserColumns, ensureTradeColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { priceDiffOk, isBookBusy, ensureHubTables } from '@/lib/hub';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  await ensureBookColumns();
  await ensureUserColumns();
  await ensureTradeColumns();
  const result = await db.execute({
    sql: `
      SELECT t.*,
        rb.title as offered_title, rb.title_en as offered_title_en, rb.author as offered_author, rb.condition as offered_condition, rb.cover_color as offered_color, rb.cover_url as offered_cover_url,
        wb.title as wanted_title, wb.title_en as wanted_title_en, wb.author as wanted_author, wb.condition as wanted_condition, wb.cover_color as wanted_color, wb.cover_url as wanted_cover_url,
        ru.name as requester_name, ru.avatar_color as requester_avatar, ru.availability as requester_availability, ru.contact as requester_contact,
        ou.name as owner_name, ou.avatar_color as owner_avatar, ou.availability as owner_availability, ou.contact as owner_contact
      FROM trades t
      JOIN books rb ON t.offered_book_id = rb.id
      JOIN books wb ON t.wanted_book_id = wb.id
      JOIN users ru ON t.requester_id = ru.id
      JOIN users ou ON t.owner_id = ou.id
      WHERE t.requester_id = ? OR t.owner_id = ?
      ORDER BY t.created_at DESC
    `,
    args: [user.id, user.id],
  });

  return NextResponse.json({ trades: result.rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { offered_book_id, wanted_book_id, message } = await req.json();
  if (!offered_book_id || !wanted_book_id) {
    return NextResponse.json({ error: 'Both books required' }, { status: 400 });
  }

  const db = getDb();
  await ensureHubTables();
  const offered = await db.execute({ sql: 'SELECT * FROM books WHERE id = ? AND owner_id = ?', args: [offered_book_id, user.id] });
  const offeredBook = offered.rows[0] as any;
  if (!offeredBook) return NextResponse.json({ error: 'You do not own this book' }, { status: 400 });

  const wanted = await db.execute({ sql: 'SELECT * FROM books WHERE id = ? AND available = 1', args: [wanted_book_id] });
  const wantedBook = wanted.rows[0] as any;
  if (!wantedBook) return NextResponse.json({ error: 'Book not available' }, { status: 400 });

  if (Number(wantedBook.owner_id) === user.id) {
    return NextResponse.json({ error: 'Cannot trade with yourself' }, { status: 400 });
  }

  // Neither book may already be committed to another trade avenue (e.g. Wonder Box).
  if (await isBookBusy(Number(offered_book_id)) || await isBookBusy(Number(wanted_book_id))) {
    return NextResponse.json({ error: 'book_busy' }, { status: 400 });
  }

  if (!priceDiffOk(offeredBook.price, wantedBook.price)) {
    return NextResponse.json({ error: 'price_gap' }, { status: 400 });
  }

  const result = await db.execute({
    sql: 'INSERT INTO trades (requester_id, owner_id, offered_book_id, wanted_book_id, message) VALUES (?, ?, ?, ?, ?)',
    args: [user.id, Number(wantedBook.owner_id), offered_book_id, wanted_book_id, message ?? null],
  });

  return NextResponse.json({ trade: { id: Number(result.lastInsertRowid) } }, { status: 201 });
}
