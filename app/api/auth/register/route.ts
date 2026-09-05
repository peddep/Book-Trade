import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb, ensureUserColumns, ensureUniqueAccounts } from '@/lib/db';
import { signSession, getCurrentUser } from '@/lib/auth';
import { ipRateLimit } from '@/lib/ratelimit';
import { domainError } from '@/lib/emailDomain';
import { verifyGooglePending, clearGooglePendingCookie } from '@/lib/googleAuth';

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

export async function POST(req: NextRequest) {
  // Registering while signed in would create a second account and move the
  // session onto it, stranding this student's books on the first one. The
  // pages redirect away before it gets this far; this is the backstop, since
  // a client-side redirect is not something to rely on.
  if (await getCurrentUser()) {
    return NextResponse.json({ error: 'already_signed_in' }, { status: 409 });
  }

  // Anti-abuse: at most 5 signups per 10 minutes from one IP.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (ipRateLimit(`register:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = await req.json();
  const { password, grade, class_no, contact, real_name, availability, accept_terms } = body;
  // Trimmed, and the email lower-cased. Addresses are not case-sensitive in
  // practice, so "Somchai@..." and "somchai@..." are one person — stored one
  // way so they cannot become two accounts, and so signing in works whichever
  // way it is typed.
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  // A verified "Sign in with Google" identity waiting to be turned into an
  // account. When present it decides the email — never whatever the client
  // sent — since the whole point of it is that the client cannot be trusted
  // to say which address it owns, only Google having answered can.
  const pending = await verifyGooglePending();
  const email = pending ? pending.email : (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '');

  // A password is how everyone else gets back in; a Google account signs in
  // through Google instead, so it does not need one — see below where an
  // unguessable one is generated to satisfy the column regardless.
  if (!name || !email || (!pending && !password)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // New accounts go through Google only once this is set — the register
  // page's own form disappears, but this is the backstop for a request made
  // directly rather than through it. An existing password account is
  // unaffected: this only blocks creating a *new* one without a verified
  // Google identity.
  if (!pending && process.env.NEXT_PUBLIC_GOOGLE_ONLY_SIGNUP === '1') {
    return NextResponse.json({ error: 'google_only' }, { status: 400 });
  }

  // The form requires the checkbox, but the form is not what creates the
  // account — an account with no recorded agreement must not exist, so the
  // check belongs here too.
  if (accept_terms !== true) {
    return NextResponse.json({ error: 'terms_required' }, { status: 400 });
  }

  // Same reasoning for the rest of the form. Every one of these is something
  // another student needs to arrange a swap: which room to find them in, how to
  // message them, and when they are free — a listing from somebody nobody can
  // reach or meet wastes the time of whoever offers for it.
  const filledIn = (v: unknown) => typeof v === 'string' ? v.trim() !== '' : v != null && v !== '';
  if (!filledIn(real_name) || !filledIn(grade) || !filledIn(class_no) || !filledIn(contact)
      || !Array.isArray(availability) || availability.length === 0) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // When ALLOWED_EMAIL_DOMAIN is set (e.g. student.nssc.ac.th), only school
  // emails may register. Google verifying the address already re-checked this
  // once in the callback that set `pending` — re-checking here as well means
  // the rule lives in one place instead of being trusted to have been applied
  // upstream.
  const domainErr = domainError(email);
  if (domainErr) {
    return NextResponse.json({ error: 'email_domain', domain: domainErr.domain }, { status: 400 });
  }

  // Availability is a list of "row-col" slot keys (e.g. "noon-0"); store as JSON.
  const availabilityJson = Array.isArray(availability) ? JSON.stringify(availability) : null;
  const classNo = class_no ? String(class_no) : null;
  const contactStr = typeof contact === 'string' && contact.trim() ? contact.trim().slice(0, 100) : null;
  const realName = typeof real_name === 'string' && real_name.trim() ? real_name.trim().slice(0, 120) : null;

  try {
    const db = getDb();
    await ensureUserColumns();
    await ensureUniqueAccounts();
    // One account per address, and one student per username. Compared without
    // regard to case, or the same name in different capitals would read as two
    // different people to everyone browsing.
    const existing = await db.execute({
      sql: 'SELECT lower(email) = ? AS same_email, lower(name) = lower(?) AS same_name FROM users WHERE lower(email) = ? OR lower(name) = lower(?)',
      args: [email, name, email, name],
    });
    if (existing.rows.some((r) => Number((r as unknown as { same_email: number }).same_email) === 1)) {
      return NextResponse.json({ error: 'email_taken' }, { status: 409 });
    }
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'name_taken' }, { status: 409 });
    }

    // A Google-created account has no password of its own to check against —
    // it signs in through Google instead — but the column is NOT NULL, so it
    // gets a hash of random bytes nobody chose and nobody could reasonably
    // guess. The student can still give the account a real password later
    // from their profile, at which point signing in with it starts working.
    const hash = await bcrypt.hash(pending ? crypto.randomBytes(32).toString('hex') : password, 10);
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const result = await db.execute({
      // When they agreed is stored alongside the account, so the record of the
      // agreement survives any later change to the wording of the pages.
      sql: 'INSERT INTO users (name, email, password_hash, grade, class_no, contact, real_name, avatar_color, availability, terms_accepted_at, google_sub) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'), ?)',
      args: [name, email, hash, grade ?? null, classNo, contactStr, realName, color, availabilityJson, pending?.sub ?? null],
    });

    const user = { id: Number(result.lastInsertRowid), name, email, grade: grade ?? null, class_no: classNo, avatar_color: color };
    const token = signSession(user);

    const res = NextResponse.json({ user });
    res.cookies.set('session', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    if (pending) clearGooglePendingCookie(res);
    return res;
  } catch (err) {
    // The unique index caught a signup that raced past the check above.
    if (String(err).includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: String(err).includes('name') ? 'name_taken' : 'email_taken' }, { status: 409 });
    }
    console.error('Register failed:', err);
    return NextResponse.json(
      { error: 'Database error — check that the Turso env vars are set in Vercel and the tables were created.' },
      { status: 500 }
    );
  }
}
