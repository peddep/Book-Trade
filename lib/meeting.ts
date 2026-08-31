// Working out when two students can meet, from the weekly grids they filled in
// when they signed up.
//
// Both the student's meet-up page and the admin's list of upcoming meet-ups
// need this answer, and they must not disagree about it: a teacher looking at
// the library rota should see the day and period the two students were shown.

// Clock time each slot starts at (school schedule).
const SLOT_TIME: Record<string, [number, number]> = { p4: [11, 40], p5: [12, 30], after: [15, 30] };
export const SLOT_ORDER = ['p4', 'p5', 'after'];
export const SLOT_KEYS: Record<string, string> = { p4: 'reg.slotP4', p5: 'reg.slotP5', after: 'reg.slotAfter' };

export function parseAvail(raw?: string | null): string[] {
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}

// Every slot in the grid, used when someone says they are free any time.
const ALL_SLOTS = SLOT_ORDER.flatMap(s => [0, 1, 2, 3, 4].map(d => `${s}-${d}`));

// Shared slot keys, sorted by slot then day for stable display. Someone marked
// flexible matches whatever the other person picked, so a pair whose grids
// genuinely never line up — different years eat lunch at different times — is
// not told there is no time when one of them is happy to fit in.
export function overlap(a?: string | null, b?: string | null): string[] {
  const listA = parseAvail(a);
  const listB = parseAvail(b);
  const realA = listA.includes('any') ? ALL_SLOTS : listA;
  const realB = listB.includes('any') ? ALL_SLOTS : listB;
  const setB = new Set(realB);
  return realA
    .filter(k => k !== 'any' && setB.has(k))
    .sort((x, y) => {
      const [sx, dx] = x.split('-'); const [sy, dy] = y.split('-');
      return SLOT_ORDER.indexOf(sx) - SLOT_ORDER.indexOf(sy) || Number(dx) - Number(dy);
    });
}

// The soonest upcoming date+time both users share, based on their weekly grids.
export function nextMeeting(shared: string[]): { date: Date; slot: string } | null {
  const now = new Date();
  let best: { date: Date; slot: string } | null = null;
  for (const key of shared) {
    const [slot, dayStr] = key.split('-');
    const targetDow = Number(dayStr) + 1; // grid day 0 = Monday; JS Sunday = 0
    const [hh, mm] = SLOT_TIME[slot] ?? [12, 0];
    for (let add = 0; add <= 7; add++) {
      const d = new Date(now);
      d.setDate(now.getDate() + add);
      d.setHours(hh, mm, 0, 0);
      if (d.getDay() === targetDow && d.getTime() > now.getTime()) {
        if (!best || d < best.date) best = { date: d, slot };
        break;
      }
    }
  }
  return best;
}

// The two students' grids straight to a meeting, which is what both callers
// actually want.
export function meetingFor(availA?: string | null, availB?: string | null) {
  return nextMeeting(overlap(availA, availB));
}
