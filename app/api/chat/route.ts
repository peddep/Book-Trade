import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables, isBanned } from '@/lib/hub';

export const runtime = 'nodejs';

const MAX_LEN = 500;

// Returns the most recent messages (chat + trade announcements), oldest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT m.id, m.user_id, m.kind, m.body, m.created_at,
                 u.name AS user_name, u.avatar_color AS user_avatar
          FROM messages m
          LEFT JOIN users u ON m.user_id = u.id
          ORDER BY m.id DESC
          LIMIT 60`,
    args: [],
  });
  return NextResponse.json({ messages: res.rows.reverse(), me: user.id });
}

// Posts a chat message from the signed-in user.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  if (await isBanned(user.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, MAX_LEN) : '';
  if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const db = getDb();
  await db.execute({
    sql: "INSERT INTO messages (user_id, kind, body) VALUES (?, 'chat', ?)",
    args: [user.id, text],
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
