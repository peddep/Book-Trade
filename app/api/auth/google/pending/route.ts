import { NextResponse } from 'next/server';
import { verifyGooglePending } from '@/lib/googleAuth';

// What the register page shows while filling in the rest of the form after
// coming back from Google — never what actually creates the account. The
// register route reads the same cookie itself and does not trust anything
// the client echoes back from this call.
export async function GET() {
  const pending = await verifyGooglePending();
  if (!pending) return NextResponse.json({ error: 'no_pending' }, { status: 404 });
  return NextResponse.json({ email: pending.email, name: pending.name });
}
