import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureTradeColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { announceTrade, isBanned, priceDiffOk, assignMeetingSlot, sweepWaitingMeetings, bangkokInstantOf } from '@/lib/hub';
import type { Period } from '@/lib/meetingSlots';
import { notify, notifyBoth } from '@/lib/notify';
import type { TradeRow } from '@/lib/dbTypes';

// Called whenever a trade that held a library slot stops holding it (it
// moved on, or the trade itself ended) — someone else may have been waiting
// on that exact period with nowhere to go until now.
async function notifyFreedSlot() {
  const resolved = await sweepWaitingMeetings();
  await Promise.all(resolved.map(r =>
    notifyBoth(r.requesterId, r.ownerId, 'trade_meeting_ready', { link: '/trade/irl' })
  ));
}

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
  const trade = found.rows[0] as unknown as TradeRow | undefined;
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isRequester = Number(trade.requester_id) === user.id;
  const isOwner = Number(trade.owner_id) === user.id;
  if (!isRequester && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ── "I cannot make that period" → move to their next shared one ──
  //
  // The server already knows this pair's current appointment (or that they
  // are waiting for one), so all the client sends is "move me on" — it no
  // longer has to say from when, which is one less thing that could disagree
  // with what the server actually has stored.
  if (body.skip_meeting === true) {
    await ensureTradeColumns();
    if (trade.status !== 'accepted') {
      return NextResponse.json({ error: 'Trade is not in progress' }, { status: 400 });
    }
    const hadSlot = Boolean(trade.meeting_date && trade.meeting_period);
    const from = hadSlot
      ? bangkokInstantOf(String(trade.meeting_date), trade.meeting_period as Period, Number(trade.meeting_sub ?? 0))
      : new Date();
    const users = await db.execute({
      sql: 'SELECT id, availability FROM users WHERE id IN (?, ?)',
      args: [Number(trade.requester_id), Number(trade.owner_id)],
    });
    const availById = new Map(
      users.rows.map(r => [Number((r as unknown as { id: number }).id), (r as unknown as { availability: string | null }).availability])
    );
    const assignment = await assignMeetingSlot(
      availById.get(Number(trade.requester_id)),
      availById.get(Number(trade.owner_id)),
      from,
    );
    await db.execute({
      sql: 'UPDATE trades SET meeting_date = ?, meeting_period = ?, meeting_sub = ?, updated_at = datetime(\'now\') WHERE id = ?',
      args: [assignment?.date ?? null, assignment?.period ?? null, assignment?.sub ?? null, id],
    });

    // The other student is expecting to stand in the library at that period.
    const other = isRequester ? Number(trade.owner_id) : Number(trade.requester_id);
    await notify(other, 'trade_postponed', { actor: user.name, link: '/trade/irl' });
    // This pair's old slot (if they had one) just freed up for whoever else
    // was waiting on that same period.
    if (hadSlot) await notifyFreedSlot();
    return NextResponse.json({ ok: true, meeting: assignment });
  }

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
      // The other student had a meet-up in their week and two books held for
      // it; they were told none of this before, and would have found out by
      // noticing the trade had quietly gone.
      const other = isRequester ? Number(trade.owner_id) : Number(trade.requester_id);
      await notify(other, body.reason === 'no_show' ? 'trade_no_show' : 'trade_cancelled',
        { actor: user.name, link: '/trades' });
      // Whatever library slot this pair held (if any) is free again.
      if (trade.meeting_date) await notifyFreedSlot();
    } else if (rConfirm === 'happened' && oConfirm === 'happened') {
      // Never move a book that has since left the hands it was promised from.
      // Accepting locks both books, so this should be unreachable — but the
      // swap below writes owner_id unconditionally, and that is far too blunt
      // an operation to run on an assumption.
      const still = await db.execute({
        sql: 'SELECT id, owner_id FROM books WHERE id IN (?, ?)',
        args: [Number(trade.offered_book_id), Number(trade.wanted_book_id)],
      });
      const owners = new Map(still.rows.map((r) => [Number((r as unknown as { id: number }).id), Number((r as unknown as { owner_id: number }).owner_id)]));
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
      // The slot this pair used is free for the next appointment now.
      if (trade.meeting_date) await notifyFreedSlot();
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
    type BookState = { id: number; owner_id: number; available: number; price: number | null };
    const byId = new Map(state.rows.map((r) => {
      const row = r as unknown as BookState;
      return [Number(row.id), row] as const;
    }));
    const offeredNow = byId.get(Number(trade.offered_book_id));
    const wantedNow = byId.get(Number(trade.wanted_book_id));
    const usable = (b: BookState | undefined, expectedOwner: number) =>
      b && Number(b.owner_id) === expectedOwner && Number(b.available) === 1;
    if (!usable(offeredNow, Number(trade.requester_id)) || !usable(wantedNow, Number(trade.owner_id))) {
      await db.execute({ sql: "UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", args: [id] });
      return NextResponse.json({ error: 'books_changed' }, { status: 409 });
    }
    // The price rule is checked when the offer is made, so editing a book's
    // price afterwards would otherwise carry a trade past a limit it could
    // never have been created under.
    if (!priceDiffOk(offeredNow?.price, wantedNow?.price)) {
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
    if (trade.meeting_date) await notifyFreedSlot();
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

    // Same class → they see each other in class anyway, so swap there instead
    // of spending one of the library's two slots on a pair that never needed
    // the room. Everyone else gets an actual appointment.
    const pairInfo = await db.execute({
      sql: 'SELECT id, grade, class_no, availability FROM users WHERE id IN (?, ?)',
      args: [Number(trade.requester_id), Number(trade.owner_id)],
    });
    type PairRow = { id: number; grade: string | null; class_no: string | null; availability: string | null };
    const byUserId = new Map(pairInfo.rows.map(r => {
      const row = r as unknown as PairRow;
      return [Number(row.id), row] as const;
    }));
    const reqInfo = byUserId.get(Number(trade.requester_id));
    const ownInfo = byUserId.get(Number(trade.owner_id));
    const sameClass = Boolean(
      reqInfo && ownInfo && reqInfo.grade === ownInfo.grade && reqInfo.class_no === ownInfo.class_no
    );
    if (!sameClass) {
      const assignment = await assignMeetingSlot(reqInfo?.availability, ownInfo?.availability, new Date());
      await db.execute({
        sql: 'UPDATE trades SET meeting_date = ?, meeting_period = ?, meeting_sub = ? WHERE id = ?',
        args: [assignment?.date ?? null, assignment?.period ?? null, assignment?.sub ?? null, id],
      });
    }
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
    const row = names.rows[0] as unknown as { actor: string | null; subject: string | null } | undefined;
    const kind = status === 'accepted' ? 'trade_accepted' : status === 'rejected' ? 'trade_rejected' : 'trade_cancelled';
    await notify(other, kind, {
      actor: row?.actor ? String(row.actor) : null,
      subject: row?.subject ? String(row.subject) : null,
      link: status === 'accepted' ? '/trade/irl' : '/trades',
    });
  }

  return NextResponse.json({ ok: true });
}
