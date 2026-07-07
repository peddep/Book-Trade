'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Loading from '@/components/Loading';
import { useI18n } from '@/lib/i18n';

const DAY_KEYS = ['day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri'];
const SLOT_KEYS: Record<string, string> = { p4: 'reg.slotP4', p5: 'reg.slotP5', after: 'reg.slotAfter' };
const SLOT_ORDER = ['p4', 'p5', 'after'];

interface Trade {
  id: number;
  requester_id: number;
  owner_id: number;
  status: string;
  requester_confirm?: string | null;
  owner_confirm?: string | null;
  requester_name: string;
  requester_avatar: string;
  requester_availability?: string | null;
  owner_name: string;
  owner_avatar: string;
  owner_availability?: string | null;
  offered_title: string;
  offered_title_en?: string | null;
  offered_color: string;
  offered_cover_url?: string | null;
  wanted_title: string;
  wanted_title_en?: string | null;
  wanted_color: string;
  wanted_cover_url?: string | null;
}

interface User { id: number; }

function MiniCover({ url, color, title }: { url?: string | null; color: string; title: string }) {
  return (
    <div className="relative rounded-r-md rounded-l-sm overflow-hidden flex-shrink-0"
      style={{ width: 54, aspectRatio: '2 / 3', background: color, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
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

function parseAvail(raw?: string | null): string[] {
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}

// Shared slot keys, sorted by slot then day for stable display.
function overlap(a?: string | null, b?: string | null): string[] {
  const setB = new Set(parseAvail(b));
  return parseAvail(a)
    .filter(k => setB.has(k))
    .sort((x, y) => {
      const [sx, dx] = x.split('-'); const [sy, dy] = y.split('-');
      return SLOT_ORDER.indexOf(sx) - SLOT_ORDER.indexOf(sy) || Number(dx) - Number(dy);
    });
}

export default function IrlTradePage() {
  const { t, bookTitle } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'confirm' | 'history'>('upcoming');
  const router = useRouter();

  const fetchTrades = useCallback(async () => {
    const res = await fetch('/api/trades');
    if (res.ok) setTrades((await res.json()).trades ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      setUser(d.user);
    });
    fetchTrades();
  }, [router, fetchTrades]);

  async function confirm(id: number, value: 'happened' | 'not') {
    await fetch(`/api/trades/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: value }),
    });
    fetchTrades();
  }

  if (!user) return (<><Navbar /><Loading /></>);

  const inProgress = trades.filter(t => t.status === 'accepted');
  const history = trades.filter(t => t.status === 'completed' || t.status === 'cancelled');
  const shown = tab === 'history' ? history : inProgress;

  const TABS = [
    { key: 'upcoming', label: 'irl.tabUpcoming', icon: '📅', n: inProgress.length },
    { key: 'confirm', label: 'irl.tabConfirm', icon: '🤝', n: inProgress.length },
    { key: 'history', label: 'irl.tabHistory', icon: '📜', n: history.length },
  ] as const;

  function slotLabel(key: string) {
    const [slot, day] = key.split('-');
    return `${t(DAY_KEYS[Number(day)])} · ${t(SLOT_KEYS[slot])}`;
  }

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065] mt-2">🤝 {t('irl.title')}</h1>
        <p className="text-sm text-[#6b7280] mb-5">{t('irl.subtitle')}</p>

        {/* Stage tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          {TABS.map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className="flex-1 px-2 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={tab === tb.key ? { background: '#7c3aed', color: 'white' } : { color: '#6b7280' }}>
              {tb.icon} {t(tb.label)}{tb.n > 0 ? ` (${tb.n})` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-[#6b7280]">…</div>
        ) : shown.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">{tab === 'history' ? '📜' : '📅'}</div>
            <p className="text-[#6b7280]">
              {tab === 'history' ? t('irl.noneHistory') : tab === 'confirm' ? t('irl.noneConfirm') : t('irl.noneUpcoming')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {shown.map(trade => {
              const isRequester = trade.requester_id === user.id;
              // From the current user's perspective: they give their side's book, get the other.
              const give = isRequester
                ? { title: trade.offered_title, title_en: trade.offered_title_en, color: trade.offered_color, url: trade.offered_cover_url }
                : { title: trade.wanted_title, title_en: trade.wanted_title_en, color: trade.wanted_color, url: trade.wanted_cover_url };
              const get = isRequester
                ? { title: trade.wanted_title, title_en: trade.wanted_title_en, color: trade.wanted_color, url: trade.wanted_cover_url }
                : { title: trade.offered_title, title_en: trade.offered_title_en, color: trade.offered_color, url: trade.offered_cover_url };
              const otherName = isRequester ? trade.owner_name : trade.requester_name;
              const otherAvatar = isRequester ? trade.owner_avatar : trade.requester_avatar;
              const otherId = isRequester ? trade.owner_id : trade.requester_id;
              const myConfirm = isRequester ? trade.requester_confirm : trade.owner_confirm;
              const otherConfirm = isRequester ? trade.owner_confirm : trade.requester_confirm;
              const shared = overlap(trade.requester_availability, trade.owner_availability);

              return (
                <div key={trade.id} className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
                  {/* Who */}
                  <Link href={`/u/${otherId}`} className="inline-flex items-center gap-2 mb-4 px-2 py-1 rounded-full hover:opacity-80" style={{ background: '#f5f3ff', border: '1px solid #e9d5ff' }}>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: otherAvatar }}>
                      {otherName[0].toUpperCase()}
                    </span>
                    <span className="text-sm text-[#6b7280]">{t('irl.with')}</span>
                    <span className="text-sm font-semibold text-[#2e1065]">{otherName}</span>
                  </Link>

                  {/* Books: give / get */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1">
                      <p className="text-xs text-[#6b7280] mb-1">{t('irl.give')}</p>
                      <div className="flex items-center gap-2">
                        <MiniCover url={give.url} color={give.color} title={bookTitle(give.title, give.title_en)} />
                        <p className="text-sm font-semibold text-[#2e1065] leading-tight">{bookTitle(give.title, give.title_en)}</p>
                      </div>
                    </div>
                    <div className="text-xl flex-shrink-0">⇄</div>
                    <div className="flex-1">
                      <p className="text-xs text-[#6b7280] mb-1">{t('irl.get')}</p>
                      <div className="flex items-center gap-2">
                        <MiniCover url={get.url} color={get.color} title={bookTitle(get.title, get.title_en)} />
                        <p className="text-sm font-semibold text-[#2e1065] leading-tight">{bookTitle(get.title, get.title_en)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stage-specific body */}
                  {tab === 'upcoming' && (
                    <div className="p-3 rounded-xl" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                      <p className="text-sm font-semibold text-[#2e1065] mb-2">{t('irl.meetAt')}</p>
                      <p className="text-xs font-semibold text-[#6b7280] mb-1">{t('irl.when')}</p>
                      {shared.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {shared.map(k => (
                            <span key={k} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                              {slotLabel(k)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#9ca3af] mb-3">{t('irl.noOverlap')}</p>
                      )}
                      <p className="text-xs font-semibold text-[#6b7280] mb-1">{t('irl.bring')}</p>
                      <div className="flex items-center gap-2">
                        <MiniCover url={give.url} color={give.color} title={bookTitle(give.title, give.title_en)} />
                        <p className="text-sm text-[#2e1065]">{bookTitle(give.title, give.title_en)}</p>
                      </div>
                      <p className="text-xs mt-3" style={{ color: '#7c3aed' }}>{t('irl.goToConfirm')}</p>
                    </div>
                  )}

                  {tab === 'confirm' && (
                    <div>
                      <p className="text-sm font-semibold text-[#2e1065] mb-1">{t('irl.didItHappen')}</p>
                      <p className="text-xs text-[#9ca3af] mb-3">{t('irl.bothConfirm')}</p>
                      {myConfirm ? (
                        <div className="p-3 rounded-xl text-sm font-semibold" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                          {myConfirm === 'happened' ? t('irl.youConfirmed') : t('irl.notHappened')}
                          {myConfirm === 'happened' && !otherConfirm && (
                            <p className="text-xs font-normal mt-1 text-[#6b7280]">{t('irl.waitingOther', { name: otherName })}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => confirm(trade.id, 'happened')}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                            {t('irl.happened')}
                          </button>
                          <button onClick={() => confirm(trade.id, 'not')}
                            className="px-4 py-2.5 rounded-xl text-sm font-bold"
                            style={{ background: '#fee2e2', color: '#ef4444' }}>
                            {t('irl.notHappened')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'history' && (
                    <div className="p-3 rounded-xl text-sm font-semibold"
                      style={trade.status === 'completed'
                        ? { background: '#dcfce7', color: '#10b981' }
                        : { background: '#f3f4f6', color: '#9ca3af' }}>
                      {trade.status === 'completed' ? t('irl.completed') : t('irl.cancelled')}
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
