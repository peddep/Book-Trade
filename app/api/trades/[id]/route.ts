import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureTradeColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { announceTrade, isBanned, priceDiffOk } from '@/lib/hub';
import { notify, notifyBoth } from '@/lib/notify';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // A suspended student stops trading here too. Making an offer was already
  // refused, but this is where a trade is agreed and where books actually
  // change hands — so without this a banned account could still accept an
  // offer and complete the swap, which is most of what trading is.
  if (await isBanned(user.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });

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
      // Never move a book that has since left the hands it was promised from.
      // Accepting locks both books, so this should be unreachable — but the
      // swap below writes owner_id unconditionally, and that is far too blunt
      // an operation to run on an assumption.
      const still = await db.execute({
        sql: 'SELECT id, owner_id FROM books WHERE id IN (?, ?)',
        args: [Number(trade.offered_book_id), Number(trade.wanted_book_id)],
      });
      const owners = new Map(still.rows.map((r: any) => [Number(r.id), Number(r.owner_id)]));
      if (
        owners.get(Number(trade.offered_book_id)) !== Number(trade.requester_id) ||
        owners.get(Number(trade.wanted_book_id)) !== Number(trade.owner_id)
      ) {
        await db.execute({ sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", args: [id] });
        return NextResponse.json({ error: 'books_changed' }, { status: 409 });
      }

      // Both confirmed → the trade is complete; announce it in the community
      // chat. Only from 'accepted', and only once: both students tapping at the
      // same moment each see two confirmations, and without this they would
      // both run the swap and the trade would be announced twice.
      const finished = await db.execute({
        sql: "UPDATE trades SET status = 'completed', updated_at = datetime('now') WHERE id = ? AND status = 'accepted'",
        args: [id],
      });
      if (Number(finished.rowsAffected) !== 1) return NextResponse.json({ ok: true });
      // The physical books changed hands, so swap owners in the app too and
      // put both books back on the market on their new owners' shelves.
      await db.execute({
        sql: 'UPDATE books SET owner_id = ?, available = 1 WHERE id = ?',
        args: [Number(trade.owner_id), Number(trade.offered_book_id)],
      });
      await db.execute({
        sql: 'UPDATE books SET owner_id = ?, available = 1 WHERE id = ?',
        args: [Number(trade.requester_id), Number(trade.wanted_book_id)],
      });
      await announceTrade(Number(id));
      await notifyBoth(Number(trade.requester_id), Number(trade.owner_id), 'trade_completed', { link: '/trades' });
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

  // Which statuses each transition may start from. Without this a settled
  // trade could be moved back to 'accepted' months later and then confirmed
  // again — re-running the ownership swap on books that have since been traded
  // to somebody else, and taking them off that person's shelf.
  const CAN_MOVE_FROM: Record<string, string[]> = {
    accepted: ['pending'],
    rejected: ['pending'],
    // A requester may call off an offer before it is accepted, or back out of
    // an agreed meet-up they no longer want.
    cancelled: ['pending', 'accepted'],
  };
  if (!CAN_MOVE_FROM[status].includes(String(trade.status))) {
    return NextResponse.json({ error: 'stale_trade', status: trade.status }, { status: 409 });
  }

  // Accepting reserves both books, so check they are still there to reserve:
  // each must still belong to the side that put it up, and be free.
  if (status === 'accepted') {
    const state = await db.execute({
      sql: 'SELECT id, owner_id, available, price FROM books WHERE id IN (?, ?)',
      args: [Number(trade.offered_book_id), Number(trade.wanted_book_id)],
    });
    const byId = new Map(state.rows.map((r: any) => [Number(r.id), r]));
    const offeredNow = byId.get(Number(trade.offered_book_id)) as any;
    const wantedNow = byId.get(Number(trade.wanted_book_id)) as any;
    const usable = (b: any, expectedOwner: number) =>
      b && Number(b.owner_id) === expectedOwner && Number(b.available) === 1;
    if (!usable(offeredNow, Number(trade.requester_id)) || !usable(wantedNow, Number(trade.owner_id))) {
      await db.execute({ sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", args: [id] });
      return NextResponse.json({ error: 'books_changed' }, { status: 409 });
    }
    // The price rule is checked when the offer is made, so editing a book's
    // price afterwards would otherwise carry a trade past a limit it could
    // never have been created under.
    if (!priceDiffOk(offeredNow.price, wantedNow.price)) {
      return NextResponse.json({ error: 'price_gap' }, { status: 400 });
    }
  }

  const wasAccepted = String(trade.status) === 'accepted';

  // Move the trade only if it is still where it was a moment ago. The check
  // above reads the status and this writes it, and nothing holds the row in
  // between: two people pressing at the same instant — an owner accepting while
  // the requester withdraws — both read 'pending' and both wrote. Asking the
  // database to make the change only from the status we saw settles it for us,
  // and whoever loses is told the trade has moved on.
  const moved = await db.execute({
    sql: "UPDATE trades SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?",
    args: [status, id, String(trade.status)],
  });
  if (Number(moved.rowsAffected) !== 1) {
    const now = await db.execute({ sql: 'SELECT status FROM trades WHERE id = ?', args: [id] });
    return NextResponse.json({ error: 'stale_trade', status: now.rows[0]?.status ?? null }, { status: 409 });
  }

  // Backing out of an agreed trade has to release the books it was holding,
  // or both sit reserved forever with no trade left to complete them.
  if (status === 'cancelled' && wasAccepted) {
    await db.execute({
      sql: 'UPDATE books SET available = 1 WHERE id = ? OR id = ?',
      args: [Number(trade.offered_book_id), Number(trade.wanted_book_id)],
    });
  }

  // Agreeing to a trade takes both books off the market, and that is the step
  // two trades for the same book race over: each is a different row, so each
  // passes its own status check above, and the reservation below is where they
  // meet. Taking a book is asking the database to move it from free to spoken
  // for — only one of them can be the one that moved it. Whoever loses gives
  // back whatever they took and is told the books changed underneath them,
  // rather than a book being promised to two people.
  if (status === 'accepted') {
    const take = async (bookId: number, expectedOwner: number) => Number((await db.execute({
      sql: 'UPDATE books SET available = 0 WHERE id = ? AND owner_id = ? AND available = 1 AND deleted_at IS NULL',
      args: [bookId, expectedOwner],
    })).rowsAffected) === 1;

    const offeredId = Number(trade.offered_book_id);
    const wantedId = Number(trade.wanted_book_id);
    const gotOffered = await take(offeredId, Number(trade.requester_id));
    const gotWanted = gotOffered && await take(wantedId, Number(trade.owner_id));

    if (!gotOffered || !gotWanted) {
      if (gotOffered) {
        await db.execute({ sql: 'UPDATE books SET available = 1 WHERE id = ?', args: [offeredId] });
      }
      await db.execute({ sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", args: [id] });
      return NextResponse.json({ error: 'books_changed' }, { status: 409 });
    }

    // Both are held now, so the other offers for either book cannot be taken up.
    await db.execute({
      sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id != ? AND status = 'pending' AND (offered_book_id = ? OR wanted_book_id = ? OR offered_book_id = ? OR wanted_book_id = ?)",
      args: [id, offeredId, offeredId, wantedId, wantedId],
    });
  }

  // Tell whichever side did not press the button. Accept and reject are the
  // owner's doing, so the requester hears about them; a cancel is the
  // requester's, so the owner does. Only once the trade has actually moved —
  // telling somebody their offer was accepted and then calling it off because
  // the book had gone would be worse than not telling them yet.
  {
    const other = isRequester ? Number(trade.owner_id) : Number(trade.requester_id);
    const names = await db.execute({
      sql: `SELECT (SELECT name FROM users WHERE id = ?) AS actor,
                   (SELECT title FROM books WHERE id = ?) AS subject`,
      args: [user.id, Number(trade.wanted_book_id)],
    });
    const row = names.rows[0] as any;
    const kind = status === 'accepted' ? 'trade_accepted' : status === 'rejected' ? 'trade_rejected' : 'trade_cancelled';
    await notify(other, kind, {
      actor: row?.actor ? String(row.actor) : null,
      subject: row?.subject ? String(row.subject) : null,
      link: status === 'accepted' ? '/trade/irl' : '/trades',
    });
  }

  return NextResponse.json({ ok: true });
}
