'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import BookCard from '@/components/BookCard';
import BookShelf from '@/components/BookShelf';
import TradeModal from '@/components/TradeModal';
import { useI18n } from '@/lib/i18n';

const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Art', 'Music', 'PE', 'Computer Science', 'Other'];

interface Book {
  id: number;
  title: string;
  title_en?: string | null;
  author: string;
  subject?: string;
  grade_level?: string;
  condition: string;
  description?: string;
  cover_color: string;
  cover_url?: string | null;
  price?: number | null;
  available: number;
  owner_name: string;
  owner_avatar_color: string;
  owner_grade?: string;
}

export default function FriendTradePage() {
  const { t } = useI18n();
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [tradeBook, setTradeBook] = useState<Book | null>(null);
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(0);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) return;
      fetch('/api/trades').then(r => (r.ok ? r.json() : { trades: [] })).then(data =>
        setPending((data.trades ?? []).filter((tr: any) => tr.owner_id === d.user.id && tr.status === 'pending').length)
      );
    });
  }, []);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (subject) params.set('subject', subject);
    const res = await fetch(`/api/books?${params}`);
    const data = await res.json();
    setBooks(data.books ?? []);
    setLoading(false);
  }, [query, subject]);

  useEffect(() => {
    const id = setTimeout(fetchBooks, 300);
    return () => clearTimeout(id);
  }, [fetchBooks]);

  function handleTradeSuccess() {
    setTradeBook(null);
    setSuccess(t('books.tradeSent'));
    setTimeout(() => setSuccess(''), 5000);
  }

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
          <Link
            href="/trades"
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            🔔 {t('nav.trades')}
            {pending > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: '#ffffff', color: '#ef4444' }}>
                {pending}
              </span>
            )}
          </Link>
        </div>
        <div className="mt-2 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065] mb-1">🔍 {t('hub.browse')}</h1>
          <p className="text-[#6b7280] text-sm">{t('books.subtitle')}</p>
        </div>

        {success && (
          <div className="mb-6 p-4 rounded-xl text-sm font-semibold" style={{ background: '#dcfce7', color: '#10b981', border: '1px solid #10b981' }}>
            ✓ {success}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            type="text"
            placeholder={t('books.searchPlaceholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 p-3 rounded-xl text-sm"
            style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
          />
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="sm:w-48 p-3 rounded-xl text-sm"
            style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: subject ? '#2e1065' : '#9ca3af', outline: 'none' }}
          >
            <option value="">{t('books.allSubjects')}</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{t(`subj.${s}`)}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#6b7280]">{t('books.loading')}</div>
        ) : books.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-[#6b7280] text-lg">{t('books.noneFound')}</p>
            <p className="text-[#9ca3af] text-sm mt-1">{t('books.noneFoundHint')}</p>
          </div>
        ) : (
          <>
            {/* Phone: 3-column thumbnail shelf, tap a book to offer a trade */}
            <div className="sm:hidden">
              <BookShelf
                books={books}
                selectMode
                onSelect={id => { const b = books.find(x => x.id === id); if (b) setTradeBook(b); }}
                maxHeight="none"
              />
            </div>
            {/* Larger screens: detailed cards */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {books.map(book => (
                <BookCard key={book.id} book={book} onTrade={() => setTradeBook(book)} />
              ))}
            </div>
          </>
        )}
      </main>

      {tradeBook && (
        <TradeModal targetBook={tradeBook} onClose={() => setTradeBook(null)} onSuccess={handleTradeSuccess} />
      )}
    </>
  );
}
