import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureBookColumns, ensureUserColumns } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { isBanned } from '@/lib/hub';

// Public profile of a user + their available books (requires being logged in).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // A ban applies to reading too: the session cookie is signed rather than
  // stored, so it stays valid until it expires unless something checks.
  if (await isBanned(me.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });

  const { id } = await params;
  const db = getDb();
  await ensureBookColumns();
  await ensureUserColumns();

  const u = await db.execute({ sql: 'SELECT id, name, grade, class_no, contact, avatar_color, banned FROM users WHERE id = ?', args: [id] });
  const user = u.rows[0];
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // A suspended student is out of circulation: their books are already hidden
  // from browsing and offers for them are refused, but their profile could
  // still be opened by anyone with the link — and it lists those same books
  // with a button to offer for them. The admin still needs to see it.
  if (Number(user.banned) === 1 && !isAdmin(me)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  delete (user as Record<string, unknown>).banned;

  // Everything except the cover itself. Covers are data URLs on the row, so
  // "SELECT b.*" put every picture into the reply — opening a classmate who
  // lists forty books came to 1.7MB, downloaded again every time anybody looked
  // at them. The length is enough for the page to build a URL per cover and let
  // the browser keep it.
  const books = await db.execute({
    sql: `SELECT b.id, b.owner_id, b.title, b.title_en, b.price, b.volume, b.publisher,
            b.author, b.subject, b.grade_level, b.condition, b.description,
            b.cover_color, b.available, b.created_at, b.isbn, b.cover_source,
            length(b.cover_url) AS cover_len,
            u.name as owner_name, u.avatar_color as owner_avatar_color, u.grade as owner_grade
          FROM books b JOIN users u ON b.owner_id = u.id
          WHERE b.owner_id = ? AND b.available = 1 AND b.deleted_at IS NULL
          ORDER BY b.created_at DESC`,
    args: [id],
  });

  return NextResponse.json({ user, books: books.rows, isMe: Number(user.id) === me.id });
}
