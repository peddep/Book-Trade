import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables, isBanned } from '@/lib/hub';
import { tooManyRecent } from '@/lib/ratelimit';

export const runtime = 'nodejs';

// Top donators (summed per user) — shown on the room page.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const db = getDb();
  const top = await db.execute(`
    SELECT u.id AS user_id, u.name, u.avatar_color, SUM(d.amount) AS total
    FROM donations d JOIN users u ON d.user_id = u.id
    GROUP BY d.user_id ORDER BY total DESC, MAX(d.created_at) DESC LIMIT 5
  `);
  return NextResponse.json({ top: top.rows });
}

// A student pledges a donation (name on the transferring account + amount).
// It appears on the donator list and in the community chat right away; the
// admin verifies it later against the actual bank statement.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  if (await isBanned(user.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });
  if (await tooManyRecent('donations', 'user_id', user.id, 300, 3)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const bankName = typeof body.bank_name === 'string' ? body.bank_name.trim().slice(0, 100) : '';
  const amount = Number(body.amount);
  if (!bankName || !isFinite(amount) || amount <= 0 || amount > 100000) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const db = getDb();
  await db.execute({
    sql: 'INSERT INTO donations (user_id, bank_name, amount) VALUES (?, ?, ?)',
    args: [user.id, bankName, amount],
  });
  // Celebrate in the community chat.
  await db.execute({
    sql: "INSERT INTO messages (user_id, kind, body) VALUES (NULL, 'announcement', ?)",
    args: [`💜 ${user.name} สนับสนุนเว็บ ฿${amount} ขอบคุณครับ!`],
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
