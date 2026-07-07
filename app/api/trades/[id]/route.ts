import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureTradeColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const found = await db.execute({ sql: 'SELECT * FROM trades WHERE id = ?', args: [id] });
  const trade = found.rows[0] as any;
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isRequester = Number(trade.requester_id) === user.id;
  const isOwner = Number(trade.owner_id) === user.id;
  if (!isRequester && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ── IRL meet-up confirmation: each side reports happened / not ──
  if (body.confirm === 'happened' || body.confirm === 'not') {
    await ensureTradeColumns();
    if (trade.status !== 'accepted') {
      return NextResponse.json({ error: 'Trade is not in progress' }, { status: 400 });
    }

    const col = isRequester ? 'requester_confirm' : 'owner_confirm';
    await db.execute({
      sql: `UPDATE trades SET ${col} = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [body.confirm, id],
    });

    const rConfirm = isRequester ? body.confirm : trade.requester_confirm;
    const oConfirm = isOwner ? body.confirm : trade.owner_confirm;

    // Either side says it didn't happen → cancel and return the books.
    if (rConfirm === 'not' || oConfirm === 'not') {
      await db.execute({ sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", args: [id] });
      await db.execute({
        sql: 'UPDATE books SET available = 1 WHERE id = ? OR id = ?',
        args: [Number(trade.offered_book_id), Number(trade.wanted_book_id)],
      });
    } else if (rConfirm === 'happened' && oConfirm === 'happened') {
      // Both confirmed → the trade is complete.
      await db.execute({ sql: "UPDATE trades SET status = 'completed', updated_at = datetime('now') WHERE id = ?", args: [id] });
    }

    return NextResponse.json({ ok: true });
  }

  // ── Regular status changes (accept / reject / cancel a pending offer) ──
  const { status } = body;
  if (!['accepted', 'rejected', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  if (status === 'cancelled' && !isRequester) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if ((status === 'accepted' || status === 'rejected') && !isOwner) {
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
