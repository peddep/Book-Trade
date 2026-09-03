// Reading the times the database wrote.
//
// SQLite's datetime('now') writes "2026-09-02 00:51:48" — UTC, with nothing to
// say so. A browser handed that string parses it as *local* time, so a
// notification written at 07:51 in Bangkok was shown as 00:51, and a date near
// midnight came out a day early. Everything the app stores goes through here.

export function parseDbTime(value?: string | null): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  // Already carries a zone (an ISO instant we wrote ourselves): trust it.
  const iso = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// "just now", "5 min ago", "2 h ago", "3 d ago", then a plain date. Takes the
// i18n `t` so both languages read naturally rather than being assembled here.
export function timeAgo(
  value: string | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
  lang: string,
): string {
  const d = parseDbTime(value);
  if (!d) return '';
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return t('time.justNow');
  const mins = Math.round(secs / 60);
  if (mins < 60) return t('time.minutes', { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('time.hours', { n: hours });
  const days = Math.round(hours / 24);
  if (days <= 7) return t('time.days', { n: days });
  return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' });
}
