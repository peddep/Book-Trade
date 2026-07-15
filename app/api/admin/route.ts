import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
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

  const [users, books, trades, wonderbox, messages, reports] = await Promise.all([
    db.execute(`SELECT id, name, real_name, email, grade, class_no, contact, availability, banned, created_at,
                  (SELECT COUNT(*) FROM books b WHERE b.owner_id = users.id) AS books_count,
                  (SELECT COUNT(*) FROM trades t WHERE (t.requester_id = users.id OR t.owner_id = users.id) AND t.status = 'completed') AS trades_completed
                FROM users ORDER BY id`),
    db.execute(`SELECT b.id, b.title, b.title_en, b.author, b.subject, b.condition, b.price, b.available, b.created_at,
                  b.cover_url, u.name AS owner_name
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
    db.execute(`SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
                  ru.name AS reporter_name,
                  CASE WHEN r.target_type = 'book' THEN bk.title ELSE tu.name END AS target_label
                FROM reports r
                JOIN users ru ON r.reporter_id = ru.id
                LEFT JOIN books bk ON r.target_type = 'book' AND r.target_id = bk.id
                LEFT JOIN users tu ON r.target_type = 'user' AND r.target_id = tu.id
                ORDER BY (r.status = 'open') DESC, r.id DESC LIMIT 200`),
  ]);

  return NextResponse.json({
    stats: {
      users: users.rows.length,
      books: (await db.execute('SELECT COUNT(*) AS n FROM books')).rows[0].n,
      trades: (await db.execute('SELECT COUNT(*) AS n FROM trades')).rows[0].n,
      completed: (await db.execute("SELECT COUNT(*) AS n FROM trades WHERE status = 'completed'")).rows[0].n,
      messages: (await db.execute('SELECT COUNT(*) AS n FROM messages')).rows[0].n,
      openReports: (await db.execute("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'")).rows[0].n,
    },
    users: users.rows,
    books: books.rows,
    trades: trades.rows,
    wonderbox: wonderbox.rows,
    messages: messages.rows,
    reports: reports.rows,
  });
}

// Admin actions. Currently: reset a user's password to a temporary one that
// the admin hands to the student in person.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  // Delete a book listing (and any pending trades / wonder-box deposits it's in).
  if (body.action === 'delete_book' && body.book_id) {
    const db = getDb();
    const id = Number(body.book_id);
    await db.execute({ sql: "DELETE FROM trades WHERE (offered_book_id = ? OR wanted_book_id = ?) AND status IN ('pending','accepted')", args: [id, id] });
    await db.execute({ sql: 'DELETE FROM wonder_box WHERE book_id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [id] });
    return NextResponse.json({ ok: true });
  }

  // Ban / unban a user. A banned user can't log in or post; the admin can't ban themselves.
  if ((body.action === 'ban_user' || body.action === 'unban_user') && body.user_id) {
    const id = Number(body.user_id);
    if (id === user.id) return NextResponse.json({ error: 'cannot_ban_self' }, { status: 400 });
    await ensureUserColumns();
    await getDb().execute({ sql: 'UPDATE users SET banned = ? WHERE id = ?', args: [body.action === 'ban_user' ? 1 : 0, id] });
    return NextResponse.json({ ok: true });
  }

  // Mark a report as resolved.
  if (body.action === 'resolve_report' && body.report_id) {
    await getDb().execute({ sql: "UPDATE reports SET status = 'resolved' WHERE id = ?", args: [Number(body.report_id)] });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'reset_password' && body.user_id) {
    const db = getDb();
    const target = await db.execute({ sql: 'SELECT id, name FROM users WHERE id = ?', args: [Number(body.user_id)] });
    if (!target.rows.length) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 chars
    const hash = await bcrypt.hash(tempPassword, 10);
    await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [hash, Number(body.user_id)] });
    return NextResponse.json({ ok: true, name: target.rows[0].name, password: tempPassword });
  }

  // Bulk-add titles to the suggestion catalog. One book per line, optionally
  // "title | author" (or comma-separated). Duplicates are ignored.
  if (body.action === 'add_catalog' && typeof body.lines === 'string') {
    const db = getDb();
    await db.execute(`CREATE TABLE IF NOT EXISTS catalog_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      author TEXT,
      publisher TEXT,
      source TEXT DEFAULT 'harvest',
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    let inserted = 0;
    let skipped = 0;
    const lines = body.lines.split('\n').map((l: string) => l.trim()).filter(Boolean).slice(0, 500);
    for (const line of lines) {
      const sep = line.includes('|') ? '|' : line.includes(',') ? ',' : null;
      const [rawTitle, rawAuthor] = sep ? [line.slice(0, line.indexOf(sep)), line.slice(line.indexOf(sep) + 1)] : [line, ''];
      const title = rawTitle.trim();
      const author = rawAuthor.trim() || null;
      if (!title || title.length < 2) { skipped++; continue; }
      const r = await db.execute({
        sql: "INSERT OR IGNORE INTO catalog_books (title, author, source) VALUES (?, ?, 'admin')",
        args: [title, author],
      });
      if (Number(r.rowsAffected) > 0) inserted++; else skipped++;
    }
    return NextResponse.json({ ok: true, inserted, skipped });
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
