import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureBookColumns } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';

const MAX_COVER_LEN = 400_000;
function sanitizeCover(cover: unknown): string | null {
  if (typeof cover !== 'string' || !cover) return null;
  if (!cover.startsWith('data:image/') || cover.startsWith('data:image/svg')) return null;
  if (cover.length > MAX_COVER_LEN) return null;
  return cover;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const found = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [id] });
  const book = found.rows[0] as any;
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (Number(book.owner_id) !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await db.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [id] });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  await ensureBookColumns();
  const found = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [id] });
  const book = found.rows[0] as any;
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // The owner can edit their book; the admin may too (e.g. adding a missing cover).
  if (Number(book.owner_id) !== user.id && !isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();

  // Editable text fields.
  const sets: string[] = [];
  const args: unknown[] = [];
  if (typeof body.title === 'string' && body.title.trim()) { sets.push('title = ?'); args.push(body.title.trim()); }
  if (typeof body.author === 'string' && body.author.trim()) { sets.push('author = ?'); args.push(body.author.trim()); }
  if (typeof body.title_en !== 'undefined') {
    await ensureBookColumns();
    sets.push('title_en = ?');
    args.push(typeof body.title_en === 'string' && body.title_en.trim() ? body.title_en.trim() : null);
  }
  if (typeof body.price !== 'undefined') {
    await ensureBookColumns();
    const p = body.price === '' || body.price === null ? null : Number(body.price);
    sets.push('price = ?');
    args.push(p !== null && !isNaN(p) && p >= 0 ? p : null);
  }
  for (const f of ['subject', 'grade_level', 'condition', 'description', 'volume', 'publisher'] as const) {
    if (typeof body[f] !== 'undefined') {
      sets.push(`${f} = ?`);
      args.push(body[f] === '' ? null : body[f]);
    }
  }
  if (sets.length) {
    args.push(id);
    await db.execute({ sql: `UPDATE books SET ${sets.join(', ')} WHERE id = ?`, args: args as any[] });
  }

  if (typeof body.available !== 'undefined') {
    await db.execute({ sql: 'UPDATE books SET available = ? WHERE id = ?', args: [body.available ? 1 : 0, id] });
  }
  if (typeof body.cover_url !== 'undefined') {
    await ensureBookColumns();
    // Empty string clears the cover; a valid data URL sets it.
    const cover = body.cover_url === '' ? null : sanitizeCover(body.cover_url);
    if (body.cover_url !== '' && cover === null) {
      return NextResponse.json({ error: 'invalid_cover' }, { status: 400 });
    }
    // A cover the admin sets is curated, so it is the most authoritative one we
    // have and is reused on other copies of the same book. A cover the owner
    // uploads is an arbitrary file from their gallery and stays on their listing
    // only (see cover_source in lib/db.ts).
    const source = cover ? (isAdmin(user) ? 'admin' : 'upload') : null;
    await db.execute({ sql: 'UPDATE books SET cover_url = ?, cover_source = ? WHERE id = ?', args: [cover, source, id] });

    // Reuse only applies to future lookups, so an admin fixing one copy would
    // leave the classmates already listing that same book without a cover. Fill
    // those in too — same title, and only where the cover is still empty, so
    // nobody's own picture is ever replaced.
    if (cover && isAdmin(user)) {
      const r = await db.execute({
        sql: `UPDATE books SET cover_url = ?, cover_source = 'admin'
              WHERE lower(title) = lower(?) AND id != ? AND (cover_url IS NULL OR cover_url = '')`,
        args: [cover, String(book.title), id],
      });
      return NextResponse.json({ ok: true, alsoFilled: Number(r.rowsAffected) });
    }
  }
  return NextResponse.json({ ok: true });
}
