import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveSubscription, removeSubscription, pushConfigured } from '@/lib/push';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return NextResponse.json({ error: 'bad_subscription' }, { status: 400 });
  }

  await saveSubscription(user.id, { endpoint, keys: { p256dh, auth } });
  return NextResponse.json({ ok: true });
}

// The browser calls this itself when a subscription expires or the student
// revokes permission, and the toggle calls it when they turn notifications
// back off.
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== 'string') return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  await removeSubscription(endpoint, user.id);
  return NextResponse.json({ ok: true });
}
