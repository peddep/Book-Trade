import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables, getFreeOwnedBook, createInstantTrade, makeRoomCode, PLAN } from '@/lib/hub';

export const runtime = 'nodejs';

async function roomPayload(code: string, userId: number) {
  const db = getDb();
  const roomRes = await db.execute({ sql: 'SELECT * FROM rooms WHERE code = ?', args: [code.toUpperCase()] });
  const room = roomRes.rows[0] as any;
  if (!room) return null;
  const members = await db.execute({
    sql: `SELECT rm.user_id, rm.received_book_id, u.name, u.avatar_color, b.title, b.cover_color, b.cover_url,
            rb.title AS received_title, rb.cover_color AS received_color, rb.cover_url AS received_cover_url
          FROM room_members rm
          JOIN users u ON rm.user_id = u.id
          JOIN books b ON rm.book_id = b.id
          LEFT JOIN books rb ON rm.received_book_id = rb.id
          WHERE rm.room_id = ? ORDER BY rm.created_at`,
    args: [Number(room.id)],
  });
  return {
    code: room.code,
    status: room.status,
    owner_id: Number(room.owner_id),
    is_owner: Number(room.owner_id) === userId,
    is_member: members.rows.some((m: any) => Number(m.user_id) === userId),
    max: PLAN.roomMax,
    members: members.rows,
  };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (code) {
    const room = await roomPayload(code, user.id);
    if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ room });
  }

  // My open room (as member), if any
  const db = getDb();
  const mine = await db.execute({
    sql: `SELECT r.code FROM rooms r JOIN room_members rm ON rm.room_id = r.id
          WHERE rm.user_id = ? AND r.status = 'open' ORDER BY r.created_at DESC LIMIT 1`,
    args: [user.id],
  });
  if (!mine.rows.length) return NextResponse.json({ room: null });
  const room = await roomPayload(String(mine.rows[0].code), user.id);
  return NextResponse.json({ room });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const db = getDb();
  const body = await req.json();
  const action = body.action as string;

  if (action === 'create') {
    // Premium Plan feature — everyone here is on Premium.
    const book = await getFreeOwnedBook(user.id, Number(body.book_id));
    if (!book) return NextResponse.json({ error: 'book_unavailable' }, { status: 400 });
    const code = makeRoomCode();
    const created = await db.execute({ sql: 'INSERT INTO rooms (code, owner_id) VALUES (?, ?)', args: [code, user.id] });
    await db.execute({
      sql: 'INSERT INTO room_members (room_id, user_id, book_id) VALUES (?, ?, ?)',
      args: [Number(created.lastInsertRowid), user.id, Number(body.book_id)],
    });
    return NextResponse.json({ room: await roomPayload(code, user.id) }, { status: 201 });
  }

  if (action === 'join') {
    const code = String(body.code ?? '').toUpperCase().trim();
    const roomRes = await db.execute({ sql: "SELECT * FROM rooms WHERE code = ? AND status = 'open'", args: [code] });
    const room = roomRes.rows[0] as any;
    if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const members = await db.execute({ sql: 'SELECT user_id FROM room_members WHERE room_id = ?', args: [Number(room.id)] });
    if (members.rows.some((m: any) => Number(m.user_id) === user.id)) {
      return NextResponse.json({ room: await roomPayload(code, user.id) });
    }
    if (members.rows.length >= PLAN.roomMax) return NextResponse.json({ error: 'room_full' }, { status: 400 });

    const book = await getFreeOwnedBook(user.id, Number(body.book_id));
    if (!book) return NextResponse.json({ error: 'book_unavailable' }, { status: 400 });

    await db.execute({
      sql: 'INSERT INTO room_members (room_id, user_id, book_id) VALUES (?, ?, ?)',
      args: [Number(room.id), user.id, Number(body.book_id)],
    });
    return NextResponse.json({ room: await roomPayload(code, user.id) });
  }

  if (action === 'shuffle') {
    const code = String(body.code ?? '').toUpperCase().trim();
    const roomRes = await db.execute({ sql: "SELECT * FROM rooms WHERE code = ? AND status = 'open'", args: [code] });
    const room = roomRes.rows[0] as any;
    if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (Number(room.owner_id) !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const membersRes = await db.execute({
      sql: `SELECT rm.id, rm.user_id, rm.book_id FROM room_members rm JOIN books b ON rm.book_id = b.id
            WHERE rm.room_id = ? AND b.available = 1`,
      args: [Number(room.id)],
    });
    const members = [...membersRes.rows] as any[];
    if (members.length < 2) return NextResponse.json({ error: 'need_two' }, { status: 400 });

    // Random pairing; each pair swaps books (odd member sits this round out).
    for (let i = members.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [members[i], members[j]] = [members[j], members[i]];
    }
    for (let i = 0; i + 1 < members.length; i += 2) {
      const a = members[i];
      const b = members[i + 1];
      await createInstantTrade(Number(a.user_id), Number(b.user_id), Number(a.book_id), Number(b.book_id), 'Room Trade');
      await db.execute({ sql: 'UPDATE room_members SET received_book_id = ? WHERE id = ?', args: [Number(b.book_id), Number(a.id)] });
      await db.execute({ sql: 'UPDATE room_members SET received_book_id = ? WHERE id = ?', args: [Number(a.book_id), Number(b.id)] });
    }
    await db.execute({ sql: "UPDATE rooms SET status = 'done' WHERE id = ?", args: [Number(room.id)] });
    return NextResponse.json({ room: await roomPayload(code, user.id) });
  }

  if (action === 'leave') {
    const code = String(body.code ?? '').toUpperCase().trim();
    const roomRes = await db.execute({ sql: "SELECT * FROM rooms WHERE code = ? AND status = 'open'", args: [code] });
    const room = roomRes.rows[0] as any;
    if (room) {
      await db.execute({ sql: 'DELETE FROM room_members WHERE room_id = ? AND user_id = ?', args: [Number(room.id), user.id] });
      const left = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM room_members WHERE room_id = ?', args: [Number(room.id)] });
      if (Number(left.rows[0].n) === 0 || Number(room.owner_id) === user.id) {
        await db.execute({ sql: "UPDATE rooms SET status = 'closed' WHERE id = ?", args: [Number(room.id)] });
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'bad_action' }, { status: 400 });
}
