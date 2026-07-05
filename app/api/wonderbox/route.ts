import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables, getFreeOwnedBook, runWonderBoxMatcher, PLAN } from '@/lib/hub';

export const runtime = 'nodejs';

async function myBox(userId: number) {
  const db = getDb();
  const res = await db.execute({
    sql: `
      SELECT wb.id, wb.status, wb.created_at,
        b.title AS my_title, b.cover_color AS my_color, b.cover_url AS my_cover_url,
        CASE WHEN wb.status IN ('matched','received') THEN
          CASE WHEN t.requester_id = ? THEN wt.title ELSE ot.title END
        END AS received_title,
        CASE WHEN wb.status IN ('matched','received') THEN
          CASE WHEN t.requester_id = ? THEN wt.cover_color ELSE ot.cover_color END
        END AS received_color,
        CASE WHEN wb.status IN ('matched','received') THEN
          CASE WHEN t.requester_id = ? THEN wt.cover_url ELSE ot.cover_url END
        END AS received_cover_url,
        CASE WHEN wb.status IN ('matched','received') THEN
          CASE WHEN t.requester_id = ? THEN ou.name ELSE ru.name END
        END AS received_from
      FROM wonder_box wb
      JOIN books b ON wb.book_id = b.id
      LEFT JOIN trades t ON wb.matched_trade_id = t.id
      LEFT JOIN books ot ON t.offered_book_id = ot.id
      LEFT JOIN books wt ON t.wanted_book_id = wt.id
      LEFT JOIN users ru ON t.requester_id = ru.id
      LEFT JOIN users ou ON t.owner_id = ou.id
      WHERE wb.user_id = ? AND wb.status != 'received'
      ORDER BY wb.created_at
    `,
    args: [userId, userId, userId, userId, userId],
  });
  return res.rows;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  await runWonderBoxMatcher();
  return NextResponse.json({ deposits: await myBox(user.id), slots: PLAN.wonderBoxSlots });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();

  const { book_id } = await req.json();
  const db = getDb();

  const active = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM wonder_box WHERE user_id = ? AND status IN ('waiting','matched')",
    args: [user.id],
  });
  if (Number(active.rows[0].n) >= PLAN.wonderBoxSlots) {
    return NextResponse.json({ error: 'box_full' }, { status: 400 });
  }

  const book = await getFreeOwnedBook(user.id, Number(book_id));
  if (!book) return NextResponse.json({ error: 'book_unavailable' }, { status: 400 });

  await db.execute({ sql: 'INSERT INTO wonder_box (user_id, book_id) VALUES (?, ?)', args: [user.id, Number(book_id)] });
  await runWonderBoxMatcher();
  return NextResponse.json({ deposits: await myBox(user.id), slots: PLAN.wonderBoxSlots }, { status: 201 });
}

// Receive all matched trades (reveals the books you got).
export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const db = getDb();
  const matched = await myBox(user.id);
  const received = matched.filter((d: any) => d.status === 'matched');
  await db.execute({
    sql: "UPDATE wonder_box SET status = 'received' WHERE user_id = ? AND status = 'matched'",
    args: [user.id],
  });
  return NextResponse.json({ received, deposits: await myBox(user.id), slots: PLAN.wonderBoxSlots });
}

// Withdraw a waiting deposit.
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const id = new URL(req.url).searchParams.get('id');
  const db = getDb();
  await db.execute({
    sql: "DELETE FROM wonder_box WHERE id = ? AND user_id = ? AND status = 'waiting'",
    args: [Number(id), user.id],
  });
  return NextResponse.json({ deposits: await myBox(user.id), slots: PLAN.wonderBoxSlots });
}
