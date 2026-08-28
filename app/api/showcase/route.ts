import { NextResponse } from 'next/server';
import { getDb, ensureBookColumns } from '@/lib/db';

export const runtime = 'nodejs';

const LIMIT = 18;

// Public, unauthenticated: a sample of books currently up for trade, for the
// front page, so somebody deciding whether to join can see that the shelves are
// real rather than taking a number's word for it.
//
// Deliberately narrow. /api/books is behind a session because listing every
// book together with its owner publishes who at the school owns what, and that
// is nobody's business outside the school. This returns the cover, the title
// and the price and stops there — no owner, no grade, no contact, and no real
// book id, so nothing here can be traced back to a student or acted on. The
// ids below are positions in this response, not database rows.
export async function GET() {
  try {
    await ensureBookColumns();
    const res = await getDb().execute({
      sql: `SELECT title, title_en, cover_url, cover_color, price
            FROM books
            WHERE available = 1
            ORDER BY (cover_url IS NULL), id DESC
            LIMIT ?`,
      args: [LIMIT],
    });
    const books = res.rows.map((r: any, i: number) => ({
      id: i,
      title: String(r.title ?? ''),
      title_en: r.title_en ?? null,
      cover_url: r.cover_url ?? null,
      cover_color: r.cover_color ?? '#7c3aed',
      price: r.price ?? null,
    }));
    return NextResponse.json(
      { books },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch {
    // A brand-new database has no books table yet; an empty shelf is honest.
    return NextResponse.json({ books: [] }, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
  }
}
