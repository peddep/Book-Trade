import { NextRequest, NextResponse } from 'next/server';
import { getHarvestState, harvestBatch, resetHarvestState } from '@/lib/harvest';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Daily automated Thai-book harvest, invoked by Vercel Cron.
// Runs a few queries per day; when the query list is exhausted it starts
// over from the beginning so new releases keep flowing into the catalog.
export async function GET(req: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the env var is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let state = await getHarvestState();
  if (state.nextIndex >= state.totalQueries) {
    await resetHarvestState(); // cycle back to the first query
    state = await getHarvestState();
  }

  const result = await harvestBatch(state.nextIndex, 3);
  return NextResponse.json({ ok: true, ...result });
}
