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
  volume?: string | null;
  available: number;
  in_wonderbox?: number;
}

interface Props {
  books: ShelfBook[];
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onToggleAvailable?: (id: number, next: boolean) => void;
  onChangeCover?: (id: number, file: File | undefined) => void;
  maxHeight?: string;
  // Selection mode: clicking a cover selects it (no star / edit actions).
  selectMode?: boolean;
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  // Books that cannot be selected (greyed out, e.g. price too far apart).
  disabledIds?: Set<number>;
  // Short label shown on disabled covers explaining why.
  disabledLabel?: string;
}

// A 3-column scrollable shelf. Each item looks like a book (portrait cover with
// a spine). Tapping a cover reveals its title and edit actions below it — or, in
// selectMode, simply selects the book.
export default function BookShelf({ books, onEdit, onDelete, onToggleAvailable, onChangeCover, maxHeight = '28rem', selectMode = false, selectedId = null, onSelect, disabledIds, disabledLabel }: Props) {
  const { t, bookTitle } = useI18n();
  const [openId, setOpenId] = useState<number | null>(null);

  function toggleTrade(b: ShelfBook) {
    onToggleAvailable?.(b.id, !b.available);
  }

  return (
    <div className="overflow-y-auto pr-1 relative" style={{ maxHeight }}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4">
        {books.map(b => {
          const open = openId === b.id;
          const selected = selectMode && selectedId === b.id;
          const disabled = selectMode && !!disabledIds?.has(b.id);
          return (
            <div key={b.id} className="flex flex-col relative">
              {/* Book cover (relative wrapper so the star button isn't nested in a button) */}
              <div className="relative w-full">
                <button
                  onClick={() => (disabled ? undefined : selectMode ? onSelect?.(b.id) : setOpenId(open ? null : b.id))}
                  disabled={disabled}
                  className="relative block w-full rounded-r-md rounded-l-sm overflow-hidden transition-transform hover:-translate-y-0.5"
                  style={{
                    aspectRatio: '2 / 3',
                    background: b.cover_color,
                    boxShadow: (open || selected) ? '0 0 0 2px #8b5cf6, 0 6px 14px rgba(0,0,0,0.4)' : '0 4px 10px rgba(0,0,0,0.35)',
                    opacity: disabled ? 0.35 : b.available ? 1 : 0.55,
                    filter: disabled ? 'grayscale(0.8)' : undefined,
                    cursor: disabled ? 'not-allowed' : 'pointer',
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
                  {/* Volume badge for multi-volume series (manga) */}
                  {b.volume && (
                    <span className="absolute bottom-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.9)', color: '#ffffff' }}>
                      {t('book.vol', { n: b.volume })}
                    </span>
                  )}
                  {/* In the Wonder Box: purple ✨ ribbon */}
                  {!!b.in_wonderbox && (
                    <span className="absolute top-1 left-1 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#ffffff', boxShadow: '0 1px 5px rgba(76,29,149,0.5)' }}>
                      ✨ {t('shelf.inWonderbox')}
                    </span>
                  )}
                </button>

                {/* Allow-trade star toggle (white circle, green star = tradeable) */}
                {!selectMode && (
                  <button
                    onClick={() => toggleTrade(b)}
                    title={t('shelf.allowTrade')}
                    aria-label={t('shelf.allowTrade')}
                    className="absolute top-0 right-0 z-10 flex items-center justify-center transition-transform hover:scale-110"
                    style={{ width: 40, height: 40 }}
                  >
                    <span className="rounded-full flex items-center justify-center" style={{ width: 26, height: 26, background: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                      <span className="text-[14px] leading-none" style={{ color: b.available ? '#10b981' : '#cbd5e1' }}>
                        {b.available ? '★' : '☆'}
                      </span>
                    </span>
                  </button>
                )}
                {selected && (
                  <span className="absolute top-1 right-1 z-10 rounded-full flex items-center justify-center text-white text-[13px]" style={{ width: 22, height: 22, background: '#8b5cf6' }}>✓</span>
                )}
                {disabled && disabledLabel && (
                  <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 z-10 text-center text-[9px] font-bold px-1 py-0.5 rounded-md"
                    style={{ background: 'rgba(239,68,68,0.9)', color: '#ffffff' }}>
                    {disabledLabel}
                  </span>
                )}
              </div>

              {/* Title (always shown small under the cover) */}
              <p className="text-[11px] text-[#4b5563] mt-1.5 leading-tight line-clamp-2 text-center">{bookTitle(b.title, b.title_en)}</p>

              {/* Expanded actions — floats on top of the book (doesn't push the grid) */}
              {!selectMode && open && (
                <div className="absolute left-0 right-0 top-1 z-30 flex flex-col gap-1.5 rounded-xl p-2 shadow-xl" style={{ background: '#ffffff', border: '1px solid #8b5cf6' }}>
                  <p className="text-[11px] text-[#6b7280] text-center truncate">{b.author}</p>
                  <button onClick={() => onEdit?.(b.id)} className="w-full py-1 rounded-lg text-[11px] font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    ✏️ {t('shelf.edit')}
                  </button>
                  <label className="w-full py-1 rounded-lg text-[11px] font-semibold text-center cursor-pointer" style={{ background: '#e9d5ff', color: '#2e1065' }}>
                    {b.cover_url ? t('card.changeCover') : t('card.addCover')}
                    <input type="file" accept="image/*" className="hidden" onChange={e => onChangeCover?.(b.id, e.target.files?.[0])} />
                  </label>
                  <button onClick={() => onDelete?.(b.id)} className="w-full py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#fee2e2', color: '#ef4444' }}>
                    {t('card.remove')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
