import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureBookColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureHubTables } from '@/lib/hub';
import { catalogTitleParts } from '@/lib/books-catalog';
import type { Client } from '@libsql/client';

// Looks up the author for a title: harvested Thai catalog → books already on
// the site → the built-in bilingual catalog → a quick Google Books query.
// Returns '' when nothing matches (the admin can fill it in later).
async function resolveAuthor(db: Client, title: string): Promise<string> {
  try {
    const r = await db.execute({
      sql: "SELECT author FROM catalog_books WHERE title = ? AND author IS NOT NULL AND author != '' LIMIT 1",
      args: [title],
    });
    if (r.rows[0]?.author) return String(r.rows[0].author);
  } catch { /* catalog table may not exist yet */ }
  try {
    const r = await db.execute({
      sql: "SELECT author FROM books WHERE title = ? AND author != '' LIMIT 1",
      args: [title],
    });
    if (r.rows[0]?.author) return String(r.rows[0].author);
  } catch { /* ignore */ }
  const parts = catalogTitleParts(title);
  if (parts?.author) return parts.author;
  try {
    const params = new URLSearchParams({
      q: `intitle:"${title}"`,
      maxResults: '1',
      printType: 'books',
      fields: 'items(volumeInfo(title,authors))',
    });
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    if (key) params.set('key', key);
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const d = await res.json();
      const a = d.items?.[0]?.volumeInfo?.authors?.[0];
      if (typeof a === 'string' && a) return a;
    }
  } catch { /* offline / quota — leave blank */ }
  return '';
}

// A book is "busy" when it's committed to Wonder Box, GTS, an open room, or a
// pending direct offer — such books should not be offered again elsewhere.
const BUSY_EXPR = `(
  EXISTS(SELECT 1 FROM wonder_box wb WHERE wb.book_id = b.id AND wb.status IN ('waiting','matched'))
  OR EXISTS(SELECT 1 FROM gts_deposits g WHERE g.book_id = b.id AND g.status = 'open')
  OR EXISTS(SELECT 1 FROM room_members rm JOIN rooms r ON rm.room_id = r.id WHERE rm.book_id = b.id AND r.status = 'open')
  OR EXISTS(SELECT 1 FROM trades t WHERE t.status = 'pending' AND t.offered_book_id = b.id)
)`;

const COVER_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// Max size for a user-uploaded cover (base64 data URL). ~400KB of base64 keeps
// rows small; the client resizes to well under this before uploading.
const MAX_COVER_LEN = 400_000;

// Accepts only inline image data URLs (uploaded photos), rejects anything else.
function sanitizeCover(cover: unknown): string | null {
  if (typeof cover !== 'string' || !cover) return null;
  if (!cover.startsWith('data:image/')) return null;
  if (cover.length > MAX_COVER_LEN) return null;
  return cover;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  await ensureBookColumns();
  await ensureHubTables();
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? '';
  const subject = searchParams.get('subject') ?? '';
  const myBooks = searchParams.get('mine') === '1';
  // When set, hide books already committed to another trade avenue.
  const excludeBusy = searchParams.get('exclude_busy') === '1';
  const user = await getCurrentUser();

  let sql = `
    SELECT b.*, u.name as owner_name, u.avatar_color as owner_avatar_color, u.grade as owner_grade,
      ${BUSY_EXPR} AS busy,
      EXISTS(SELECT 1 FROM wonder_box wb2 WHERE wb2.book_id = b.id AND wb2.status IN ('waiting','matched')) AS in_wonderbox
    FROM books b
    JOIN users u ON b.owner_id = u.id
    WHERE 1=1
  `;
  const args: unknown[] = [];

  if (myBooks && user) {
    sql += ' AND b.owner_id = ?';
    args.push(user.id);
  } else {
    // The public browse list never shows books committed elsewhere.
    sql += ` AND b.available = 1 AND NOT ${BUSY_EXPR}`;
    if (user) {
      sql += ' AND b.owner_id != ?';
      args.push(user.id);
    }
  }

  if (excludeBusy) {
    sql += ` AND NOT ${BUSY_EXPR}`;
  }

  if (query) {
    sql += ' AND (b.title LIKE ? OR b.author LIKE ?)';
    args.push(`%${query}%`, `%${query}%`);
  }
  if (subject) {
    // subject holds a comma-separated tag list; match the tag anywhere in it.
    sql += " AND (',' || b.subject || ',') LIKE ?";
    args.push(`%,${subject},%`);
  }

  sql += ' ORDER BY b.created_at DESC';
  const result = await db.execute({ sql, args: args as any[] });
  return NextResponse.json({ books: result.rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, title_en, author, subject, grade_level, condition, description, cover_url, price } = await req.json();
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  // Price is required when adding a book.
  const priceNum = price !== undefined && price !== null && price !== '' && !isNaN(Number(price)) && Number(price) >= 0 ? Number(price) : null;
  if (priceNum === null) return NextResponse.json({ error: 'price_required' }, { status: 400 });

  const color = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];
  const db = getDb();
  await ensureBookColumns();
  // Author is filled automatically: from the form autofill if the title matched
  // a suggestion, otherwise looked up here; the admin can correct it later.
  const authorFinal = typeof author === 'string' && author.trim() ? author.trim() : await resolveAuthor(db, String(title));
  // Cover is the student's uploaded photo (or none).
  const coverUrl = sanitizeCover(cover_url);
  const titleEn = typeof title_en === 'string' && title_en.trim() ? title_en.trim() : null;
  const result = await db.execute({
    sql: 'INSERT INTO books (owner_id, title, title_en, price, author, subject, grade_level, condition, description, cover_color, cover_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [user.id, title, titleEn, priceNum, authorFinal, subject ?? null, grade_level ?? null, condition ?? 'Good', description ?? null, color, coverUrl],
  });

  const book = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json({ book: book.rows[0] }, { status: 201 });
}
