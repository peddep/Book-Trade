import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureBookColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? '';
  const subject = searchParams.get('subject') ?? '';
  const myBooks = searchParams.get('mine') === '1';
  const user = await getCurrentUser();

  let sql = `
    SELECT b.*, u.name as owner_name, u.avatar_color as owner_avatar_color, u.grade as owner_grade
    FROM books b
    JOIN users u ON b.owner_id = u.id
    WHERE 1=1
  `;
  const args: unknown[] = [];

  if (myBooks && user) {
    sql += ' AND b.owner_id = ?';
    args.push(user.id);
  } else {
    sql += ' AND b.available = 1';
    if (user) {
      sql += ' AND b.owner_id != ?';
      args.push(user.id);
    }
  }

  if (query) {
    sql += ' AND (b.title LIKE ? OR b.author LIKE ?)';
    args.push(`%${query}%`, `%${query}%`);
  }
  if (subject) {
    sql += ' AND b.subject = ?';
    args.push(subject);
  }

  sql += ' ORDER BY b.created_at DESC';
  const result = await db.execute({ sql, args: args as any[] });
  return NextResponse.json({ books: result.rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, title_en, author, subject, grade_level, condition, description, cover_url } = await req.json();
  if (!title || !author) return NextResponse.json({ error: 'Title and author required' }, { status: 400 });

  const color = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];
  const db = getDb();
  await ensureBookColumns();
  // Cover is the student's uploaded photo (or none).
  const coverUrl = sanitizeCover(cover_url);
  const titleEn = typeof title_en === 'string' && title_en.trim() ? title_en.trim() : null;
  const result = await db.execute({
    sql: 'INSERT INTO books (owner_id, title, title_en, author, subject, grade_level, condition, description, cover_color, cover_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [user.id, title, titleEn, author, subject ?? null, grade_level ?? null, condition ?? 'Good', description ?? null, color, coverUrl],
  });

  const book = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [Number(result.lastInsertRowid)] });
  return NextResponse.json({ book: book.rows[0] }, { status: 201 });
}
