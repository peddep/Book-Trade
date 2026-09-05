import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signSession } from '@/lib/auth';
import type { UserRow } from '@/lib/dbTypes';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE lower(email) = ?',
    args: [typeof email === 'string' ? email.trim().toLowerCase() : ''],
  });
  const user = result.rows[0] as unknown as UserRow | undefined;
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (Number(user.banned) === 1) {
    return NextResponse.json({ error: 'banned' }, { status: 403 });
  }

  const sessionUser = { id: Number(user.id), name: user.name, email: user.email, grade: user.grade, class_no: user.class_no ?? null, avatar_color: user.avatar_color ?? '#6366f1' };
  const token = signSession(sessionUser);

  const res = NextResponse.json({ user: sessionUser });
  res.cookies.set('session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return res;
}
