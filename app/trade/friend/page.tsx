'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import BookCard from '@/components/BookCard';
import TradeModal from '@/components/TradeModal';
import { useI18n } from '@/lib/i18n';

const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Art', 'Music', 'PE', 'Computer Science', 'Other'];

interface Book {
  id: number;
  title: string;
  author: string;
  subject?: string;
  grade_level?: string;
  condition: string;
  description?: string;
  cover_color: string;
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
        <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <div className="mt-2 mb-6">
          <h1 className="text-3xl font-bold text-[#2e1065] mb-1">🤝 {t('hub.friend')}</h1>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {books.map(book => (
              <BookCard key={book.id} book={book} onTrade={() => setTradeBook(book)} />
            ))}
          </div>
        )}
      </main>

      {tradeBook && (
        <TradeModal targetBook={tradeBook} onClose={() => setTradeBook(null)} onSuccess={handleTradeSuccess} />
      )}
    </>
  );
}
