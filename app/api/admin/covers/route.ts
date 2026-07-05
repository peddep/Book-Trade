import { NextResponse } from 'next/server';
import { getDb, ensureCoverColumn } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { findCoverUrl } from '@/lib/covers';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Backfills covers for books added before cover support. Processes a small
// batch per call; books with no cover found get '' so they aren't retried.
export async function POST() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await ensureCoverColumn();
  const db = getDb();
  const batch = await db.execute("SELECT id, title FROM books WHERE cover_url IS NULL LIMIT 10");

  let updated = 0;
  for (const row of batch.rows as any[]) {
    const url = await findCoverUrl(String(row.title));
    await db.execute({ sql: 'UPDATE books SET cover_url = ? WHERE id = ?', args: [url ?? '', Number(row.id)] });
    if (url) updated++;
  }

  const left = await db.execute('SELECT COUNT(*) AS n FROM books WHERE cover_url IS NULL');
  return NextResponse.json({ checked: batch.rows.length, updated, remaining: Number(left.rows[0].n) });
}
