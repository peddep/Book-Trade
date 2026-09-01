// Working out when two students can meet, from the weekly grids they filled in
// when they signed up.
//
// Both the student's meet-up page and the admin's list of upcoming meet-ups
// need this answer, and they must not disagree about it: a teacher looking at
// the library rota should see the day and period the two students were shown.

// When each slot starts, on the ordinary timetable — the one where periods run
// their full length. On a day the school shortens them these times move, which
// is why the pages that show a meeting say which timetable they assume rather
// than presenting the time as certain.
const SLOT_TIME: Record<string, [number, number]> = { p4: [12, 0], p5: [12, 55], after: [16, 10] };
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
//
// Work this out in the browser, never on the server. A period is a time on the
// school's clock, but `nextMeeting` builds it with the local clock of whatever
// machine runs it — so a server in UTC turned "period 5, 12:55" into an instant
// that a phone in Bangkok then displayed as 19:30. The two students and the
// teacher looking at the same meet-up must be told the same time.
export function meetingFor(availA?: string | null, availB?: string | null) {
  return nextMeeting(overlap(availA, availB));
}

// One wording for a meeting, so the student's card and the admin's list cannot
// drift apart in how they say it.
export function meetingDateText(date: Date, lang: string, weekday: 'long' | 'short' = 'long'): string {
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  return `${date.toLocaleDateString(locale, { weekday, day: 'numeric', month: 'short' })}`
    + ` · ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
}
