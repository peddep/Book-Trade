import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { googleConfigured, googleRedirectUri, buildGoogleAuthUrl, GOOGLE_LINK_COOKIE } from '@/lib/googleAuth';

export const runtime = 'nodejs';

// Starts the Google sign-in flow: a full page navigation to Google's consent
// screen, not a fetch — Google needs the browser itself on its origin so the
// student can see and trust who they are signing into.
//
// ?link=1 is a different errand: an already-signed-in student (almost always
// a password account from before Google-only signup) attaching Google to the
// account they are already using, from their settings — not creating or
// switching into a different one. The callback tells the two apart by
// whether GOOGLE_LINK_COOKIE is set.
export async function GET(req: NextRequest) {
  const linking = req.nextUrl.searchParams.get('link') === '1';
  const user = await getCurrentUser();

  if (linking) {
    // Nothing to attach Google to.
    if (!user) return NextResponse.redirect(new URL('/login', req.url));
  } else if (user) {
    return NextResponse.redirect(new URL('/trade', req.url));
  }

  if (!googleConfigured()) {
    // The buttons that link here are meant to disappear once real credentials
    // are in place; this is the backstop for a stray bookmark or an env var
    // that got unset, not something a student should normally reach.
    const dest = linking ? '/room?googleLink=not_configured' : '/login?error=google_not_configured';
    return NextResponse.redirect(new URL(dest, req.url));
  }

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = googleRedirectUri(req.nextUrl.origin);
  const res = NextResponse.redirect(buildGoogleAuthUrl(state, redirectUri));
  // Compared byte-for-byte against itself in the callback, so it needs no
  // signature — only that nobody else could have set it, which httpOnly gives.
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true, path: '/', maxAge: 600, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  if (linking && user) {
    res.cookies.set(GOOGLE_LINK_COOKIE, String(user.id), {
      httpOnly: true, path: '/', maxAge: 600, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return res;
}
