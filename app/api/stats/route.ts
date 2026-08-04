import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

// Public, unauthenticated: the only endpoint on the site that answers without a
// session. It returns three counts and nothing else — no names, titles, covers
// or ids — so the front page can show the school it is worth joining without
// publishing anyone's listings to the open internet.
export async function GET() {
  const db = getDb();
  const zero = { books: 0, trades: 0, students: 0 };
  try {
    const [books, trades, students] = await Promise.all([
      db.execute('SELECT COUNT(*) AS n FROM books'),
      db.execute("SELECT COUNT(*) AS n FROM trades WHERE status = 'completed'"),
      db.execute('SELECT COUNT(*) AS n FROM users'),
    ]);
    return NextResponse.json(
      {
        books: Number(books.rows[0].n) || 0,
        trades: Number(trades.rows[0].n) || 0,
        students: Number(students.rows[0].n) || 0,
      },
      // Counts move slowly and every visitor sees the same ones, so serve them
      // from the edge cache rather than hitting the database per visit.
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch {
    // A brand-new database has no tables yet; an empty shelf is the honest answer.
    return NextResponse.json(zero, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
  }
}
