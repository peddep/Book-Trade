'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import BookThumb from '@/components/BookThumb';
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
  const [receivedMsg, setReceivedMsg] = useState<Deposit[]>([]);
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

  async function receiveAll() {
    setBusy(true);
    const res = await fetch('/api/wonderbox', { method: 'PATCH' });
    if (res.ok) {
      const d = await res.json();
      setReceivedMsg(d.received ?? []);
      setDeposits(d.deposits ?? []);
    }
    setBusy(false);
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

        {receivedMsg.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl" style={{ background: '#dcfce7', border: '1px solid #10b981' }}>
            <p className="font-bold mb-2" style={{ color: '#10b981' }}>🎉 {t('wb.youGot')}</p>
            {receivedMsg.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-1.5">
                <BookThumb coverUrl={r.received_cover_url} coverColor={r.received_color ?? '#e9d5ff'} />
                <div>
                  <p className="text-sm font-semibold text-[#2e1065]">{bookTitle(r.received_title ?? '', r.received_title_en)}</p>
                  {r.received_from && <p className="text-xs text-[#6b7280]">{t('wb.from', { name: r.received_from })}</p>}
                </div>
              </div>
            ))}
            <p className="text-xs mt-2" style={{ color: '#059669' }}>{t('wb.meetHint')}</p>
          </div>
        )}

        {/* Slots grid — click an empty slot to pick a book */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {Array.from({ length: slots }).map((_, i) => {
            const d = deposits[i];
            if (!d) {
              const firstEmpty = i === used;
              return (
                <button
                  key={`empty-${i}`}
                  onClick={firstEmpty ? openPicker : undefined}
                  disabled={!firstEmpty}
                  className="aspect-square rounded-2xl flex items-center justify-center transition-colors"
                  style={{ background: '#faf5ff', border: '2px dashed #e9d5ff', cursor: firstEmpty ? 'pointer' : 'default' }}
                >
                  <span className="text-2xl" style={{ opacity: firstEmpty ? 0.6 : 0.25, color: '#8b5cf6' }}>＋</span>
                </button>
              );
            }
            const matched = d.status === 'matched';
            return (
              <div key={`dep-${d.id}`} className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 p-2 relative"
                style={{ background: matched ? '#ede9fe' : '#ffffff', border: `1px solid ${matched ? '#8b5cf6' : '#e9d5ff'}` }}>
                {matched ? <span className="text-3xl">🎁</span> : <BookThumb coverUrl={d.my_cover_url} coverColor={d.my_color} size={44} />}
                <p className="text-[11px] text-center leading-tight line-clamp-2" style={{ color: matched ? '#7c3aed' : '#6b7280' }}>
                  {matched ? t('wb.matched') : bookTitle(d.my_title, d.my_title_en)}
                </p>
                {!matched && (
                  <button onClick={() => withdraw(d.id)} className="text-[10px] px-2 py-0.5 rounded-full mt-0.5"
                    style={{ background: '#fee2e2', color: '#ef4444' }}>
                    {t('wb.withdraw')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {deposits.length === 0 && !pickerOpen && <p className="text-center text-sm text-[#9ca3af] mb-6">{t('wb.empty')}</p>}
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {matchedCount > 0 && (
          <button onClick={receiveAll} disabled={busy} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            🎁 {t('wb.receiveAll')} ({matchedCount})
          </button>
        )}

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
      </main>
    </>
  );
}
