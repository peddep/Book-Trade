import webPush from 'web-push';
import { getDb } from './db';
import { ensureHubTables } from './hub';
import type { NotifyKind } from './notify';
import { pushBody } from './pushMessages';

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidSet = false;
function ensureVapid() {
  if (vapidSet || !pushConfigured()) return;
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidSet = true;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Saves or refreshes one device's subscription. Keyed on endpoint (unique per
// device+browser), so re-subscribing the same device just updates its row
// rather than creating a duplicate.
export async function saveSubscription(userId: number, sub: PushSubscriptionJSON): Promise<void> {
  await ensureHubTables();
  await getDb().execute({
    sql: `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    args: [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth],
  });
}

export async function removeSubscription(endpoint: string, userId?: number): Promise<void> {
  await ensureHubTables();
  if (userId != null) {
    await getDb().execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', args: [endpoint, userId] });
  } else {
    await getDb().execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [endpoint] });
  }
}

// Fire-and-forget: sends a push to every device the student has enabled
// notifications on. Never throws — a push failing must not take down the
// action (a trade offer, say) that triggered it. A subscription the push
// service reports as gone (uninstalled, permission revoked) is dropped so it
// stops being retried forever.
export async function sendPush(userId: number, kind: NotifyKind, opts: { actor?: string | null; subject?: string | null; link?: string }) {
  if (!pushConfigured()) return;
  ensureVapid();
  try {
    await ensureHubTables();
    const rows = await getDb().execute({
      sql: 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
      args: [userId],
    });
    if (rows.rows.length === 0) return;
    const payload = JSON.stringify({
      title: 'เล่มแลกเล่ม',
      body: pushBody(kind, opts),
      url: opts.link ?? '/trade',
    });
    await Promise.all(rows.rows.map(async (r) => {
      const row = r as unknown as { id: number; endpoint: string; p256dh: string; auth: string };
      try {
        await webPush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await getDb().execute({ sql: 'DELETE FROM push_subscriptions WHERE id = ?', args: [row.id] }).catch(() => {});
        }
      }
    }));
  } catch {
    // best-effort only
  }
}
