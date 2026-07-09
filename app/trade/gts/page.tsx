'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import BookPicker from '@/components/BookPicker';
import BookThumb from '@/components/BookThumb';
import TitleInput from '@/components/TitleInput';
import { useI18n } from '@/lib/i18n';
import { titlesMatch } from '@/lib/books-catalog';

import { SUBJECTS } from '@/lib/subjects';

interface MyDeposit {
  id: number;
  title: string;
  title_en?: string | null;
  cover_color: string;
  cover_url?: string | null;
  wanted_title?: string;
  wanted_subject?: string;
}

interface OpenOffer {
  id: number;
  title: string;
  author: string;
  condition: string;
  cover_color: string;
  cover_url?: string | null;
  title_en?: string | null;
  owner_name: string;
  owner_avatar: string;
  wanted_title?: string;
  wanted_subject?: string;
}

export default function GtsPage() {
  const { t, bookTitle } = useI18n();
  const [mine, setMine] = useState<MyDeposit[]>([]);
  const [open, setOpen] = useState<OpenOffer[]>([]);
  const [slots, setSlots] = useState(3);
  const [q, setQ] = useState('');
  const [showDeposit, setShowDeposit] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [wantTitle, setWantTitle] = useState('');
  const [wantSubject, setWantSubject] = useState('');
  const [fulfilling, setFulfilling] = useState<OpenOffer | null>(null);
  const [fulfillBook, setFulfillBook] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/gts?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const d = await res.json();
      setMine(d.mine ?? []);
      setOpen(d.open ?? []);
      setSlots(d.slots ?? 3);
    }
  }, [q]);

  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  async function deposit() {
    if (!picked) return;
    setBusy(true);
    setErr('');
    const res = await fetch('/api/gts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: picked, wanted_title: wantTitle, wanted_subject: wantSubject }),
    });
    const d = await res.json();
    if (res.ok) {
      setShowDeposit(false);
      setPicked(null);
      setWantTitle('');
      setWantSubject('');
      load();
    } else {
      setErr(d.error === 'gts_full' ? t('gts.full', { total: slots }) : t('hub.noFreeBooks'));
    }
    setBusy(false);
  }

  async function fulfill() {
    if (!fulfilling || !fulfillBook) return;
    setBusy(true);
    setErr('');
    const res = await fetch('/api/gts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deposit_id: fulfilling.id, offered_book_id: fulfillBook }),
    });
    const d = await res.json();
    if (res.ok) {
      setFulfilling(null);
      setFulfillBook(null);
      setMsg(t('gts.done'));
      setTimeout(() => setMsg(''), 6000);
      load();
    } else {
      setErr(d.error === 'not_a_match' ? t('gts.notMatch') : d.error === 'price_gap' ? t('err.priceGap') : t('hub.noFreeBooks'));
    }
    setBusy(false);
  }

  async function withdraw(id: number) {
    await fetch(`/api/gts?id=${id}`, { method: 'DELETE' });
    load();
  }

  function wishText(o: { wanted_title?: string; wanted_subject?: string }) {
    const parts = [o.wanted_title, o.wanted_subject ? t(`subj.${o.wanted_subject}`) : null].filter(Boolean);
    return parts.length ? parts.join(' • ') : t('gts.anything');
  }

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <h1 className="text-3xl font-bold text-[#2e1065] mt-2 mb-1">🌐 {t('hub.gts')}</h1>
        <p className="text-sm text-[#6b7280] mb-6">{t('gts.desc')}</p>

        {msg && (
          <div className="mb-5 p-3 rounded-xl text-sm font-semibold" style={{ background: '#dcfce7', color: '#10b981', border: '1px solid #10b981' }}>
            {msg}
          </div>
        )}

        {/* My deposits */}
        <div className="p-5 rounded-2xl mb-6" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#2e1065]">{t('gts.myDeposits', { used: mine.length, total: slots })}</h2>
            {mine.length < slots && (
              <button onClick={() => setShowDeposit(!showDeposit)} className="px-3 py-1.5 rounded-xl font-semibold text-xs text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {t('gts.deposit')}
              </button>
            )}
          </div>

          {mine.map(d => (
            <div key={d.id} className="flex items-center gap-3 py-2">
              <BookThumb coverUrl={d.cover_url} coverColor={d.cover_color} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#2e1065] truncate">{bookTitle(d.title, d.title_en)}</p>
                <p className="text-xs truncate" style={{ color: '#7c3aed' }}>{t('gts.wants', { want: wishText(d) })}</p>
              </div>
              <button onClick={() => withdraw(d.id)} className="text-xs px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ background: '#fee2e2', color: '#ef4444' }}>
                {t('gts.withdraw')}
              </button>
            </div>
          ))}

          {showDeposit && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e9d5ff' }}>
              <p className="text-sm font-semibold text-[#4b5563] mb-2">{t('hub.pickBook')}</p>
              <BookPicker selected={picked} onSelect={setPicked} />
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <TitleInput
                    value={wantTitle}
                    onChange={setWantTitle}
                    placeholder={t('gts.wantedTitle')}
                    listId="gts-wanted-suggestions"
                  />
                  <p className="text-[11px] mt-1" style={{ color: '#9ca3af' }}>{t('gts.exactHint')}</p>
                </div>
                <select
                  value={wantSubject}
                  onChange={e => setWantSubject(e.target.value)}
                  className="p-2.5 rounded-xl text-sm"
                  style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: wantSubject ? '#2e1065' : '#9ca3af', outline: 'none' }}
                >
                  <option value="">{t('gts.anySubject')}</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{t(`subj.${s}`)}</option>)}
                </select>
              </div>
              <button onClick={deposit} disabled={!picked || busy} className="mt-3 w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {t('gts.submit')}
              </button>
            </div>
          )}
          {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
        </div>

        {/* Open offers */}
        <h2 className="font-bold text-[#2e1065] mb-3">{t('gts.openOffers')}</h2>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('gts.searchPlaceholder')}
          className="w-full p-3 rounded-xl text-sm mb-4"
          style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
        />

        {open.length === 0 ? (
          <p className="text-center text-sm text-[#9ca3af] py-10">{t('gts.noOffers')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map(o => (
              <div key={o.id} className="p-4 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
                <div className="flex items-center gap-3">
                  <BookThumb coverUrl={o.cover_url} coverColor={o.cover_color} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#2e1065] truncate">{bookTitle(o.title, o.title_en)}</p>
                    <p className="text-xs text-[#6b7280] truncate">{o.author} • {t(`cond.${o.condition}`)}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#7c3aed' }}>💭 {t('gts.wants', { want: wishText(o) })}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[#2e1065] text-xs font-bold" style={{ background: o.owner_avatar }}>
                      {o.owner_name[0].toUpperCase()}
                    </div>
                    <button
                      onClick={() => { setFulfilling(fulfilling?.id === o.id ? null : o); setFulfillBook(null); setErr(''); }}
                      className="px-3 py-1.5 rounded-xl font-semibold text-xs text-white"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    >
                      {t('gts.fulfill')}
                    </button>
                  </div>
                </div>

                {fulfilling?.id === o.id && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e9d5ff' }}>
                    <p className="text-sm font-semibold text-[#4b5563] mb-2">{t('gts.pickMatching')}</p>
                    <BookPicker
                      selected={fulfillBook}
                      onSelect={setFulfillBook}
                      filterFn={b =>
                        (!o.wanted_title || titlesMatch(o.wanted_title, b.title)) &&
                        (!o.wanted_subject || b.subject === o.wanted_subject)
                      }
                      emptyText={t('gts.noMatchingBook')}
                    />
                    {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
                    <button onClick={fulfill} disabled={!fulfillBook || busy} className="mt-3 w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      {t('gts.fulfill')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
