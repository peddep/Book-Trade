// Which periods two students share, from the weekly grids they filled in when
// they signed up. Turning a shared period into an actual appointment — which
// day, and which of the two ten-minute windows within it — is a capacity
// decision (the library only fits one pair at a time) made server-side in
// lib/hub.ts's assignMeetingSlot, and stored on the trade; see
// lib/meetingSlots.ts for the fixed times and display of that decision.

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
