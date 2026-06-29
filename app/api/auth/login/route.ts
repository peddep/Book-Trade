import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const db = getDb();
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  const user = result.rows[0] as any;
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const sessionUser = { id: Number(user.id), name: user.name, email: user.email, grade: user.grade, avatar_color: user.avatar_color };
  const token = signSession(sessionUser);

  const res = NextResponse.json({ user: sessionUser });
  res.cookies.set('session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return res;
}
