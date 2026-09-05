'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

// Base64url (the alphabet a VAPID key and a push subscription both use) to
// the raw bytes pushManager.subscribe() wants for applicationServerKey.
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0))).buffer;
}

type State = 'checking' | 'unsupported' | 'off' | 'on' | 'denied';

// A one-tap way to turn on phone-style notifications for this device. Every
// notification the site already tracks (a trade offer, an accepted swap, a
// Wonder Box match) gets pushed the same way once this is on — there is
// nothing extra to configure per notification kind.
export default function PushToggle() {
  const { t } = useI18n();
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    navigator.serviceWorker.getRegistration('/').then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    }).catch(() => setState('off'));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error('save failed');
      setState('on');
    } catch {
      setState('off');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'checking') return null;
  if (state === 'unsupported') return <p className="text-xs text-[#9ca3af] text-center py-2">{t('push.unsupported')}</p>;
  if (state === 'denied') return <p className="text-xs text-[#9ca3af] text-center py-2">{t('push.denied')}</p>;
  if (state === 'on') return <p className="text-xs font-semibold text-center py-2" style={{ color: '#10b981' }}>{t('push.enabled')}</p>;

  return (
    <button
      onClick={enable}
      disabled={busy}
      className="w-full text-center text-xs font-semibold py-2 rounded-lg disabled:opacity-50"
      style={{ background: '#ede9fe', color: '#7c3aed' }}
    >
      {t('push.enable')}
    </button>
  );
}
