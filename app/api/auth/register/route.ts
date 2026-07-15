import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb, ensureUserColumns } from '@/lib/db';
import { signSession } from '@/lib/auth';
import { ipRateLimit } from '@/lib/ratelimit';

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

export async function POST(req: NextRequest) {
  // Anti-abuse: at most 5 signups per 10 minutes from one IP.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (ipRateLimit(`register:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { name, email, password, grade, class_no, contact, real_name, availability } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // When ALLOWED_EMAIL_DOMAIN is set (e.g. student.nssc.ac.th), only school
  // emails may register.
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (allowedDomain && !String(email).toLowerCase().endsWith('@' + allowedDomain.toLowerCase())) {
    return NextResponse.json({ error: 'email_domain', domain: allowedDomain }, { status: 400 });
  }

  // Availability is a list of "row-col" slot keys (e.g. "noon-0"); store as JSON.
  const availabilityJson = Array.isArray(availability) ? JSON.stringify(availability) : null;
  const classNo = class_no ? String(class_no) : null;
  const contactStr = typeof contact === 'string' && contact.trim() ? contact.trim().slice(0, 100) : null;
  const realName = typeof real_name === 'string' && real_name.trim() ? real_name.trim().slice(0, 120) : null;

  try {
    const db = getDb();
    await ensureUserColumns();
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = await db.execute({
      sql: 'INSERT INTO users (name, email, password_hash, grade, class_no, contact, real_name, avatar_color, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [name, email, hash, grade ?? null, classNo, contactStr, realName, color, availabilityJson],
    });

    const user = { id: Number(result.lastInsertRowid), name, email, grade: grade ?? null, class_no: classNo, avatar_color: color };
    const token = signSession(user);

    const res = NextResponse.json({ user });
    res.cookies.set('session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res;
  } catch (err) {
    console.error('Register failed:', err);
    return NextResponse.json(
      { error: 'Database error — check that the Turso env vars are set in Vercel and the tables were created.' },
      { status: 500 }
    );
  }
}
