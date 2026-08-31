'use client';

import { useI18n } from '@/lib/i18n';
import ReportButton from '@/components/ReportButton';
import { coverSrc } from '@/lib/cover';

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
  cover_len?: number | null;
  title_en?: string | null;
  price?: number | null;
  volume?: string | null;
  publisher?: string | null;
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
  /** Suppress the owner row. On a profile page every card is the same person,
   *  so repeating their name and avatar is noise, not information. */
  hideOwner?: boolean;
}

const CONDITION_COLORS: Record<string, string> = {
  'Like New': '#10b981',
  'Good': '#3b82f6',
  'Fair': '#f59e0b',
  'Poor': '#ef4444',
};

export default function BookCard({ book, onTrade, onDelete, onToggleAvailable, onChangeCover, isOwner, hideOwner }: Props) {
  const { t, bookTitle } = useI18n();
  const cover = coverSrc(book);
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}
    >
      {/* Book cover. Portrait, and the artwork is contained rather than cropped:
          a real cover is 2:3, so filling a squat landscape box cut the title
          off the top and the author off the bottom of nearly every book. The
          leftover space either side is the book's own colour, so the card still
          reads as one object. */}
      <div
        className="relative flex items-center justify-center overflow-hidden aspect-[3/4]"
        style={{ background: book.cover_color }}
      >
        {cover ? (
          <>
            {/* The same cover, blown up and blurred, fills whatever the
                contained image leaves at the sides — so the gaps look like part
                of the book rather than a mistake. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-70"
              loading="lazy"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt={bookTitle(book.title, book.title_en)}
              className="absolute inset-0 w-full h-full object-contain"
              loading="lazy"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          </>
        ) : (
          <>
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(0,0,0,0.1) 20px, rgba(0,0,0,0.1) 21px)' }}
            />
            {/* No cover photo: print the title on the jacket, the way the phone
                shelf does. A tall block of flat colour told you nothing about
                which book it was. */}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
              <span className="text-3xl">📖</span>
              <span className="text-sm font-bold leading-snug line-clamp-4" style={{ color: 'rgba(255,255,255,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>
                {bookTitle(book.title, book.title_en)}
              </span>
            </span>
          </>
        )}
        {/* Spine shading, so a card reads as a book rather than a swatch. */}
        <span className="absolute left-0 top-0 bottom-0 w-2.5 z-10" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.3), rgba(0,0,0,0))' }} />
        {!book.available && (
          <span className="absolute top-2 left-1/2 -translate-x-1/2 z-20 text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.65)', color: '#ffffff' }}>
            {t('card.traded')}
          </span>
        )}
        {isOwner && onChangeCover && (
          <label className="absolute bottom-2 right-2 z-20 text-[11px] font-semibold px-2 py-1 rounded-full cursor-pointer" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
            {cover ? t('card.changeCover') : t('card.addCover')}
            <input type="file" accept="image/*" className="hidden" onChange={e => onChangeCover(e.target.files?.[0])} />
          </label>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        <div>
          <h3 className="font-bold text-[#2e1065] leading-tight line-clamp-2">
            {bookTitle(book.title, book.title_en)}
            {book.volume && <span className="font-semibold" style={{ color: '#7c3aed' }}> · {t('book.vol', { n: book.volume })}</span>}
          </h3>
          <p className="text-sm text-[#6b7280] mt-0.5">{book.author}</p>
          {book.publisher && <p className="text-xs text-[#9ca3af]">{book.publisher}</p>}
        </div>

        <div className="flex flex-wrap gap-1">
          {book.subject && book.subject.split(',').filter(Boolean).map(tag => (
            <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: '#e9d5ff', color: '#7c3aed' }}>
              {t(`subj.${tag}`)}
            </span>
          ))}
          {book.grade_level && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#e9d5ff', color: '#6b7280' }}>
              {t('card.gr')} {book.grade_level}
            </span>
          )}
          <span
            className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: CONDITION_COLORS[book.condition] + '22', color: CONDITION_COLORS[book.condition] }}
          >
            {t(`cond.${book.condition}`)}
          </span>
          {book.price != null && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#fef9c3', color: '#b45309' }}>
              {book.price > 0 ? `฿${book.price}` : t('card.free')}
            </span>
          )}
        </div>

        {book.description && (
          <p className="text-xs text-[#6b7280] line-clamp-2">{book.description}</p>
        )}

        {book.owner_name && !isOwner && !hideOwner && (
          <div className="flex items-center gap-1.5 mt-auto pt-2 min-w-0">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[#2e1065] text-[10px] font-bold flex-shrink-0"
              style={{ background: book.owner_avatar_color }}
            >
              {book.owner_name[0].toUpperCase()}
            </div>
            <span className="text-xs text-[#6b7280] truncate">{book.owner_name}{book.owner_grade ? `, Gr. ${book.owner_grade}` : ''}</span>
          </div>
        )}

        <div className="flex gap-2 mt-auto pt-2">
          {isOwner ? (
            <>
              <button
                onClick={onToggleAvailable}
                className="flex-1 text-xs py-1.5 rounded-lg font-semibold transition-colors"
                style={{
                  background: book.available ? '#dcfce7' : '#e9d5ff',
                  color: book.available ? '#10b981' : '#6b7280',
                  border: `1px solid ${book.available ? '#10b981' : '#e9d5ff'}`
                }}
              >
                {book.available ? t('card.available') : t('card.unavailable')}
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-1.5 text-xs rounded-lg font-semibold"
                style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #ef4444' }}
              >
                {t('card.remove')}
              </button>
            </>
          ) : (
            <>
              {book.available && onTrade && (
                <button
                  onClick={onTrade}
                  className="flex-1 py-2 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {t('card.offerTrade')}
                </button>
              )}
              <span className="flex items-center px-1"><ReportButton targetType="book" targetId={book.id} /></span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
