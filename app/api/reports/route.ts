import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables } from '@/lib/hub';
import { tooManyRecent } from '@/lib/ratelimit';

export const runtime = 'nodejs';

// A student reports a book listing or another user.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();

  const body = await req.json().catch(() => ({}));
  const type = body.target_type === 'user' ? 'user' : body.target_type === 'book' ? 'book' : null;
  const targetId = Number(body.target_id);
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (!type || !targetId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  // Anti-abuse: at most 10 reports per minute.
  if (await tooManyRecent('reports', 'reporter_id', user.id, 60, 10)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const db = getDb();
  // One open report per reporter+target keeps the queue clean.
  const existing = await db.execute({
    sql: "SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open' LIMIT 1",
    args: [user.id, type, targetId],
  });
  if (existing.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)',
      args: [user.id, type, targetId, reason || null],
    });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
