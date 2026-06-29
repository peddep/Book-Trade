import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (!['accepted', 'rejected', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const db = getDb();
  const found = await db.execute({ sql: 'SELECT * FROM trades WHERE id = ?', args: [id] });
  const trade = found.rows[0] as any;
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (status === 'cancelled' && Number(trade.requester_id) !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if ((status === 'accepted' || status === 'rejected') && Number(trade.owner_id) !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.execute({ sql: "UPDATE trades SET status = ?, updated_at = datetime('now') WHERE id = ?", args: [status, id] });

  if (status === 'accepted') {
    await db.execute({
      sql: 'UPDATE books SET available = 0 WHERE id = ? OR id = ?',
      args: [Number(trade.offered_book_id), Number(trade.wanted_book_id)],
    });
    await db.execute({
      sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id != ? AND status = 'pending' AND (offered_book_id = ? OR wanted_book_id = ? OR offered_book_id = ? OR wanted_book_id = ?)",
      args: [id, Number(trade.offered_book_id), Number(trade.offered_book_id), Number(trade.wanted_book_id), Number(trade.wanted_book_id)],
    });
  }

  return NextResponse.json({ ok: true });
}
