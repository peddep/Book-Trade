import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureBookColumns, ensureUserColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
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

  const u = await db.execute({ sql: 'SELECT id, name, grade, class_no, contact, avatar_color FROM users WHERE id = ?', args: [id] });
  const user = u.rows[0];
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const books = await db.execute({
    sql: `SELECT b.*, u.name as owner_name, u.avatar_color as owner_avatar_color, u.grade as owner_grade
          FROM books b JOIN users u ON b.owner_id = u.id
          WHERE b.owner_id = ? AND b.available = 1 ORDER BY b.created_at DESC`,
    args: [id],
  });

  return NextResponse.json({ user, books: books.rows, isMe: Number(user.id) === me.id });
}
