'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Loading from '@/components/Loading';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { coverFor } from '@/lib/cover';

// Small book-shaped cover for the traded books.
function MiniCover({ url, color, title }: { url?: string | null; color: string; title: string }) {
  return (
    <div className="relative rounded-r-md rounded-l-sm overflow-hidden flex-shrink-0"
      style={{ width: 60, aspectRatio: '2 / 3', background: color, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="absolute inset-0 w-full h-full object-cover" loading="lazy"
          onError={e => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-lg">📖</span>
      )}
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.3), rgba(0,0,0,0))' }} />
    </div>
  );
}

interface Trade {
  id: number;
  requester_id: number;
  owner_id: number;
  offered_title: string;
  offered_author: string;
  offered_color: string;
  offered_book_id: number;
  offered_cover_len?: number | null;
  offered_title_en?: string | null;
  offered_condition: string;
  wanted_title: string;
  wanted_author: string;
  wanted_color: string;
  wanted_book_id: number;
  wanted_cover_len?: number | null;
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
  // A finished swap had no entry here, and the fallback below called everything
  // it did not recognise "cancelled" — so every trade a student actually
  // completed told them it had been called off.
  completed: { bg: '#ede9fe', color: '#7c3aed', labelKey: 'trades.completed' },
};

// Anything not listed above is shown plainly rather than dressed up as one of
// these: a status this page has not been taught yet should look unfamiliar,
// not wrong.
const UNKNOWN_STATUS = { bg: '#f3f4f6', color: '#6b7280', labelKey: '' };

export default function TradesPage() {
  const { t, bookTitle } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  // Session comes from the shared provider; `loading` below is about the trade
  // list this page fetches, which is a separate thing.
  const { user, loading: sessionLoading } = useSession();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const router = useRouter();

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { router.replace('/'); return; }
    fetchTrades();
  }, [router, user, sessionLoading]);

  // Only the first read shows the loading state. A refresh that follows an
  // action the student has already seen take effect must not blank the list
  // and rebuild it underneath them.
  const loadedOnce = useRef(false);
  async function fetchTrades(quiet = false) {
    if (!quiet && !loadedOnce.current) setLoading(true);
    const res = await fetch('/api/trades');
    if (res.ok) {
      const data = await res.json();
      setTrades(data.trades ?? []);
    }
    loadedOnce.current = true;
    setLoading(false);
  }

  async function updateStatus(id: number, status: string) {
    // Show the answer at once: accepting or declining is a decision the
    // student has already made, and watching the whole list reload before it
    // takes effect makes the button feel like it did not register.
    const before = trades;
    setTrades(prev => prev.map(t => (t.id === id ? { ...t, status } : t)));
    try {
      const res = await fetch(`/api/trades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setTrades(before);
        const d = await res.json().catch(() => ({}));
        alert(d.error === 'books_changed' ? t('trades.booksChanged')
          : d.error === 'price_gap' ? t('err.priceGap')
          : d.error === 'stale_trade' ? t('trades.alreadySettled')
          : t('trades.actionFailed'));
        return;
      }
      // Accepting also cancels the other offers for the same book, which only
      // the server knows about — pick those up quietly, behind the list that
      // is already showing the right answer for this one.
      fetchTrades(true);
    } catch {
      setTrades(before);
      alert(t('trades.actionFailed'));
    }
  }

  const filtered = trades.filter(t => {
    if (filter === 'incoming') return t.owner_id === user?.id;
    if (filter === 'outgoing') return t.requester_id === user?.id;
    return true;
  });

  if (!user) return (
    <>
      <Loading />
    </>
  );

  return (
    <>
      <main className="max-w-4xl xl:max-w-6xl mx-auto px-4 lg:px-8 py-8">
        <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <div className="mt-2 mb-4">
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            {filtered.map(trade => {
              const isIncoming = trade.owner_id === user.id;
              const style = STATUS_STYLES[trade.status] ?? UNKNOWN_STATUS;
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
                        {style.labelKey ? t(style.labelKey) : trade.status}
                      </span>
                    </div>
                    <span className="text-xs text-[#9ca3af] flex-shrink-0">
                      {new Date(trade.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Clickable profile of the other person */}
                  {(() => {
                    const otherId = isIncoming ? trade.requester_id : trade.owner_id;
                    const otherName = isIncoming ? trade.requester_name : trade.owner_name;
                    const otherAvatar = isIncoming ? trade.requester_avatar : trade.owner_avatar;
                    return (
                      <Link href={`/u/${otherId}`} className="inline-flex items-center gap-2 mb-4 px-2 py-1 rounded-full hover:opacity-80" style={{ background: '#f5f3ff', border: '1px solid #e9d5ff' }}>
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: otherAvatar }}>
                          {otherName[0].toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-[#2e1065]">{otherName}</span>
                        <span className="text-xs" style={{ color: '#7c3aed' }}>{t('user.viewProfile')} ›</span>
                      </Link>
                    );
                  })()}

                  {/* Trade visualization */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 p-3 rounded-xl" style={{ background: '#ffffff' }}>
                      <p className="text-xs text-[#6b7280] mb-1">{isIncoming ? t('trades.userOffers', { name: trade.requester_name }) : t('trades.youOffer')}</p>
                      <div className="flex items-center gap-2">
                        <MiniCover url={coverFor(trade.offered_book_id, trade.offered_cover_len)} color={trade.offered_color} title={bookTitle(trade.offered_title, trade.offered_title_en)} />
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
                        <MiniCover url={coverFor(trade.wanted_book_id, trade.wanted_cover_len)} color={trade.wanted_color} title={bookTitle(trade.wanted_title, trade.wanted_title_en)} />
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
