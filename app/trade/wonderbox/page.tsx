'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import BookShelf, { type ShelfBook } from '@/components/BookShelf';
import { useI18n } from '@/lib/i18n';

interface Deposit {
  id: number;
  status: string;
  book_id: number;
  my_title: string;
  my_title_en?: string | null;
  my_color: string;
  my_cover_url?: string | null;
  received_title?: string;
  received_title_en?: string | null;
  received_color?: string;
  received_cover_url?: string | null;
  received_from?: string;
}

export default function WonderBoxPage() {
  const { t, bookTitle } = useI18n();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [slots, setSlots] = useState(10);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Deposit | null>(null);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [myBooks, setMyBooks] = useState<ShelfBook[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/wonderbox');
    if (res.ok) {
      const d = await res.json();
      setDeposits(d.deposits ?? []);
      setSlots(d.slots ?? 10);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openPicker() {
    setError('');
    setPickerOpen(true);           // open immediately
    setPicking(true);
    fetch('/api/books?mine=1')     // load books in the background
      .then(r => r.json())
      .then(d => setMyBooks((d.books ?? []).filter((b: ShelfBook) => b.available)))
      .finally(() => setPicking(false));
  }

  async function deposit(bookId: number) {
    setPickerOpen(false);          // close instantly — no waiting
    setBusy(true);
    setError('');
    const res = await fetch('/api/wonderbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId }),
    });
    const d = await res.json();
    if (res.ok) {
      setDeposits(d.deposits ?? []);
    } else {
      setError(d.error === 'box_full' ? t('wb.full', { total: slots }) : t('hub.noFreeBooks'));
    }
    setBusy(false);
  }

  async function withdraw(id: number) {
    setDeposits(prev => prev.filter(d => d.id !== id)); // optimistic
    await fetch(`/api/wonderbox?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function openGift(d: Deposit) {
    setRevealed(d);               // show the reveal modal right away
    const res = await fetch('/api/wonderbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setDeposits(data.deposits ?? []);
    }
  }

  const matchedCount = deposits.filter(d => d.status === 'matched').length;
  const used = deposits.length;
  const depositedIds = new Set(deposits.map(d => d.book_id));
  const pickable = myBooks.filter(b => !depositedIds.has(b.id));

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <div className="flex items-center justify-between mt-2 mb-1">
          <h1 className="text-3xl font-bold text-[#2e1065]">✨ {t('hub.wonderbox')}</h1>
          <span className="text-sm font-semibold" style={{ color: '#7c3aed' }}>{t('wb.slots', { used, total: slots })}</span>
        </div>
        <p className="text-sm text-[#6b7280] mb-6">{t('wb.desc')}</p>

        {matchedCount > 0 && (
          <div className="mb-6 p-4 rounded-2xl animate-pulse" style={{ background: '#dcfce7', border: '1px solid #10b981' }}>
            <p className="font-bold text-sm" style={{ color: '#059669' }}>{t('wb.notify', { n: matchedCount })}</p>
          </div>
        )}

        {/* Slots grid — book-shaped, click an empty slot to pick a book */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
          {Array.from({ length: slots }).map((_, i) => {
            const d = deposits[i];
            if (!d) {
              const firstEmpty = i === used;
              return (
                <button
                  key={`empty-${i}`}
                  onClick={firstEmpty ? openPicker : undefined}
                  disabled={!firstEmpty}
                  className="w-full rounded-r-md rounded-l-sm flex items-center justify-center transition-colors"
                  style={{ aspectRatio: '2 / 3', background: '#faf5ff', border: '2px dashed #e9d5ff', cursor: firstEmpty ? 'pointer' : 'default' }}
                >
                  <span className="text-3xl" style={{ opacity: firstEmpty ? 0.6 : 0.25, color: '#8b5cf6' }}>＋</span>
                </button>
              );
            }
            const matched = d.status === 'matched';
            if (matched) {
              return (
                <button key={`dep-${d.id}`} onClick={() => openGift(d)}
                  className="w-full rounded-r-md rounded-l-sm flex flex-col items-center justify-center gap-1 p-2 transition-transform hover:scale-105"
                  style={{ aspectRatio: '2 / 3', background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', border: '1px solid #8b5cf6', cursor: 'pointer' }}>
                  <span className="text-3xl animate-bounce">🎁</span>
                  <p className="text-[11px] text-center font-semibold" style={{ color: '#7c3aed' }}>{t('wb.tapToOpen')}</p>
                </button>
              );
            }
            // Waiting: a book-shaped cover filling the slot.
            return (
              <div key={`dep-${d.id}`} className="w-full rounded-r-md rounded-l-sm overflow-hidden relative"
                style={{ aspectRatio: '2 / 3', background: d.my_color, boxShadow: '0 4px 10px rgba(0,0,0,0.35)' }}>
                {d.my_cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.my_cover_url} alt={bookTitle(d.my_title, d.my_title_en)} className="absolute inset-0 w-full h-full object-cover"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1.5 text-center">
                    <span className="text-2xl">📖</span>
                    <span className="text-[10px] font-semibold leading-tight line-clamp-3" style={{ color: 'rgba(255,255,255,0.95)' }}>{bookTitle(d.my_title, d.my_title_en)}</span>
                  </span>
                )}
                {/* Spine shading (book look) */}
                <span className="absolute left-0 top-0 bottom-0 w-2" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0))' }} />
                <span className="absolute right-0 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
                {/* Title overlay (only when there's a cover image) */}
                {d.my_cover_url && (
                  <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.75), rgba(0,0,0,0))' }}>
                    <p className="text-[10px] font-semibold leading-tight line-clamp-2 text-white">{bookTitle(d.my_title, d.my_title_en)}</p>
                  </div>
                )}
                {/* Withdraw */}
                <button onClick={() => withdraw(d.id)} title={t('wb.withdraw')} aria-label={t('wb.withdraw')}
                  className="absolute top-1 right-1 rounded-full flex items-center justify-center text-[13px] font-bold z-10"
                  style={{ width: 22, height: 22, background: 'rgba(255,255,255,0.9)', color: '#ef4444' }}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {deposits.length === 0 && !pickerOpen && <p className="text-center text-sm text-[#9ca3af] mb-6">{t('wb.empty')}</p>}
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {/* Book picker — pops up on top (looks like Your Books, selecting deposits) */}
        {pickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(46, 16, 101, 0.35)' }}
            onClick={() => setPickerOpen(false)}
          >
            <div
              className="w-full max-w-lg p-5 rounded-2xl shadow-2xl"
              style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-base font-bold text-[#2e1065]">{t('wb.chooseBook')}</p>
                <button onClick={() => setPickerOpen(false)} className="text-[#6b7280] hover:text-[#2e1065] text-xl">✕</button>
              </div>
              {picking ? (
                <p className="text-sm text-[#9ca3af] py-6 text-center">{t('profile.loading')}</p>
              ) : pickable.length === 0 ? (
                <p className="text-sm text-[#6b7280]">{t('hub.noFreeBooks')}</p>
              ) : (
                <BookShelf
                  books={pickable}
                  selectMode
                  onSelect={id => { if (!busy) deposit(id); }}
                  maxHeight="65vh"
                />
              )}
            </div>
          </div>
        )}

        {/* Gift reveal — pops up with the book the user received */}
        {revealed && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(46, 16, 101, 0.45)' }}
            onClick={() => setRevealed(null)}
          >
            <div
              className="w-full max-w-sm p-6 rounded-2xl shadow-2xl text-center"
              style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}
              onClick={e => e.stopPropagation()}
            >
              <p className="font-bold text-lg mb-4" style={{ color: '#059669' }}>{t('wb.opened')}</p>
              <div className="flex justify-center mb-4">
                <div className="relative rounded-r-md rounded-l-sm overflow-hidden"
                  style={{ width: 130, aspectRatio: '2 / 3', background: revealed.received_color ?? '#e9d5ff', boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
                  {revealed.received_cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={revealed.received_cover_url} alt={bookTitle(revealed.received_title ?? '', revealed.received_title_en)} className="absolute inset-0 w-full h-full object-cover"
                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
                      <span className="text-3xl">📖</span>
                      <span className="text-[11px] font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>{bookTitle(revealed.received_title ?? '', revealed.received_title_en)}</span>
                    </span>
                  )}
                  <span className="absolute left-0 top-0 bottom-0 w-2" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0))' }} />
                </div>
              </div>
              <p className="text-base font-bold text-[#2e1065]">{bookTitle(revealed.received_title ?? '', revealed.received_title_en)}</p>
              {revealed.received_from && <p className="text-sm text-[#6b7280] mt-1">{t('wb.from', { name: revealed.received_from })}</p>}
              <p className="text-xs mt-3" style={{ color: '#059669' }}>{t('wb.meetHint')}</p>
              <button onClick={() => setRevealed(null)} className="mt-5 w-full py-2.5 rounded-xl font-semibold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                {t('wb.close')}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
