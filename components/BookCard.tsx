'use client';

import { useI18n } from '@/lib/i18n';

interface Book {
  id: number;
  title: string;
  author: string;
  subject?: string;
  grade_level?: string;
  condition: string;
  description?: string;
  cover_color: string;
  cover_url?: string | null;
  title_en?: string | null;
  available: number;
  owner_name?: string;
  owner_avatar_color?: string;
  owner_grade?: string;
}

interface Props {
  book: Book;
  onTrade?: () => void;
  onDelete?: () => void;
  onToggleAvailable?: () => void;
  onChangeCover?: (file: File | undefined) => void;
  isOwner?: boolean;
}

const CONDITION_COLORS: Record<string, string> = {
  'Like New': '#10b981',
  'Good': '#3b82f6',
  'Fair': '#f59e0b',
  'Poor': '#ef4444',
};

export default function BookCard({ book, onTrade, onDelete, onToggleAvailable, onChangeCover, isOwner }: Props) {
  const { t, bookTitle } = useI18n();
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}
    >
      {/* Book cover */}
      <div
        className="relative flex items-center justify-center p-6 overflow-hidden"
        style={{ background: book.cover_color, minHeight: '160px' }}
      >
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_url}
            alt={bookTitle(book.title, book.title_en)}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(0,0,0,0.1) 20px, rgba(0,0,0,0.1) 21px)' }}
          />
        )}
        <div className="text-center relative z-10">
          {!book.cover_url && <div className="text-4xl mb-2">📖</div>}
          {!book.available && (
            <span className="text-xs font-bold bg-black/60 text-white px-2 py-1 rounded-full">{t('card.traded')}</span>
          )}
        </div>
        {isOwner && onChangeCover && (
          <label className="absolute bottom-2 right-2 z-20 text-[11px] font-semibold px-2 py-1 rounded-full cursor-pointer" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
            {book.cover_url ? t('card.changeCover') : t('card.addCover')}
            <input type="file" accept="image/*" className="hidden" onChange={e => onChangeCover(e.target.files?.[0])} />
          </label>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div>
          <h3 className="font-bold text-white leading-tight line-clamp-2">{bookTitle(book.title, book.title_en)}</h3>
          <p className="text-sm text-slate-400 mt-0.5">{book.author}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {book.subject && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2d2d4a', color: '#a78bfa' }}>
              {t(`subj.${book.subject}`)}
            </span>
          )}
          {book.grade_level && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2d2d4a', color: '#94a3b8' }}>
              {t('card.gr')} {book.grade_level}
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: CONDITION_COLORS[book.condition] + '22', color: CONDITION_COLORS[book.condition] }}
          >
            {t(`cond.${book.condition}`)}
          </span>
        </div>

        {book.description && (
          <p className="text-xs text-slate-400 line-clamp-2">{book.description}</p>
        )}

        {book.owner_name && !isOwner && (
          <div className="flex items-center gap-2 mt-auto pt-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: book.owner_avatar_color }}
            >
              {book.owner_name[0].toUpperCase()}
            </div>
            <span className="text-xs text-slate-400">{book.owner_name}{book.owner_grade ? `, Gr. ${book.owner_grade}` : ''}</span>
          </div>
        )}

        <div className="flex gap-2 mt-auto pt-2">
          {isOwner ? (
            <>
              <button
                onClick={onToggleAvailable}
                className="flex-1 text-xs py-1.5 rounded-lg font-semibold transition-colors"
                style={{
                  background: book.available ? '#1e3a2f' : '#1e2a3a',
                  color: book.available ? '#10b981' : '#94a3b8',
                  border: `1px solid ${book.available ? '#10b981' : '#2d2d4a'}`
                }}
              >
                {book.available ? t('card.available') : t('card.unavailable')}
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-1.5 text-xs rounded-lg font-semibold"
                style={{ background: '#3a1e1e', color: '#ef4444', border: '1px solid #ef4444' }}
              >
                {t('card.remove')}
              </button>
            </>
          ) : (
            book.available && onTrade && (
              <button
                onClick={onTrade}
                className="flex-1 py-2 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                {t('card.offerTrade')}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
