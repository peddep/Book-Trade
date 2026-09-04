import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { googleConfigured, googleRedirectUri, buildGoogleAuthUrl } from '@/lib/googleAuth';

export const runtime = 'nodejs';

// Starts the Google sign-in flow: a full page navigation to Google's consent
// screen, not a fetch — Google needs the browser itself on its origin so the
// student can see and trust who they are signing into.
export async function GET(req: NextRequest) {
  if (await getCurrentUser()) {
    return NextResponse.redirect(new URL('/trade', req.url));
  }

  if (!googleConfigured()) {
    // The buttons that link here are meant to disappear once real credentials
    // are in place; this is the backstop for a stray bookmark or an env var
    // that got unset, not something a student should normally reach.
    return NextResponse.redirect(new URL('/login?error=google_not_configured', req.url));
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
  return res;
}
