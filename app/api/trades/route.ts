import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const result = await db.execute({
    sql: `
      SELECT t.*,
        rb.title as offered_title, rb.author as offered_author, rb.condition as offered_condition, rb.cover_color as offered_color,
        wb.title as wanted_title, wb.author as wanted_author, wb.condition as wanted_condition, wb.cover_color as wanted_color,
        ru.name as requester_name, ru.avatar_color as requester_avatar,
        ou.name as owner_name, ou.avatar_color as owner_avatar
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
  const offered = await db.execute({ sql: 'SELECT * FROM books WHERE id = ? AND owner_id = ?', args: [offered_book_id, user.id] });
  if (offered.rows.length === 0) return NextResponse.json({ error: 'You do not own this book' }, { status: 400 });

  const wanted = await db.execute({ sql: 'SELECT * FROM books WHERE id = ? AND available = 1', args: [wanted_book_id] });
  const wantedBook = wanted.rows[0] as any;
  if (!wantedBook) return NextResponse.json({ error: 'Book not available' }, { status: 400 });

  if (Number(wantedBook.owner_id) === user.id) {
    return NextResponse.json({ error: 'Cannot trade with yourself' }, { status: 400 });
  }

  const result = await db.execute({
    sql: 'INSERT INTO trades (requester_id, owner_id, offered_book_id, wanted_book_id, message) VALUES (?, ?, ?, ?, ?)',
    args: [user.id, Number(wantedBook.owner_id), offered_book_id, wanted_book_id, message ?? null],
  });

  return NextResponse.json({ trade: { id: Number(result.lastInsertRowid) } }, { status: 201 });
}
