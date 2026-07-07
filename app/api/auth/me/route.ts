import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureUserColumns } from '@/lib/db';
import { getCurrentUser, isAdmin, signSession } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { ...user, is_admin: isAdmin(user) } });
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

  // Re-issue the cookie so the session reflects the new profile.
  const res = NextResponse.json({ user: { ...nextUser, is_admin: isAdmin(nextUser) } });
  res.cookies.set('session', signSession(nextUser), {
    httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
