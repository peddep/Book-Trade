import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb, ensureUserColumns, ensureUniqueAccounts } from '@/lib/db';
import { getCurrentUser, isAdmin, signSession } from '@/lib/auth';
import type { UserRow } from '@/lib/dbTypes';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  // availability and contact live only in the database, not in the session
  // cookie, so read them here — the profile editor needs them to prefill.
  // The ban comes from the same row, which is what lets a ban take effect on
  // somebody who is already signed in: the session cookie is signed, not
  // stored, so it stays valid until it expires. This is where the app finds
  // out, and it is asked for on a timer.
  let extra: { availability: string[]; contact: string | null } = { availability: [], contact: null };
  let banned = false;
  try {
    await ensureUserColumns();
    const r = await getDb().execute({ sql: 'SELECT availability, contact, banned FROM users WHERE id = ?', args: [user.id] });
    const row = r.rows[0] as unknown as Pick<UserRow, 'availability' | 'contact' | 'banned'> | undefined;
    if (!row) {
      // The account is gone. Whatever the cookie says, there is nobody here.
      const res = NextResponse.json({ user: null });
      res.cookies.set('session', '', { maxAge: 0, path: '/' });
      return res;
    }
    banned = Number(row.banned) === 1;
    extra = {
      availability: (() => { try { const a = JSON.parse(row.availability ?? '[]'); return Array.isArray(a) ? a : []; } catch { return []; } })(),
      contact: row.contact ?? null,
    };
  } catch { /* older database */ }

  if (banned) {
    // Signed out here and now: the cookie is cleared in the same response, so
    // the next request from this browser carries nothing.
    const res = NextResponse.json({ user: null, banned: true });
    res.cookies.set('session', '', { maxAge: 0, path: '/' });
    return res;
  }

  return NextResponse.json({ user: { ...user, ...extra, is_admin: isAdmin(user) } });
}

// Update the signed-in user's profile (name, grade, avatar colour).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const avatarColor = typeof body.avatar_color === 'string' ? body.avatar_color.trim() : '';
  // grade and class_no: use the provided value when present, otherwise keep the
  // current one. Grade used to default to empty when it was not sent, and was
  // then written as NULL — so any update that did not mention it, a rename for
  // instance, quietly cleared the student's year.
  const grade = 'grade' in body
    ? (typeof body.grade === 'string' ? body.grade.trim() : '')
    : (user.grade ?? '');
  const classNo = 'class_no' in body
    ? (body.class_no ? String(body.class_no).trim() : null)
    : (user.class_no ?? null);

  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  // Signing up asks for a year, a room, a contact and a timetable, so editing
  // a profile must not be a way around that. Only what is actually sent is
  // checked — this endpoint takes partial updates — but nothing it does send
  // may be emptied.
  const emptied = (key: string, v: unknown) =>
    key in body && (Array.isArray(v) ? v.length === 0 : !(typeof v === 'string' ? v.trim() : v));
  if (emptied('grade', grade) || emptied('class_no', classNo) || emptied('contact', body.contact)
      || emptied('availability', body.availability)) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // A student may rename themselves, but not into somebody else's name.
  await ensureUniqueAccounts();
  const clash = await getDb().execute({
    sql: 'SELECT 1 FROM users WHERE lower(name) = lower(?) AND id != ? LIMIT 1',
    args: [name, user.id],
  });
  if (clash.rows.length > 0) return NextResponse.json({ error: 'name_taken' }, { status: 409 });

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

  // Answer with the whole profile, not just the parts the cookie carries. The
  // page replaces its copy of the student with this one, so leaving the contact
  // and the timetable out of it quietly emptied them on screen — and now that
  // neither may be blank, the next save would be refused for fields the student
  // never touched.
  const saved = await db.execute({ sql: 'SELECT contact, availability FROM users WHERE id = ?', args: [user.id] });
  const savedRow = saved.rows[0] as unknown as Pick<UserRow, 'contact' | 'availability'> | undefined;
  const fullUser = {
    ...nextUser,
    contact: savedRow?.contact ?? null,
    availability: (() => {
      try { const a = JSON.parse(savedRow?.availability ?? '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
    })(),
  };

  // Re-issue the cookie so the session reflects the new profile. The cookie
  // itself stays slim — only the reply carries the rest.
  const res = NextResponse.json({ user: { ...fullUser, is_admin: isAdmin(nextUser) } });
  res.cookies.set('session', signSession(nextUser), {
    httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
