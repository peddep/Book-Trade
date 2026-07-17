import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureBookColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables, isBanned } from '@/lib/hub';
import { tooManyRecent } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const MAX_WISHES = 50;

// A book matches a wish when the wish title equals the book's Thai title or its
// English title (case-insensitive). Used both directions for mutual matches.
const MATCH = `(
  LOWER(w.title) = LOWER(b.title)
  OR (b.title_en IS NOT NULL AND LOWER(w.title) = LOWER(b.title_en))
  OR (w.title_en IS NOT NULL AND LOWER(w.title_en) = LOWER(b.title))
)`;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await Promise.all([ensureBookColumns(), ensureHubTables()]);
  const db = getDb();

  const wishes = await db.execute({ sql: 'SELECT id, title, title_en FROM wishlist WHERE user_id = ? ORDER BY id DESC', args: [user.id] });

  // Available books (not mine, on the market, not busy) that match my wishes.
  const matches = await db.execute({
    sql: `
      SELECT DISTINCT b.*, u.name AS owner_name, u.avatar_color AS owner_avatar_color, u.grade AS owner_grade,
        EXISTS(
          SELECT 1 FROM wishlist w2 JOIN books mb ON mb.owner_id = ?
          WHERE w2.user_id = b.owner_id AND mb.available = 1
            AND (LOWER(w2.title) = LOWER(mb.title)
                 OR (mb.title_en IS NOT NULL AND LOWER(w2.title) = LOWER(mb.title_en))
                 OR (w2.title_en IS NOT NULL AND LOWER(w2.title_en) = LOWER(mb.title)))
        ) AS mutual
      FROM wishlist w
      JOIN books b ON ${MATCH}
      JOIN users u ON b.owner_id = u.id
      WHERE w.user_id = ? AND b.owner_id != ? AND b.available = 1
        AND NOT EXISTS(SELECT 1 FROM wonder_box wb WHERE wb.book_id = b.id AND wb.status IN ('waiting','matched'))
        AND NOT EXISTS(SELECT 1 FROM trades t WHERE t.status = 'pending' AND t.offered_book_id = b.id)
      ORDER BY mutual DESC, b.created_at DESC
    `,
    args: [user.id, user.id, user.id],
  });

  return NextResponse.json({ wishes: wishes.rows, matches: matches.rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  if (await isBanned(user.id)) return NextResponse.json({ error: 'banned' }, { status: 403 });
  if (await tooManyRecent('wishlist', 'user_id', user.id, 60, 30)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const titleEn = typeof body.title_en === 'string' && body.title_en.trim() ? body.title_en.trim().slice(0, 200) : null;
  if (!title) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const db = getDb();
  const count = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM wishlist WHERE user_id = ?', args: [user.id] });
  if (Number(count.rows[0].n) >= MAX_WISHES) return NextResponse.json({ error: 'wishlist_full' }, { status: 400 });

  // Skip duplicates (same title already wished).
  const dup = await db.execute({ sql: 'SELECT id FROM wishlist WHERE user_id = ? AND LOWER(title) = LOWER(?) LIMIT 1', args: [user.id, title] });
  if (dup.rows.length === 0) {
    await db.execute({ sql: 'INSERT INTO wishlist (user_id, title, title_en) VALUES (?, ?, ?)', args: [user.id, title, titleEn] });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureHubTables();
  const id = new URL(req.url).searchParams.get('id');
  await getDb().execute({ sql: 'DELETE FROM wishlist WHERE id = ? AND user_id = ?', args: [Number(id), user.id] });
  return NextResponse.json({ ok: true });
}
