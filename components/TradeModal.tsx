'use client';

import { useState, useEffect } from 'react';
import BookShelf, { type ShelfBook } from '@/components/BookShelf';
import { useI18n } from '@/lib/i18n';
import { MAX_PRICE_DIFF, priceDiffOk } from '@/lib/price';

interface Book {
  id: number;
  title: string;
  title_en?: string | null;
  author: string;
  subject?: string;
  condition?: string;
  price?: number | null;
  volume?: string | null;
  cover_color: string;
  cover_url?: string | null;
}

interface Props {
  targetBook: Book;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TradeModal({ targetBook, onClose, onSuccess }: Props) {
  const { t, bookTitle } = useI18n();
  const [myBooks, setMyBooks] = useState<ShelfBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/books?mine=1&exclude_busy=1')
      .then(r => r.json())
      .then(d => setMyBooks((d.books ?? []).filter((b: ShelfBook) => b.available)));
  }, []);

  async function submit() {
    if (!selectedBook) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offered_book_id: selectedBook, wanted_book_id: targetBook.id, message }),
    });
    const data = await res.json();
    if (res.ok) {
      onSuccess();
    } else {
      setError(
        data.error === 'price_gap' ? t('err.priceGap')
        : data.error === 'rate_limited' ? t('err.rateLimited')
        : (data.error ?? t('modal.error'))
      );
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e9d5ff', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        {/* Sticky header with the close button */}
        <div className="flex justify-between items-center px-6 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid #f3e8ff' }}>
          <h2 className="text-lg font-bold text-[#2e1065]">{t('modal.title')}</h2>
          <button onClick={onClose} aria-label={t('modal.cancel')} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6b7280] hover:text-[#2e1065] text-xl flex-shrink-0" style={{ background: '#f3f4f6' }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-col gap-4 px-6 py-4 overflow-y-auto flex-1">
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f5f3ff', border: '1px solid #e9d5ff' }}>
          {/* Book-shaped cover of the book being requested */}
          <div className="relative rounded-r-md rounded-l-sm overflow-hidden flex-shrink-0" style={{ width: 56, aspectRatio: '2 / 3', background: targetBook.cover_color, boxShadow: '0 3px 8px rgba(0,0,0,0.3)' }}>
            {targetBook.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={targetBook.cover_url} alt={bookTitle(targetBook.title, targetBook.title_en)} className="absolute inset-0 w-full h-full object-cover"
                onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-2xl">📖</span>
            )}
            <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0))' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-[#6b7280]">{t('modal.youWant')}</p>
            <p className="font-semibold text-[#2e1065] text-sm">
              {bookTitle(targetBook.title, targetBook.title_en)}
              {targetBook.volume && <span style={{ color: '#7c3aed' }}> · {t('book.vol', { n: targetBook.volume })}</span>}
            </p>
            <p className="text-xs text-[#6b7280] truncate">{targetBook.author}</p>
            {(targetBook.subject || targetBook.price != null) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {targetBook.price != null && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef9c3', color: '#b45309' }}>
                    ฿{targetBook.price}
                  </span>
                )}
                {targetBook.subject && targetBook.subject.split(',').filter(Boolean).map(tag => (
                  <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#e9d5ff', color: '#7c3aed' }}>
                    {t(`subj.${tag}`)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#4b5563] mb-1">{t('modal.offerOne')}</p>
          {(() => {
            const target = Number(targetBook.price) || 0;
            const min = Math.max(0, target - MAX_PRICE_DIFF);
            const max = target + MAX_PRICE_DIFF;
            const blocked = new Set(myBooks.filter(b => !priceDiffOk(b.price, targetBook.price)).map(b => b.id));
            return (
              <>
                <p className="text-xs mb-2" style={{ color: '#7c3aed' }}>{t('modal.priceRange', { min, max })}</p>
                {myBooks.length === 0 ? (
                  <p className="text-sm text-[#6b7280]">{t('modal.noBooks')}</p>
                ) : blocked.size === myBooks.length ? (
                  <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>{t('modal.noneInRange')}</p>
                ) : (
                  <BookShelf
                    books={myBooks}
                    selectMode
                    selectedId={selectedBook}
                    onSelect={setSelectedBook}
                    disabledIds={blocked}
                    disabledLabel={t('modal.priceFar')}
                    maxHeight="none"
                  />
                )}
              </>
            );
          })()}
        </div>

        <div>
          <p className="text-sm font-semibold text-[#4b5563] mb-1">{t('modal.messageOptional')}</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={t('modal.messagePlaceholder')}
            className="w-full text-sm p-2.5 rounded-xl resize-none"
            style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {/* Sticky footer with the actions */}
        <div className="flex gap-2 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #f3e8ff' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: '#e9d5ff', color: '#6b7280' }}
          >
            {t('modal.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!selectedBook || loading}
            className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {loading ? t('modal.sending') : t('modal.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
