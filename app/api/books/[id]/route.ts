import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureCoverColumn } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const MAX_COVER_LEN = 400_000;
function sanitizeCover(cover: unknown): string | null {
  if (typeof cover !== 'string' || !cover) return null;
  if (!cover.startsWith('data:image/')) return null;
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
  const found = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [id] });
  const book = found.rows[0] as any;
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (Number(book.owner_id) !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  if (typeof body.available !== 'undefined') {
    await db.execute({ sql: 'UPDATE books SET available = ? WHERE id = ?', args: [body.available ? 1 : 0, id] });
  }
  if (typeof body.cover_url !== 'undefined') {
    await ensureCoverColumn();
    // Empty string clears the cover; a valid data URL sets it.
    const cover = body.cover_url === '' ? null : sanitizeCover(body.cover_url);
    if (body.cover_url !== '' && cover === null) {
      return NextResponse.json({ error: 'invalid_cover' }, { status: 400 });
    }
    await db.execute({ sql: 'UPDATE books SET cover_url = ? WHERE id = ?', args: [cover, id] });
  }
  return NextResponse.json({ ok: true });
}
