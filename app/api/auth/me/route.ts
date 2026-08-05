import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb, ensureUserColumns } from '@/lib/db';
import { getCurrentUser, isAdmin, signSession } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  // availability and contact live only in the database, not in the session
  // cookie, so read them here — the profile editor needs them to prefill.
  let extra: { availability: string[]; contact: string | null } = { availability: [], contact: null };
  try {
    await ensureUserColumns();
    const r = await getDb().execute({ sql: 'SELECT availability, contact FROM users WHERE id = ?', args: [user.id] });
    const row = r.rows[0] as any;
    if (row) {
      extra = {
        availability: (() => { try { const a = JSON.parse(row.availability ?? '[]'); return Array.isArray(a) ? a : []; } catch { return []; } })(),
        contact: row.contact ?? null,
      };
    }
  } catch { /* older database */ }
  return NextResponse.json({ user: { ...user, ...extra, is_admin: isAdmin(user) } });
}

// Update the signed-in user's profile (name, grade, avatar colour).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const grade = typeof body.grade === 'string' ? body.grade.trim() : '';
  const avatarColor = typeof body.avatar_color === 'string' ? body.avatar_color.trim() : '';
  // class_no: use the provided value when present, otherwise keep the current one.
  const classNo = 'class_no' in body
    ? (body.class_no ? String(body.class_no).trim() : null)
    : (user.class_no ?? null);

  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const nextUser = {
    id: user.id,
    name,
    email: user.email,
    grade: grade || null,
    class_no: classNo,
    avatar_color: /^#[0-9a-fA-F]{6}$/.test(avatarColor) ? avatarColor : user.avatar_color,
  };

  const db = getDb();
  await ensureUserColumns();
  await db.execute({
    sql: 'UPDATE users SET name = ?, grade = ?, class_no = ?, avatar_color = ? WHERE id = ?',
    args: [nextUser.name, nextUser.grade, nextUser.class_no, nextUser.avatar_color, user.id],
  });
  // Contact lives only in the DB (not in the session cookie).
  if ('contact' in body) {
    const contact = typeof body.contact === 'string' && body.contact.trim() ? body.contact.trim().slice(0, 100) : null;
    await db.execute({ sql: 'UPDATE users SET contact = ? WHERE id = ?', args: [contact, user.id] });
  }
  // Availability, likewise DB-only. It was previously fixed at registration,
  // which left anyone whose timetable changed — or who ticked it hurriedly —
  // permanently unable to correct it, and every "no matching free period" it
  // caused was wrong. Stored as a JSON array of "<slot>-<day>" keys, plus the
  // special key "any" meaning free whenever the other person is.
  if ('availability' in body) {
    const valid = /^(p4|p5|after)-[0-4]$/;
    const slots = Array.isArray(body.availability)
      ? body.availability.filter((k: unknown) => typeof k === 'string' && (k === 'any' || valid.test(k))).slice(0, 20)
      : [];
    await db.execute({ sql: 'UPDATE users SET availability = ? WHERE id = ?', args: [JSON.stringify(slots), user.id] });
  }
  // Optional password change.
  if (typeof body.new_password === 'string' && body.new_password) {
    if (body.new_password.length < 6) return NextResponse.json({ error: 'password_short' }, { status: 400 });
    const hash = await bcrypt.hash(body.new_password, 10);
    await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [hash, user.id] });
  }

  // Re-issue the cookie so the session reflects the new profile.
  const res = NextResponse.json({ user: { ...nextUser, is_admin: isAdmin(nextUser) } });
  res.cookies.set('session', signSession(nextUser), {
    httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
