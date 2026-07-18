import { NextRequest, NextResponse, after } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  getHarvestState, harvestBatch, resetHarvestState,
  getHarvestRunning, markHarvestRunning, clearHarvestRunning,
  getHarvestStop, requestHarvestStop,
} from '@/lib/harvest';

export const runtime = 'nodejs';
export const maxDuration = 60;

// If no chain heartbeat lands within this window, treat the run as dead so a
// new click can restart it.
const RUN_LEASE_MS = 150_000;

// Does one batch after the response is sent, then triggers the next batch by
// calling this endpoint again — so the harvest keeps going on the server even
// after the admin closes the page. Stops when done, rate-limited, or stopped.
async function runChainStep(origin: string, cookie: string, startedAt: number) {
  try {
    if ((await getHarvestStop()) > startedAt) { await clearHarvestRunning(); return; }
    const state = await getHarvestState();
    if (state.nextIndex >= state.totalQueries) { await clearHarvestRunning(); return; }

    await markHarvestRunning(); // heartbeat
    const result = await harvestBatch(state.nextIndex, 3);
    if (result.done || result.rateLimited) { await clearHarvestRunning(); return; }

    // Kick the next step (a fresh invocation) and return quickly.
    await fetch(`${origin}/api/admin/harvest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ chain: true, startedAt }),
    });
  } catch {
    await clearHarvestRunning();
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const state = await getHarvestState();
  const running = await getHarvestRunning();
  return NextResponse.json({
    ...state,
    done: state.nextIndex >= state.totalQueries,
    running: running > 0 && Date.now() - running < RUN_LEASE_MS,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const origin = new URL(req.url).origin;
  const cookie = req.headers.get('cookie') ?? '';

  // Stop the running chain.
  if (body.stop) {
    await requestHarvestStop();
    await clearHarvestRunning();
    return NextResponse.json({ stopped: true });
  }
  if (body.reset) await resetHarvestState();

  const isChain = body.chain === true;
  if (!isChain) {
    // Don't start a second chain if one is already alive.
    const running = await getHarvestRunning();
    if (running > 0 && Date.now() - running < RUN_LEASE_MS) {
      const state = await getHarvestState();
      return NextResponse.json({ ...state, done: state.nextIndex >= state.totalQueries, running: true });
    }
    await markHarvestRunning();
  }
  const startedAt = isChain ? Number(body.startedAt) || Date.now() : Date.now();

  // Run the batch + chain after the response, so this request returns fast and
  // the work continues server-side regardless of the client.
  after(() => runChainStep(origin, cookie, startedAt));

  const state = await getHarvestState();
  return NextResponse.json({ ...state, done: state.nextIndex >= state.totalQueries, running: true, started: true });
}
