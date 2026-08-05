import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables } from '@/lib/hub';

export const runtime = 'nodejs';

// The signed-in student's own notifications, newest first, plus how many are
// unread so the bell can show a count.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const db = getDb();
  try {
    const [rows, unread] = await Promise.all([
      db.execute({
        sql: 'SELECT id, kind, actor, subject, link, read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30',
        args: [user.id],
      }),
      db.execute({ sql: 'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0', args: [user.id] }),
    ]);
    return NextResponse.json({ notifications: rows.rows, unread: Number(unread.rows[0].n) || 0 });
  } catch {
    return NextResponse.json({ notifications: [], unread: 0 });
  }
}

// Mark one as read, or all of them. Scoped to the caller's own rows, so an id
// belonging to someone else matches nothing.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const body = await req.json().catch(() => ({}));
  const db = getDb();

  if (body.id) {
    await db.execute({ sql: 'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', args: [Number(body.id), user.id] });
    return NextResponse.json({ ok: true });
  }
  if (body.all) {
    await db.execute({ sql: 'UPDATE notifications SET read = 1 WHERE user_id = ?', args: [user.id] });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'bad_request' }, { status: 400 });
}
