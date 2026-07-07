import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
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

  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const nextUser = {
    id: user.id,
    name,
    email: user.email,
    grade: grade || null,
    avatar_color: /^#[0-9a-fA-F]{6}$/.test(avatarColor) ? avatarColor : user.avatar_color,
  };

  const db = getDb();
  await db.execute({
    sql: 'UPDATE users SET name = ?, grade = ?, avatar_color = ? WHERE id = ?',
    args: [nextUser.name, nextUser.grade, nextUser.avatar_color, user.id],
  });

  // Re-issue the cookie so the session reflects the new profile.
  const res = NextResponse.json({ user: { ...nextUser, is_admin: isAdmin(nextUser) } });
  res.cookies.set('session', signSession(nextUser), {
    httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
