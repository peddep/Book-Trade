'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BookThumb from '@/components/BookThumb';
import { useI18n } from '@/lib/i18n';

interface Trade {
  id: number;
  requester_id: number;
  owner_id: number;
  offered_title: string;
  offered_author: string;
  offered_color: string;
  offered_cover_url?: string | null;
  offered_title_en?: string | null;
  offered_condition: string;
  wanted_title: string;
  wanted_author: string;
  wanted_color: string;
  wanted_cover_url?: string | null;
  wanted_title_en?: string | null;
  wanted_condition: string;
  requester_name: string;
  requester_avatar: string;
  owner_name: string;
  owner_avatar: string;
  status: string;
  message?: string;
  created_at: string;
}

interface User {
  id: number;
  name: string;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; labelKey: string }> = {
  pending:   { bg: '#2d2a00', color: '#fbbf24', labelKey: 'trades.pending' },
  accepted:  { bg: '#0d2b1a', color: '#10b981', labelKey: 'trades.accepted' },
  rejected:  { bg: '#2d0a0a', color: '#ef4444', labelKey: 'trades.rejected' },
  cancelled: { bg: '#1a1a2e', color: '#64748b', labelKey: 'trades.cancelled' },
};

export default function TradesPage() {
  const { t, bookTitle } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      setUser(d.user);
    });
    fetchTrades();
  }, [router]);

  async function fetchTrades() {
    setLoading(true);
    const res = await fetch('/api/trades');
    if (res.ok) {
      const data = await res.json();
      setTrades(data.trades ?? []);
    }
    setLoading(false);
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/trades/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchTrades();
  }

  const filtered = trades.filter(t => {
    if (filter === 'incoming') return t.owner_id === user?.id;
    if (filter === 'outgoing') return t.requester_id === user?.id;
    return true;
  });

  if (!user) return null;

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{t('trades.title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('trades.subtitle')}</p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
            {(['all', 'incoming', 'outgoing'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={filter === f ? { background: '#6366f1', color: 'white' } : { color: '#94a3b8' }}
              >
                {t(`trades.${f}`)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">{t('trades.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🤝</div>
            <p className="text-slate-400 text-lg">{t('trades.none')}</p>
            <p className="text-slate-500 text-sm mt-1">{t('trades.noneHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map(trade => {
              const isIncoming = trade.owner_id === user.id;
              const style = STATUS_STYLES[trade.status] ?? STATUS_STYLES.cancelled;
              return (
                <div
                  key={trade.id}
                  className="p-5 rounded-2xl"
                  style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full mr-2"
                        style={{ background: isIncoming ? '#1e1e3a' : '#1a2a1a', color: isIncoming ? '#a78bfa' : '#10b981' }}
                      >
                        {isIncoming ? t('trades.incomingTag') : t('trades.outgoingTag')}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.color }}>
                        {t(style.labelKey)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {new Date(trade.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Trade visualization */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 p-3 rounded-xl" style={{ background: '#0f0f1a' }}>
                      <p className="text-xs text-slate-400 mb-1">{isIncoming ? t('trades.userOffers', { name: trade.requester_name }) : t('trades.youOffer')}</p>
                      <div className="flex items-center gap-2">
                        <BookThumb coverUrl={trade.offered_cover_url} coverColor={trade.offered_color} />
                        <div>
                          <p className="text-sm font-semibold text-white leading-tight">{bookTitle(trade.offered_title, trade.offered_title_en)}</p>
                          <p className="text-xs text-slate-400">{trade.offered_author}</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-2xl flex-shrink-0">⇄</div>

                    <div className="flex-1 p-3 rounded-xl" style={{ background: '#0f0f1a' }}>
                      <p className="text-xs text-slate-400 mb-1">{isIncoming ? t('trades.wantsYour') : t('trades.usersBook', { name: trade.owner_name })}</p>
                      <div className="flex items-center gap-2">
                        <BookThumb coverUrl={trade.wanted_cover_url} coverColor={trade.wanted_color} />
                        <div>
                          <p className="text-sm font-semibold text-white leading-tight">{bookTitle(trade.wanted_title, trade.wanted_title_en)}</p>
                          <p className="text-xs text-slate-400">{trade.wanted_author}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {trade.message && (
                    <div className="p-3 rounded-xl mb-4 text-sm text-slate-300" style={{ background: '#0f0f1a', borderLeft: '3px solid #6366f1' }}>
                      &ldquo;{trade.message}&rdquo;
                    </div>
                  )}

                  {/* Actions */}
                  {trade.status === 'pending' && (
                    <div className="flex gap-2">
                      {isIncoming ? (
                        <>
                          <button
                            onClick={() => updateStatus(trade.id, 'accepted')}
                            className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                          >
                            {t('trades.accept')}
                          </button>
                          <button
                            onClick={() => updateStatus(trade.id, 'rejected')}
                            className="px-4 py-2 rounded-xl text-sm font-bold"
                            style={{ background: '#2d0a0a', color: '#ef4444' }}
                          >
                            {t('trades.decline')}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => updateStatus(trade.id, 'cancelled')}
                          className="px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: '#2d2d4a', color: '#94a3b8' }}
                        >
                          {t('trades.cancelOffer')}
                        </button>
                      )}
                    </div>
                  )}

                  {trade.status === 'accepted' && (
                    <div className="p-3 rounded-xl text-sm font-semibold" style={{ background: '#0d2b1a', color: '#10b981' }}>
                      {t('trades.acceptedMsg')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
