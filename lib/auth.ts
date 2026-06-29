import { cookies } from 'next/headers';
import { getDb } from './db';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  grade: string | null;
  avatar_color: string;
}

const SESSIONS: Map<string, SessionUser> = new Map();

export function createSession(user: SessionUser): string {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  SESSIONS.set(token, user);
  return token;
}

export function getSession(token: string): SessionUser | null {
  return SESSIONS.get(token) ?? null;
}

export function destroySession(token: string) {
  SESSIONS.delete(token);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  return getSession(token);
}

export function getUserById(id: number): SessionUser | null {
  const db = getDb();
  const row = db.prepare('SELECT id, name, email, grade, avatar_color FROM users WHERE id = ?').get(id) as SessionUser | undefined;
  return row ?? null;
}
