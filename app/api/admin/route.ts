import { NextResponse } from 'next/server';
import { getDb, ensureBookColumns, ensureUserColumns, ensureTradeColumns } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { ensureHubTables } from '@/lib/hub';

export const runtime = 'nodejs';

// Site data overview for the admin (users, books, trades, activity).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await ensureBookColumns();
  await ensureUserColumns();
  await ensureTradeColumns();
  await ensureHubTables();
  const db = getDb();

  const [users, books, trades, wonderbox, messages] = await Promise.all([
    db.execute(`SELECT id, name, real_name, email, grade, class_no, contact, availability, created_at,
                  (SELECT COUNT(*) FROM books b WHERE b.owner_id = users.id) AS books_count,
                  (SELECT COUNT(*) FROM trades t WHERE (t.requester_id = users.id OR t.owner_id = users.id) AND t.status = 'completed') AS trades_completed
                FROM users ORDER BY id`),
    db.execute(`SELECT b.id, b.title, b.title_en, b.author, b.subject, b.condition, b.price, b.available, b.created_at,
                  u.name AS owner_name
                FROM books b JOIN users u ON b.owner_id = u.id ORDER BY b.id DESC LIMIT 200`),
    db.execute(`SELECT t.id, t.status, t.message, t.created_at, t.updated_at,
                  ru.name AS requester_name, ou.name AS owner_name,
                  ob.title AS offered_title, wb.title AS wanted_title
                FROM trades t
                JOIN users ru ON t.requester_id = ru.id
                JOIN users ou ON t.owner_id = ou.id
                JOIN books ob ON t.offered_book_id = ob.id
                JOIN books wb ON t.wanted_book_id = wb.id
                ORDER BY t.id DESC LIMIT 200`),
    db.execute(`SELECT wb.id, wb.status, wb.created_at, u.name AS user_name, b.title
                FROM wonder_box wb JOIN users u ON wb.user_id = u.id JOIN books b ON wb.book_id = b.id
                ORDER BY wb.id DESC LIMIT 100`),
    db.execute(`SELECT m.id, m.kind, m.body, m.created_at, u.name AS user_name
                FROM messages m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.id DESC LIMIT 100`),
  ]);

  return NextResponse.json({
    stats: {
      users: users.rows.length,
      books: (await db.execute('SELECT COUNT(*) AS n FROM books')).rows[0].n,
      trades: (await db.execute('SELECT COUNT(*) AS n FROM trades')).rows[0].n,
      completed: (await db.execute("SELECT COUNT(*) AS n FROM trades WHERE status = 'completed'")).rows[0].n,
      messages: (await db.execute('SELECT COUNT(*) AS n FROM messages')).rows[0].n,
    },
    users: users.rows,
    books: books.rows,
    trades: trades.rows,
    wonderbox: wonderbox.rows,
    messages: messages.rows,
  });
}
