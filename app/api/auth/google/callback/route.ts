import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureUserColumns } from '@/lib/db';
import { signSession } from '@/lib/auth';
import { domainError } from '@/lib/emailDomain';
import { googleConfigured, googleRedirectUri, exchangeGoogleCode, setGooglePendingCookie } from '@/lib/googleAuth';

export const runtime = 'nodejs';

// Where Google sends the student back to. Everything here ends in a redirect
// — there is no page of its own, so every failure has to say why on the page
// it lands on rather than showing this route's own words.
export async function GET(req: NextRequest) {
  const fail = (reason: string, extra?: Record<string, string>) => {
    const url = new URL('/login', req.url);
    url.searchParams.set('error', reason);
    for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url);
    res.cookies.set('google_oauth_state', '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  };

  if (!googleConfigured()) return fail('google_not_configured');

  const { searchParams } = req.nextUrl;
  // The student said no on Google's own screen, or closed it.
  if (searchParams.get('error')) return fail('google_failed');

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expectedState = req.cookies.get('google_oauth_state')?.value;
  // Constant-time comparison is not needed here — this defends against a
  // forged callback, not against timing an already-httpOnly secret.
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail('google_failed');
  }

  let identity;
  try {
    identity = await exchangeGoogleCode(code, googleRedirectUri(req.nextUrl.origin));
  } catch (err) {
    console.error('Google sign-in failed:', err);
    return fail('google_failed');
  }

  if (!identity.emailVerified) return fail('google_unverified');
  const domainErr = domainError(identity.email);
  if (domainErr) return fail('google_domain', { domain: domainErr.domain });

  const db = getDb();
  await ensureUserColumns();
  const existing = await db.execute({ sql: 'SELECT * FROM users WHERE lower(email) = ?', args: [identity.email] });
  const row = existing.rows[0] as any;

  if (!row) {
    // No account yet: the rest of the signup form still needs a grade, a
    // room, a contact and a timetable, so this is not enough to create one —
    // hold the verified identity and send them to finish the form.
    const res = NextResponse.redirect(new URL('/register?google=1', req.url));
    res.cookies.set('google_oauth_state', '', { httpOnly: true, path: '/', maxAge: 0 });
    setGooglePendingCookie(res, identity);
    return res;
  }

  if (Number(row.banned) === 1) return fail('banned');

  // Record the link on first use, so a future feature can tell a
  // Google-linked account from a password-only one without re-deriving it.
  if (!row.google_sub) {
    await db.execute({ sql: 'UPDATE users SET google_sub = ? WHERE id = ?', args: [identity.sub, row.id] });
  }

  const sessionUser = {
    id: Number(row.id), name: row.name, email: row.email,
    grade: row.grade, class_no: row.class_no ?? null, avatar_color: row.avatar_color,
  };
  const res = NextResponse.redirect(new URL('/trade', req.url));
  res.cookies.set('google_oauth_state', '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set('session', signSession(sessionUser), {
    httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
