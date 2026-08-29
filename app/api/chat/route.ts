import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { ensureHubTables, isBanned } from '@/lib/hub';
import { tooManyRecent } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const MAX_LEN = 500;

// Returns the most recent messages (chat + trade announcements), oldest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (await isBanned(user.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });
  await ensureHubTables();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT m.id, m.user_id, m.kind, m.body, m.created_at, m.edited_at,
                 u.name AS user_name, u.avatar_color AS user_avatar
          FROM messages m
          LEFT JOIN users u ON m.user_id = u.id
          ORDER BY m.id DESC
          LIMIT 60`,
    args: [],
  });
  // is_admin drives the moderation controls in the chat itself; every action
  // they reveal is re-checked server-side below.
  return NextResponse.json({ messages: res.rows.reverse(), me: user.id, is_admin: isAdmin(user) });
}

// Posts a chat message from the signed-in user.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  if (await isBanned(user.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });

  // Anti-flood: at most 5 messages per 10 seconds.
  if (await tooManyRecent('messages', 'user_id', user.id, 10, 5)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

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

// Admin moderation: fix or remove a message. Both re-check isAdmin rather than
// trusting the flag handed to the client.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureHubTables();

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, MAX_LEN) : '';
  if (!id || !text) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const db = getDb();
  const res = await db.execute({
    sql: "UPDATE messages SET body = ?, edited_at = datetime('now') WHERE id = ?",
    args: [text, id],
  });
  if (res.rowsAffected === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureHubTables();

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const res = await getDb().execute({ sql: 'DELETE FROM messages WHERE id = ?', args: [id] });
  if (res.rowsAffected === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
