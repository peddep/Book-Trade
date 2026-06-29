import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const COVER_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export async function GET(req: NextRequest) {
  const db = getDb();
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
  const params: unknown[] = [];

  if (myBooks && user) {
    sql += ' AND b.owner_id = ?';
    params.push(user.id);
  } else {
    sql += ' AND b.available = 1';
    if (user) {
      sql += ' AND b.owner_id != ?';
      params.push(user.id);
    }
  }

  if (query) {
    sql += ' AND (b.title LIKE ? OR b.author LIKE ?)';
    params.push(`%${query}%`, `%${query}%`);
  }
  if (subject) {
    sql += ' AND b.subject = ?';
    params.push(subject);
  }

  sql += ' ORDER BY b.created_at DESC';
  const books = db.prepare(sql).all(...params);
  return NextResponse.json({ books });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, author, subject, grade_level, condition, description } = await req.json();
  if (!title || !author) return NextResponse.json({ error: 'Title and author required' }, { status: 400 });

  const color = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO books (owner_id, title, author, subject, grade_level, condition, description, cover_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(user.id, title, author, subject ?? null, grade_level ?? null, condition ?? 'Good', description ?? null, color);

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json({ book }, { status: 201 });
}
