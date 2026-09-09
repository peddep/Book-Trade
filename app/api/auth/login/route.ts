import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signSession } from '@/lib/auth';
import { ipRateLimit } from '@/lib/ratelimit';
import type { UserRow } from '@/lib/dbTypes';

// A hash of nothing real — bcrypt.compare against it still takes real work,
// so a guess against an email that doesn't exist takes the same time as one
// against an email that does. Without this, a fast "no such user" response
// vs. a slower "wrong password" one tells an attacker which emails are
// actually registered, one timing difference at a time.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8vJT.MXfCTgQ1QSHYuSJ8pdyNQTKSK';

export async function POST(req: NextRequest) {
  // Anti-brute-force, by IP rather than by account: capping attempts against
  // one email as well would let an attacker who doesn't even want the
  // account lock its real owner out of it just by failing that email's
  // password on purpose from a few different IPs. Matches the same IP-only
  // approach already used against signup floods.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (ipRateLimit(`login:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { email, password } = await req.json();
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE lower(email) = ?',
    args: [normalizedEmail],
  });
  const user = result.rows[0] as unknown as UserRow | undefined;

  const valid = await bcrypt.compare(typeof password === 'string' ? password : '', user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (Number(user.banned) === 1) {
    return NextResponse.json({ error: 'banned' }, { status: 403 });
  }

  const sessionUser = { id: Number(user.id), name: user.name, email: user.email, grade: user.grade, class_no: user.class_no ?? null, avatar_color: user.avatar_color ?? '#87A8A4' };
  const token = signSession(sessionUser);

  const res = NextResponse.json({ user: sessionUser });
  res.cookies.set('session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return res;
}
