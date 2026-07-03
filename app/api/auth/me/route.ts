import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { ...user, is_admin: isAdmin(user) } });
}
