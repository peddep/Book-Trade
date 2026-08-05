import { getDb } from './db';

// The events a student is told about. Each maps to a `notif.<kind>` string in
// the i18n table, rendered with {actor} and {subject}.
export type NotifyKind =
  | 'trade_offer'      // someone offered a trade on your book
  | 'trade_accepted'   // your offer was accepted
  | 'trade_rejected'   // your offer was turned down
  | 'trade_cancelled'  // the other side pulled out
  | 'trade_completed'  // both sides confirmed the swap happened
  | 'wonderbox_match'; // the Wonder Box paired your book with someone

interface Options {
  actor?: string | null;   // the other student's name
  subject?: string | null; // the book it is about
  link?: string;           // where tapping it should go
}

// Records something for a student to find later. Never throws: a notification
// failing must not take down the action that caused it — a trade offer still
// stands even if we could not write the note about it.
export async function notify(userId: number, kind: NotifyKind, opts: Options = {}) {
  try {
    await getDb().execute({
      sql: 'INSERT INTO notifications (user_id, kind, actor, subject, link) VALUES (?, ?, ?, ?, ?)',
      args: [userId, kind, opts.actor ?? null, opts.subject ?? null, opts.link ?? null],
    });
  } catch {
    // table not created yet on a very old database, or a transient write error
  }
}

// Same, for both sides of a trade at once.
export async function notifyBoth(a: number, b: number, kind: NotifyKind, opts: Options = {}) {
  await Promise.all([notify(a, kind, opts), notify(b, kind, opts)]);
}
