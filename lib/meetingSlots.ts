// Where, exactly, two students hand books over — not just "period 4", but
// which ten minutes of it. The library has room for one pair at a time, so
// each period is split into two ten-minute windows: at most two pairs share
// a period, one right after the other.
//
// Client-safe and pure — no DB, no server clock. The scheduling decision
// itself (which pair gets which window, and what happens once both are
// taken) is server-side, in lib/hub.ts; this only holds the fixed times and
// turns a stored (date, period, sub) into something to display.

export type Period = 'p4' | 'p5' | 'after';

export const SUB_SLOT_TIMES: Record<Period, [[number, number], [number, number]]> = {
  p4: [[11, 55], [12, 5]],
  p5: [[12, 50], [13, 0]],
  after: [[16, 5], [16, 15]],
};
export const SLOT_DURATION_MIN = 10;
export const SLOTS_PER_PERIOD = 2;

// A plain local Date built from a 'YYYY-MM-DD' wall-clock date plus an
// hour/minute — deliberately not parsed as UTC/ISO, so it only ever means
// the right thing in the timezone it is read back in. That is safe here
// because everyone reading it (a student's phone, the admin's browser) is in
// the school's own timezone.
export function localDate(dateStr: string, hh: number, mm: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function meetingWindow(dateStr: string, period: Period, sub: number): { start: Date; end: Date } {
  const [hh, mm] = SUB_SLOT_TIMES[period][sub] ?? SUB_SLOT_TIMES[period][0];
  const start = localDate(dateStr, hh, mm);
  const end = new Date(start.getTime() + SLOT_DURATION_MIN * 60_000);
  return { start, end };
}

// One wording for an assigned meeting, so the student's card and the
// admin's list cannot drift apart in how they say it.
export function meetingWindowText(dateStr: string, period: Period, sub: number, lang: string, weekday: 'long' | 'short' = 'long'): string {
  const { start, end } = meetingWindow(dateStr, period, sub);
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  const datePart = start.toLocaleDateString(locale, { weekday, day: 'numeric', month: 'short' });
  const timeOf = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timeOf(start)}-${timeOf(end)}`;
}
