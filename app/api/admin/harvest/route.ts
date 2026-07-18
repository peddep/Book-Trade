import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { getHarvestState, harvestBatch, resetHarvestState } from '@/lib/harvest';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const state = await getHarvestState();
  return NextResponse.json({ ...state, done: state.nextIndex >= state.totalQueries });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body.reset) {
    await resetHarvestState();
  }

  const state = await getHarvestState();
  if (state.nextIndex >= state.totalQueries && !body.reset) {
    return NextResponse.json({ ...state, done: true, rateLimited: false, inserted: 0 });
  }

  const result = await harvestBatch(state.nextIndex, 3);
  return NextResponse.json(result);
}
