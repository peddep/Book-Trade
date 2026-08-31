'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import IrlGuide from '@/components/IrlGuide';
import Loading from '@/components/Loading';
import { useI18n } from '@/lib/i18n';
import { coverFor } from '@/lib/cover';
import { meetingFor, SLOT_KEYS } from '@/lib/meeting';


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
  requester_contact?: string | null;
  requester_grade?: string | null;
  requester_class?: string | null;
  owner_name: string;
  owner_avatar: string;
  owner_availability?: string | null;
  owner_contact?: string | null;
  owner_grade?: string | null;
  owner_class?: string | null;
  offered_title: string;
  offered_title_en?: string | null;
  offered_color: string;
  offered_book_id: number;
  offered_cover_len?: number | null;
  wanted_title: string;
  wanted_title_en?: string | null;
  wanted_color: string;
  wanted_book_id: number;
  wanted_cover_len?: number | null;
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

export default function IrlTradePage() {
  const { t, bookTitle, lang } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'confirm' | 'history'>('upcoming');
  const { user: sessionUser, loading: sessionLoading } = useSession();
  const router = useRouter();

  // Only the agreed meet-ups to begin with. Finished trades live behind the
  // history tab, and a student who has traded all year has far more of those
  // than of this week's meet-ups — waiting for them all is most of the delay
  // before this page appears.
  const fetchTrades = useCallback(async () => {
    const res = await fetch('/api/trades?status=accepted');
    if (res.ok) setTrades((await res.json()).trades ?? []);
    setLoading(false);
  }, []);

  const [history, setHistory] = useState<Trade[] | null>(null);
  const fetchHistory = useCallback(async () => {
    const res = await fetch('/api/trades?status=completed,cancelled');
    if (res.ok) setHistory((await res.json()).trades ?? []);
  }, []);

  // Ask for the meet-ups straight away rather than waiting to be told who is
  // signed in: the cookie the browser sends answers that, and waiting cost a
  // whole round trip on the school's wifi before the request even left.
  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) { router.replace('/'); return; }
    setUser(sessionUser as User);
  }, [router, sessionUser, sessionLoading]);

  // Fetched the first time the history tab is opened, and again after a
  // confirmation, which may have moved a meet-up into it.
  useEffect(() => {
    if (tab === 'history' && history === null) fetchHistory();
  }, [tab, history, fetchHistory]);

  async function confirm(id: number, value: 'happened' | 'not') {
    // Say so at once. Reporting the swap is something the student has just
    // done in person; watching the whole list reload before the card admits it
    // makes the button feel like it did not register.
    const before = trades;
    const mineIs = (tr: Trade) => (tr.requester_id === user?.id ? 'requester_confirm' : 'owner_confirm');
    setTrades(prev => prev.map(tr => (tr.id === id ? { ...tr, [mineIs(tr)]: value } : tr)));
    try {
      const res = await fetch(`/api/trades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: value }),
      });
      if (!res.ok) {
        setTrades(before);
        alert(t('trades.actionFailed'));
        return;
      }
      // Whether this finished the trade is the server's to say — pick that up
      // quietly, behind a card already showing the right answer.
      fetchTrades();
      setHistory(null);
    } catch {
      setTrades(before);
      alert(t('trades.actionFailed'));
    }
  }

  if (!user) return (<Loading />);

  const inProgress = trades.filter(t => t.status === 'accepted');
  const shown = tab === 'history' ? (history ?? []) : inProgress;

  const TABS = [
    { key: 'upcoming', label: 'irl.tabUpcoming', icon: '📅', n: inProgress.length },
    { key: 'confirm', label: 'irl.tabConfirm', icon: '🤝', n: inProgress.length },
    // The count is unknown until the tab is opened, so the tab simply says what
    // it is rather than promising a number it has not fetched.
    { key: 'history', label: 'irl.tabHistory', icon: '📜', n: history?.length ?? 0 },
  ] as const;

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065] mt-2">🤝 {t('irl.title')}</h1>
        <p className="text-sm text-[#6b7280] mb-5">{t('irl.subtitle')}</p>

        <IrlGuide />

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

        {loading || (tab === 'history' && history === null) ? (
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
                ? { title: trade.offered_title, title_en: trade.offered_title_en, color: trade.offered_color, url: coverFor(trade.offered_book_id, trade.offered_cover_len) }
                : { title: trade.wanted_title, title_en: trade.wanted_title_en, color: trade.wanted_color, url: coverFor(trade.wanted_book_id, trade.wanted_cover_len) };
              const get = isRequester
                ? { title: trade.wanted_title, title_en: trade.wanted_title_en, color: trade.wanted_color, url: coverFor(trade.wanted_book_id, trade.wanted_cover_len) }
                : { title: trade.offered_title, title_en: trade.offered_title_en, color: trade.offered_color, url: coverFor(trade.offered_book_id, trade.offered_cover_len) };
              const otherName = isRequester ? trade.owner_name : trade.requester_name;
              const otherAvatar = isRequester ? trade.owner_avatar : trade.requester_avatar;
              const otherId = isRequester ? trade.owner_id : trade.requester_id;
              const myConfirm = isRequester ? trade.requester_confirm : trade.owner_confirm;
              const otherConfirm = isRequester ? trade.owner_confirm : trade.requester_confirm;
              const otherContact = isRequester ? trade.owner_contact : trade.requester_contact;
              const meeting = meetingFor(trade.requester_availability, trade.owner_availability);
              // Same room every day: working out a free period is beside the
              // point, so say so instead of making them read a timetable.
              const sameClass = Boolean(
                trade.requester_grade && trade.requester_class &&
                trade.requester_grade === trade.owner_grade &&
                trade.requester_class === trade.owner_class,
              );
              const meetingText = meeting
                ? `${meeting.date.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { weekday: 'long', day: 'numeric', month: 'short' })} · ${meeting.date.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' })} (${t(SLOT_KEYS[meeting.slot])})`
                : null;

              return (
                <div key={trade.id} className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
                  {/* Who + how to reach them */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <Link href={`/u/${otherId}`} className="inline-flex items-center gap-2 px-2 py-1 rounded-full hover:opacity-80" style={{ background: '#f5f3ff', border: '1px solid #e9d5ff' }}>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: otherAvatar }}>
                        {otherName[0].toUpperCase()}
                      </span>
                      <span className="text-sm text-[#6b7280]">{t('irl.with')}</span>
                      <span className="text-sm font-semibold text-[#2e1065]">{otherName}</span>
                    </Link>
                    {otherContact && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                        📱 {otherContact}
                      </span>
                    )}
                  </div>

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
                      {/* Decided meeting date & time (from both users' registered availability) */}
                      {sameClass ? (
                        <div className="mb-3 p-3 rounded-xl" style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
                          <p className="text-xs font-bold" style={{ color: '#15803d' }}>
                            🎒 {t('irl.sameClass', { room: `${t('grade.prefix')}${trade.owner_grade}/${trade.owner_class}` })}
                          </p>
                          <p className="text-xs mt-1" style={{ color: '#166534' }}>{t('irl.sameClassHint')}</p>
                        </div>
                      ) : meetingText ? (
                        <div className="mb-3 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                          <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>📅 {t('irl.meetOn')}</p>
                          <p className="text-base font-bold text-white leading-tight mt-0.5">{meetingText}</p>
                        </div>
                      ) : (
                        <div className="mb-3 p-3 rounded-xl" style={{ background: '#fef9c3', border: '1px solid #fde68a' }}>
                          <p className="text-xs font-semibold" style={{ color: '#b45309' }}>{t('irl.noOverlap')}</p>
                          <p className="text-xs mt-1" style={{ color: '#b45309' }}>
                            {otherContact ? t('irl.reachOut', { contact: otherContact }) : t('irl.reachProfile', { name: otherName })}
                          </p>
                        </div>
                      )}
                      <p className="text-sm font-semibold text-[#2e1065] mb-3">{t('irl.meetAt')}</p>
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
                      {meetingText && (
                        <p className="text-xs font-semibold mb-2" style={{ color: '#7c3aed' }}>📅 {meetingText}</p>
                      )}
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
