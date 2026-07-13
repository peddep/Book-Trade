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
  const [slots, setSlots] = useState(1);
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
      setSlots(d.slots ?? 1);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openPicker() {
    setError('');
    setPickerOpen(true);           // open immediately
    setPicking(true);
    fetch('/api/books?mine=1&exclude_busy=1')     // load books in the background
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
  const depositedIds = new Set(deposits.map(d => d.book_id));
  const pickable = myBooks.filter(b => !depositedIds.has(b.id));

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <div className="mt-2 mb-1">
          <h1 className="text-3xl font-bold text-[#2e1065]">✨ {t('hub.wonderbox')}</h1>
        </div>
        <p className="text-sm text-[#6b7280] mb-6">{t('wb.desc')}</p>

        {matchedCount > 0 && (
          <div className="mb-6 p-4 rounded-2xl animate-pulse" style={{ background: '#dcfce7', border: '1px solid #10b981' }}>
            <p className="font-bold text-sm" style={{ color: '#059669' }}>{t('wb.notify', { n: matchedCount })}</p>
          </div>
        )}

        {/* The one Wonder Box slot — a magical centerpiece stage */}
        <div
          className="relative overflow-hidden rounded-3xl mb-6 px-6 py-10 flex flex-col items-center"
          style={{
            background: 'linear-gradient(160deg, #2e1065 0%, #4c1d95 45%, #6d28d9 100%)',
            boxShadow: '0 14px 40px rgba(76, 29, 149, 0.45)',
            border: '1px solid #a78bfa',
          }}
        >
          {/* Twinkling stars */}
          <span className="wb-star" style={{ top: '14%', left: '12%', animationDelay: '0s' }} aria-hidden>✦</span>
          <span className="wb-star" style={{ top: '22%', right: '14%', animationDelay: '0.9s' }} aria-hidden>✧</span>
          <span className="wb-star" style={{ bottom: '20%', left: '20%', animationDelay: '1.6s' }} aria-hidden>✧</span>
          <span className="wb-star" style={{ bottom: '30%', right: '10%', animationDelay: '0.4s' }} aria-hidden>✦</span>
          {/* Glow behind the slot */}
          <span className="absolute w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.45), transparent 65%)', top: '8%' }} aria-hidden />

          <div className="relative wb-float" style={{ width: 150 }}>
            {(() => {
              const d = deposits[0];
              if (!d) {
                return (
                  <button
                    onClick={openPicker}
                    className="w-full rounded-r-lg rounded-l-md flex flex-col items-center justify-center gap-2 transition-transform hover:scale-105"
                    style={{
                      aspectRatio: '2 / 3',
                      background: 'rgba(255,255,255,0.08)',
                      border: '2px dashed rgba(196,181,253,0.8)',
                      boxShadow: '0 0 30px rgba(167,139,250,0.35)',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="text-5xl" style={{ color: '#c4b5fd' }}>＋</span>
                    <span className="text-xs font-semibold px-3 text-center" style={{ color: '#ddd6fe' }}>{t('wb.chooseBook')}</span>
                  </button>
                );
              }
              if (d.status === 'matched') {
                return (
                  <button onClick={() => openGift(d)}
                    className="w-full rounded-r-lg rounded-l-md flex flex-col items-center justify-center gap-2 transition-transform hover:scale-105"
                    style={{
                      aspectRatio: '2 / 3',
                      background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                      border: '1px solid #fde68a',
                      boxShadow: '0 0 40px rgba(251,191,36,0.55)',
                      cursor: 'pointer',
                    }}>
                    <span className="text-6xl animate-bounce">🎁</span>
                    <p className="text-xs text-center font-bold" style={{ color: '#78350f' }}>{t('wb.tapToOpen')}</p>
                  </button>
                );
              }
              // Waiting: the deposited book, spotlighted.
              return (
                <div className="w-full rounded-r-lg rounded-l-md overflow-hidden relative"
                  style={{ aspectRatio: '2 / 3', background: d.my_color, boxShadow: '0 0 35px rgba(167,139,250,0.5), 0 10px 24px rgba(0,0,0,0.45)' }}>
                  {d.my_cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.my_cover_url} alt={bookTitle(d.my_title, d.my_title_en)} className="absolute inset-0 w-full h-full object-cover"
                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
                      <span className="text-3xl">📖</span>
                      <span className="text-xs font-semibold leading-tight line-clamp-3" style={{ color: 'rgba(255,255,255,0.95)' }}>{bookTitle(d.my_title, d.my_title_en)}</span>
                    </span>
                  )}
                  {/* Spine shading (book look) */}
                  <span className="absolute left-0 top-0 bottom-0 w-2.5" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0))' }} />
                  <span className="absolute right-0 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
                  {d.my_cover_url && (
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.75), rgba(0,0,0,0))' }}>
                      <p className="text-[11px] font-semibold leading-tight line-clamp-2 text-white">{bookTitle(d.my_title, d.my_title_en)}</p>
                    </div>
                  )}
                  {/* Withdraw */}
                  <button onClick={() => withdraw(d.id)} title={t('wb.withdraw')} aria-label={t('wb.withdraw')}
                    className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center text-sm font-bold z-10"
                    style={{ width: 26, height: 26, background: 'rgba(255,255,255,0.92)', color: '#ef4444' }}>
                    ✕
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Pedestal shadow */}
          <span className="mt-4 rounded-full" style={{ width: 120, height: 12, background: 'radial-gradient(ellipse, rgba(0,0,0,0.45), transparent 70%)' }} aria-hidden />

          {/* Status line under the slot */}
          <p className="relative mt-3 text-sm font-semibold text-center" style={{ color: '#ddd6fe' }}>
            {!deposits[0]
              ? t('wb.empty')
              : deposits[0].status === 'matched'
                ? t('wb.matched')
                : `✨ ${bookTitle(deposits[0].my_title, deposits[0].my_title_en)}`}
          </p>

          <style jsx>{`
            .wb-star {
              position: absolute;
              color: #fde68a;
              font-size: 14px;
              animation: wb-twinkle 2.4s ease-in-out infinite;
              pointer-events: none;
            }
            @keyframes wb-twinkle {
              0%, 100% { opacity: 0.15; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.2); }
            }
            .wb-float {
              animation: wb-float-move 4s ease-in-out infinite;
            }
            /* Hold still while the student is aiming/tapping */
            .wb-float:hover,
            .wb-float:active,
            .wb-float:focus-within {
              animation-play-state: paused;
            }
            @keyframes wb-float-move {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-8px); }
            }
          `}</style>
        </div>

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
