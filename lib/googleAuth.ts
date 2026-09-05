import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getSecret } from './auth';

// "Sign in with Google" — the Authorization Code flow.
//
// A student clicks the button, is sent to Google, and comes back with a code.
// The server exchanges that code for an ID token directly with Google over a
// server-to-server request authenticated with our client secret — the token
// never passes through the browser, so unlike a token handed to us by the
// client we do not need to verify its signature ourselves: it arrived on an
// authenticated channel Google answered, which is the thing a signature would
// otherwise be proving. Decoding the payload without checking a JWKS
// signature is a documented shortcut for exactly this flow, not a shortcut
// taken because verifying is hard.

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Where Google should send the student back to. Computed from the request
// rather than an env var, so the preview and the live site each work without
// a var to keep in sync — but each origin this is called from must be added
// as an Authorized redirect URI in the Google Cloud Console, or Google
// refuses the request with redirect_uri_mismatch.
export function googleRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    access_type: 'online',
  });
  // A hint, not enforcement — Google Workspace does not refuse other domains
  // just because this is set. The real check is domainError() once the
  // verified email comes back.
  const domain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (domain) params.set('hd', domain);
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name: string | null;
  sub: string;
}

// The payload of a Google ID token (a JWT: header.payload.signature), read
// without checking the signature — see the note at the top of this file for
// why that is fine specifically for a token that came back on the
// server-to-server exchange below, and never anywhere else.
export function decodeIdTokenPayload(idToken: string): GoogleIdentity | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof json.email !== 'string' || typeof json.sub !== 'string') return null;
    return {
      email: json.email.trim().toLowerCase(),
      emailVerified: json.email_verified === true || json.email_verified === 'true',
      name: typeof json.name === 'string' ? json.name : null,
      sub: json.sub,
    };
  } catch {
    return null;
  }
}

// Exchanges an authorization code for the student's verified identity.
// Throws on a network or Google-side failure; callers decide what the
// student sees for that (a page cannot silently pretend they are signed in).
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleIdentity> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const data = await res.json();
  const identity = typeof data.id_token === 'string' ? decodeIdTokenPayload(data.id_token) : null;
  if (!identity) throw new Error('Google did not return a usable identity');
  return identity;
}

// ── The "you just proved you own this address" cookie ──────────────────────
//
// A Google identity with no matching account is not enough to create one —
// the form still needs a grade, a room, a contact and a timetable, the same
// as every other signup. Rather than creating a half-finished account and
// hoping the student comes back to finish it, the verified identity is held
// in a short-lived signed cookie (the same signing scheme the session cookie
// uses, so no new secret to manage) until the registration form is filled in.

const PENDING_COOKIE = 'google_pending';
const PENDING_TTL_MS = 15 * 60 * 1000;

// Set alongside google_oauth_state when an already-signed-in student starts
// the flow to link Google to their existing (password) account, rather than
// to sign up or sign in. Not signed like the pending-identity cookie below —
// the callback re-derives the real signed-in user from the session cookie
// and only proceeds if it matches this value, so a forged value can at worst
// fail that match, never link to an account the forger isn't already signed
// into.
export const GOOGLE_LINK_COOKIE = 'google_link_uid';

interface PendingPayload {
  email: string;
  name: string | null;
  sub: string;
  exp: number;
}

function signPending(payload: PendingPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update('google_pending:' + body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyPendingToken(token: string): PendingPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update('google_pending:' + body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as PendingPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Called from the callback route (a Route Handler returning a redirect), so
// it sets the cookie on the response it is given rather than through
// next/headers — a redirect response's cookies cannot be set any other way.
export function setGooglePendingCookie(res: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } }, identity: GoogleIdentity) {
  const token = signPending({ email: identity.email, name: identity.name, sub: identity.sub, exp: Date.now() + PENDING_TTL_MS });
  res.cookies.set(PENDING_COOKIE, token, {
    httpOnly: true, path: '/', maxAge: PENDING_TTL_MS / 1000, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearGooglePendingCookie(res: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } }) {
  res.cookies.set(PENDING_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

// Read from the incoming request in the register route (a normal cookie read).
export async function verifyGooglePending(): Promise<PendingPayload | null> {
  const store = await cookies();
  const token = store.get(PENDING_COOKIE)?.value;
  if (!token) return null;
  return verifyPendingToken(token);
}
