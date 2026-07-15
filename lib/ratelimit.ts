import { getDb } from './db';

// Simple per-user rate limit: true when the user has created >= `max` rows in
// `table` within the last `seconds`. Counts existing timestamped rows, so no
// extra state table is needed. `table` and `userCol` are hardcoded by callers
// (never user input) so the interpolation is safe.
export async function tooManyRecent(
  table: string,
  userCol: string,
  userId: number,
  seconds: number,
  max: number,
): Promise<boolean> {
  try {
    const r = await getDb().execute({
      sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${userCol} = ? AND created_at > datetime('now', ?)`,
      args: [userId, `-${seconds} seconds`],
    });
    return Number(r.rows[0].n) >= max;
  } catch {
    return false; // never block on a limiter error
  }
}

// In-memory sliding window keyed by an arbitrary string (e.g. an IP), for
// endpoints with no user row yet (registration). Per warm instance only, but
// enough to stop a naive signup flood.
const hits = new Map<string, number[]>();
export function ipRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every(t => now - t >= windowMs)) hits.delete(k);
  }
  return arr.length > max;
}
