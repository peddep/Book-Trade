import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables, isBanned } from '@/lib/hub';
import { tooManyRecent } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const MAX_LEN = 1000;

// A student sends a suggestion or reports a bug. Read back only by the admin,
// from the admin dashboard.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  if (await isBanned(user.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });

  // Anti-flood: at most 5 messages per 10 minutes.
  if (await tooManyRecent('feedback', 'user_id', user.id, 600, 5)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === 'bug' ? 'bug' : 'suggestion';
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, MAX_LEN) : '';
  if (text.length < 5) return NextResponse.json({ error: 'too_short' }, { status: 400 });

  await getDb().execute({
    sql: 'INSERT INTO feedback (user_id, kind, body) VALUES (?, ?, ?)',
    args: [user.id, kind, text],
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
