'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

export interface ShelfBook {
  id: number;
  title: string;
  author: string;
  cover_color: string;
  cover_url?: string | null;
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
  const { t } = useI18n();
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="overflow-y-auto pr-1" style={{ maxHeight }}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4">
        {books.map(b => {
          const open = openId === b.id;
          return (
            <div key={b.id} className="flex flex-col">
              {/* Book cover */}
              <button
                onClick={() => setOpenId(open ? null : b.id)}
                className="relative w-full rounded-r-md rounded-l-sm overflow-hidden transition-transform hover:-translate-y-0.5"
                style={{
                  aspectRatio: '2 / 3',
                  background: b.cover_color,
                  boxShadow: open ? '0 0 0 2px #8b5cf6, 0 6px 14px rgba(0,0,0,0.4)' : '0 4px 10px rgba(0,0,0,0.35)',
                }}
              >
                {b.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.cover_url} alt={b.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1.5 text-center">
                    <span className="text-2xl">📖</span>
                    <span className="text-[10px] font-semibold leading-tight line-clamp-3" style={{ color: 'rgba(255,255,255,0.95)' }}>{b.title}</span>
                  </span>
                )}
                {/* Spine shading (book look) */}
                <span className="absolute left-0 top-0 bottom-0 w-2" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0))' }} />
                <span className="absolute right-0 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
                {!b.available && (
                  <span className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                    {t('card.traded')}
                  </span>
                )}
              </button>

              {/* Title (always shown small under the cover) */}
              <p className="text-[11px] text-slate-300 mt-1.5 leading-tight line-clamp-2 text-center">{b.title}</p>

              {/* Expanded actions on click */}
              {open && (
                <div className="mt-1.5 flex flex-col gap-1.5 rounded-xl p-2" style={{ background: '#0f0f1a', border: '1px solid #2d2d4a' }}>
                  <p className="text-[11px] text-slate-400 text-center truncate">{b.author}</p>
                  <button onClick={() => onEdit(b.id)} className="w-full py-1 rounded-lg text-[11px] font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    ✏️ {t('shelf.edit')}
                  </button>
                  <label className="w-full py-1 rounded-lg text-[11px] font-semibold text-center cursor-pointer" style={{ background: '#2d2d4a', color: '#e2e8f0' }}>
                    {b.cover_url ? t('card.changeCover') : t('card.addCover')}
                    <input type="file" accept="image/*" className="hidden" onChange={e => onChangeCover(b.id, e.target.files?.[0])} />
                  </label>
                  <button
                    onClick={() => onToggleAvailable(b.id, !b.available)}
                    className="w-full py-1 rounded-lg text-[11px] font-semibold"
                    style={{ background: b.available ? '#1e3a2f' : '#1e2a3a', color: b.available ? '#10b981' : '#94a3b8' }}
                  >
                    {b.available ? t('card.available') : t('card.unavailable')}
                  </button>
                  <button onClick={() => onDelete(b.id)} className="w-full py-1 rounded-lg text-[11px] font-semibold" style={{ background: '#3a1e1e', color: '#ef4444' }}>
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
