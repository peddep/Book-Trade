import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureBookColumns, ensureUserColumns, ensureTradeColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { priceDiffOk, isBookBusy, ensureHubTables, isBanned } from '@/lib/hub';
import { tooManyRecent } from '@/lib/ratelimit';
import { notify } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // A ban applies to reading too: the session cookie is signed rather than
  // stored, so it stays valid until it expires unless something checks.
  if (await isBanned(user.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });

  const db = getDb();

  // Badges and stat tiles only need counts. They used to pull the full list —
  // six joins and every trade the student has ever been in — on every page
  // they opened, to render one or two numbers.
  if (new URL(req.url).searchParams.get('counts') === '1') {
    await ensureTradeColumns();
    const c = await db.execute({
      sql: `SELECT
              SUM(CASE WHEN owner_id = ? AND status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted
            FROM trades WHERE requester_id = ? OR owner_id = ?`,
      args: [user.id, user.id, user.id],
    });
    const row = c.rows[0] as any;
    return NextResponse.json({ pending: Number(row.pending ?? 0), accepted: Number(row.accepted ?? 0) });
  }

  await Promise.all([ensureBookColumns(), ensureUserColumns(), ensureTradeColumns()]);

  // A page can ask for only the statuses it shows. The meet-up page lists
  // agreed trades; its history is a separate tab most students never open, and
  // sending years of finished trades to draw a list of this week's meet-ups is
  // most of the wait before that page appears.
  const ALLOWED = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];
  const wanted = (new URL(req.url).searchParams.get('status') ?? '')
    .split(',').map(s => s.trim()).filter(s => ALLOWED.includes(s));
  const statusFilter = wanted.length ? ` AND t.status IN (${wanted.map(() => '?').join(', ')})` : '';

  const result = await db.execute({
    sql: `
      SELECT t.*,
        rb.title as offered_title, rb.title_en as offered_title_en, rb.author as offered_author, rb.condition as offered_condition, rb.cover_color as offered_color,
        wb.title as wanted_title, wb.title_en as wanted_title_en, wb.author as wanted_author, wb.condition as wanted_condition, wb.cover_color as wanted_color,
        -- Covers are data URLs on the book row, and a trade names two books, so
        -- sending them inline put two whole photographs into every trade: thirty
        -- trades came to 2.5MB of JSON, fetched again every time the page opened.
        -- The length is enough for the page to build a URL the browser can keep.
        length(rb.cover_url) AS offered_cover_len,
        length(wb.cover_url) AS wanted_cover_len,
        ru.name as requester_name, ru.avatar_color as requester_avatar, ru.contact as requester_contact,
        ru.grade as requester_grade, ru.class_no as requester_class,
        ou.name as owner_name, ou.avatar_color as owner_avatar, ou.contact as owner_contact,
        ou.grade as owner_grade, ou.class_no as owner_class
      FROM trades t
      JOIN books rb ON t.offered_book_id = rb.id
      JOIN books wb ON t.wanted_book_id = wb.id
      JOIN users ru ON t.requester_id = ru.id
      JOIN users ou ON t.owner_id = ou.id
      WHERE (t.requester_id = ? OR t.owner_id = ?)${statusFilter}
      ORDER BY t.created_at DESC
    `,
    args: [user.id, user.id, ...wanted],
  });

  return NextResponse.json({ trades: result.rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (await isBanned(user.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });
  // Anti-flood: at most 15 trade offers per minute.
  if (await tooManyRecent('trades', 'requester_id', user.id, 60, 15)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

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

  // The other student is suspended: they cannot accept, so the offer would sit
  // there unanswered. Their books are hidden from browsing, but a page loaded
  // before the suspension would still have them on screen.
  if (await isBanned(Number(wantedBook.owner_id))) {
    return NextResponse.json({ error: 'owner_unavailable' }, { status: 400 });
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

  // The owner is almost certainly not looking at the site right now.
  await notify(Number(wantedBook.owner_id), 'trade_offer', {
    actor: user.name,
    subject: String(wantedBook.title),
    link: '/trades',
  });

  return NextResponse.json({ trade: { id: Number(result.lastInsertRowid) } }, { status: 201 });
}
