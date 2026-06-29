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
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id) as any;
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (status === 'cancelled' && trade.requester_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if ((status === 'accepted' || status === 'rejected') && trade.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  db.prepare("UPDATE trades SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);

  if (status === 'accepted') {
    db.prepare('UPDATE books SET available = 0 WHERE id = ? OR id = ?').run(trade.offered_book_id, trade.wanted_book_id);
    db.prepare("UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id != ? AND status = 'pending' AND (offered_book_id = ? OR wanted_book_id = ? OR offered_book_id = ? OR wanted_book_id = ?)")
      .run(id, trade.offered_book_id, trade.offered_book_id, trade.wanted_book_id, trade.wanted_book_id);
  }

  return NextResponse.json({ ok: true });
}
