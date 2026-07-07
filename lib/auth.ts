import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  grade: string | null;
  class_no?: string | null;
  avatar_color: string;
}

function getSecret(): string {
  return process.env.SESSION_SECRET ?? 'dev-secret-change-me-in-production';
}

// Stateless signed-cookie sessions (survive serverless cold starts / multiple instances).
export function signSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token: string): SessionUser | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionUser;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  return verifySession(token);
}

// Admin = the account whose email matches ADMIN_EMAIL, or (when ADMIN_EMAIL
// is not set) the very first account created on the site (id 1).
export function isAdmin(user: SessionUser | null): boolean {
  if (!user) return false;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) return user.email.toLowerCase() === adminEmail.toLowerCase();
  return user.id === 1;
}
