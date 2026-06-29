import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as any;
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (book.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  db.prepare('DELETE FROM books WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as any;
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (book.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { available } = await req.json();
  db.prepare('UPDATE books SET available = ? WHERE id = ?').run(available ? 1 : 0, id);
  return NextResponse.json({ ok: true });
}
