'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

export interface ShelfBook {
  id: number;
  title: string;
  title_en?: string | null;
  author: string;
  cover_color: string;
  cover_url?: string | null;
  price?: number | null;
  available: number;
}

interface Props {
  books: ShelfBook[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onToggleAvailable: (id: number, next: boolean) => void;
  onChangeCover: (id: number, file: File | undefined) => void;
  maxHeight?: string;
}

// A 3-column scrollable shelf. Each item looks like a book (portrait cover with
// a spine). Tapping a cover reveals its title and edit actions below it.
export default function BookShelf({ books, onEdit, onDelete, onToggleAvailable, onChangeCover, maxHeight = '28rem' }: Props) {
  const { t, bookTitle } = useI18n();
  const [openId, setOpenId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  function toggleTrade(b: ShelfBook) {
    const next = !b.available;
    onToggleAvailable(b.id, next);
    setToast(next ? t('shelf.tradeOn') : t('shelf.tradeOff'));
    window.setTimeout(() => setToast(''), 1600);
  }

  return (
    <div className="overflow-y-auto pr-1 relative" style={{ maxHeight }}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4">
        {books.map(b => {
          const open = openId === b.id;
          return (
            <div key={b.id} className="flex flex-col">
              {/* Book cover (relative wrapper so the star button isn't nested in a button) */}
              <div className="relative w-full">
                <button
                  onClick={() => setOpenId(open ? null : b.id)}
                  className="relative block w-full rounded-r-md rounded-l-sm overflow-hidden transition-transform hover:-translate-y-0.5"
                  style={{
                    aspectRatio: '2 / 3',
                    background: b.cover_color,
                    boxShadow: open ? '0 0 0 2px #8b5cf6, 0 6px 14px rgba(0,0,0,0.4)' : '0 4px 10px rgba(0,0,0,0.35)',
                    opacity: b.available ? 1 : 0.55,
                  }}
                >
                  {b.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.cover_url} alt={bookTitle(b.title, b.title_en)} className="absolute inset-0 w-full h-full object-cover" loading="lazy"
                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1.5 text-center">
                      <span className="text-2xl">📖</span>
                      <span className="text-[10px] font-semibold leading-tight line-clamp-3" style={{ color: 'rgba(255,255,255,0.95)' }}>{bookTitle(b.title, b.title_en)}</span>
                    </span>
                  )}
                  {/* Spine shading (book look) */}
                  <span className="absolute left-0 top-0 bottom-0 w-2" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0))' }} />
                  <span className="absolute right-0 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
                  {b.price != null && (
                    <span className="absolute bottom-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.7)', color: '#fbbf24' }}>
                      {b.price > 0 ? `฿${b.price}` : t('card.free')}
                    </span>
                  )}
                </button>

                {/* Allow-trade star toggle (white circle, green star = tradeable) */}
                <button
                  onClick={() => toggleTrade(b)}
                  title={t('shelf.allowTrade')}
                  aria-label={t('shelf.allowTrade')}
                  className="absolute top-1 right-1 z-10 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ width: 24, height: 24, background: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                >
                  <span className="text-[13px] leading-none" style={{ color: b.available ? '#10b981' : '#cbd5e1' }}>
                    {b.available ? '★' : '☆'}
                  </span>
                </button>
              </div>

              {/* Title (always shown small under the cover) */}
              <p className="text-[11px] text-[#4b5563] mt-1.5 leading-tight line-clamp-2 text-center">{bookTitle(b.title, b.title_en)}</p>

              {/* Expanded actions on click */}
              {open && (
                <div className="mt-1.5 flex flex-col gap-1.5 rounded-xl p-2" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
                  <p className="text-[11px] text-[#6b7280] text-center truncate">{b.author}</p>
                  <button onClick={() => onEdit(b.id)} className="w-full py-1 rounded-lg text-[11px] font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    ✏️ {t('shelf.edit')}
                  </button>
                  <label className="w-full py-1 rounded-lg text-[11px] font-semibold text-center cursor-pointer" style={{ background: '#e9d5ff', color: '#2e1065' }}>
                    {b.cover_url ? t('card.changeCover') : t('card.addCover')}
                    <input type="file" accept="image/*" className="hidden" onChange={e => onChangeCover(b.id, e.target.files?.[0])} />
                  </label>
                  <button onClick={() => onDelete(b.id)} className="w-full py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#fee2e2', color: '#ef4444' }}>
                    {t('card.remove')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toggle toast */}
      {toast && (
        <div className="sticky bottom-2 flex justify-center pointer-events-none">
          <span className="px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg" style={{ background: '#7c3aed' }}>
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}
