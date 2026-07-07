'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Loading from '@/components/Loading';
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
  pending:   { bg: '#fef9c3', color: '#b45309', labelKey: 'trades.pending' },
  accepted:  { bg: '#dcfce7', color: '#10b981', labelKey: 'trades.accepted' },
  rejected:  { bg: '#fee2e2', color: '#ef4444', labelKey: 'trades.rejected' },
  cancelled: { bg: '#f3f4f6', color: '#9ca3af', labelKey: 'trades.cancelled' },
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

  if (!user) return (
    <>
      <Navbar />
      <Loading />
    </>
  );

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065]">{t('trades.title')}</h1>
          <p className="text-[#6b7280] text-sm mt-1">{t('trades.subtitle')}</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl mb-6 w-full sm:w-fit" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          {(['all', 'incoming', 'outgoing'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={filter === f ? { background: '#6366f1', color: 'white' } : { color: '#6b7280' }}
            >
              {t(`trades.${f}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#6b7280]">{t('trades.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🤝</div>
            <p className="text-[#6b7280] text-lg">{t('trades.none')}</p>
            <p className="text-[#9ca3af] text-sm mt-1">{t('trades.noneHint')}</p>
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
                  style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full mr-2"
                        style={{ background: isIncoming ? '#ede9fe' : '#dcfce7', color: isIncoming ? '#7c3aed' : '#10b981' }}
                      >
                        {isIncoming ? t('trades.incomingTag') : t('trades.outgoingTag')}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.color }}>
                        {t(style.labelKey)}
                      </span>
                    </div>
                    <span className="text-xs text-[#9ca3af] flex-shrink-0">
                      {new Date(trade.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Trade visualization */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 p-3 rounded-xl" style={{ background: '#ffffff' }}>
                      <p className="text-xs text-[#6b7280] mb-1">{isIncoming ? t('trades.userOffers', { name: trade.requester_name }) : t('trades.youOffer')}</p>
                      <div className="flex items-center gap-2">
                        <BookThumb coverUrl={trade.offered_cover_url} coverColor={trade.offered_color} />
                        <div>
                          <p className="text-sm font-semibold text-[#2e1065] leading-tight">{bookTitle(trade.offered_title, trade.offered_title_en)}</p>
                          <p className="text-xs text-[#6b7280]">{trade.offered_author}</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-2xl flex-shrink-0">⇄</div>

                    <div className="flex-1 p-3 rounded-xl" style={{ background: '#ffffff' }}>
                      <p className="text-xs text-[#6b7280] mb-1">{isIncoming ? t('trades.wantsYour') : t('trades.usersBook', { name: trade.owner_name })}</p>
                      <div className="flex items-center gap-2">
                        <BookThumb coverUrl={trade.wanted_cover_url} coverColor={trade.wanted_color} />
                        <div>
                          <p className="text-sm font-semibold text-[#2e1065] leading-tight">{bookTitle(trade.wanted_title, trade.wanted_title_en)}</p>
                          <p className="text-xs text-[#6b7280]">{trade.wanted_author}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {trade.message && (
                    <div className="p-3 rounded-xl mb-4 text-sm text-[#4b5563]" style={{ background: '#ffffff', borderLeft: '3px solid #6366f1' }}>
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
                            style={{ background: '#fee2e2', color: '#ef4444' }}
                          >
                            {t('trades.decline')}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => updateStatus(trade.id, 'cancelled')}
                          className="px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: '#e9d5ff', color: '#6b7280' }}
                        >
                          {t('trades.cancelOffer')}
                        </button>
                      )}
                    </div>
                  )}

                  {trade.status === 'accepted' && (
                    <div className="p-3 rounded-xl text-sm font-semibold" style={{ background: '#dcfce7', color: '#10b981' }}>
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
