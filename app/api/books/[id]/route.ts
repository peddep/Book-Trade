import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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

  const { available } = await req.json();
  await db.execute({ sql: 'UPDATE books SET available = ? WHERE id = ?', args: [available ? 1 : 0, id] });
  return NextResponse.json({ ok: true });
}
