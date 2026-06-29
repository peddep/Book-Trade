import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { createSession } from '@/lib/auth';

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

export async function POST(req: NextRequest) {
  const { name, email, password, grade } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, grade, avatar_color) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, hash, grade ?? null, color);

  const user = { id: Number(result.lastInsertRowid), name, email, grade: grade ?? null, avatar_color: color };
  const token = createSession(user);

  const res = NextResponse.json({ user });
  res.cookies.set('session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}
