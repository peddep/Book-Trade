'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { timeAgo } from '@/lib/time';
import PushToggle from '@/components/PushToggle';

interface Notification {
  id: number;
  kind: string;
  actor: string | null;
  subject: string | null;
  link: string | null;
  read: number;
  created_at: string;
}

const ICONS: Record<string, string> = {
  trade_offer: '🤝',
  trade_accepted: '✅',
  trade_rejected: '❌',
  trade_cancelled: '↩️',
  trade_completed: '🎉',
  wonderbox_match: '✨',
};

// Bell with an unread count. The site is the only place a student finds out
// that someone offered them a trade, so this is the thing that makes an offer
// visible after they have closed the tab.
export default function NotificationBell() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const d = await res.json();
      setItems(d.notifications ?? []);
      setUnread(d.unread ?? 0);
    } catch { /* offline; try again on the next tick */ }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  // Close when tapping outside.
  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  async function markAll() {
    setUnread(0);
    setItems(prev => prev.map(n => ({ ...n, read: 1 })));
    await fetch('/api/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }),
    });
  }

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.read) {
      setUnread(u => Math.max(0, u - 1));
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, read: 1 } : x)));
      fetch('/api/notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        className="relative w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 bt-press"
        style={{ background: '#e9d5ff' }}
        aria-label={t('notif.title')}
      >
        <span className="text-base leading-none">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: '#ef4444' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl shadow-lg z-50 overflow-hidden bt-pop-in"
          style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #e9d5ff' }}>
            <p className="text-sm font-bold text-[#2e1065]">{t('notif.title')}</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] font-semibold" style={{ color: '#7c3aed' }}>
                {t('notif.markAll')}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-[#9ca3af] text-center py-8 px-4">{t('notif.empty')}</p>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="block w-full text-left px-4 py-2.5 hover:bg-[#faf5ff]"
                  style={{ borderBottom: '1px solid #f3e8ff', background: n.read ? undefined : '#f5f3ff' }}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base leading-none mt-0.5">{ICONS[n.kind] ?? '🔔'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-[#2e1065]">
                        {t(`notif.${n.kind}`, { actor: n.actor ?? '', subject: n.subject ?? '' })}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>{timeAgo(n.created_at, t, lang)}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: '#7c3aed' }} />}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="px-3 py-2" style={{ borderTop: '1px solid #e9d5ff' }}>
            <PushToggle />
          </div>
        </div>
      )}
    </div>
  );
}
