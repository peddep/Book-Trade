'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function BooksPage() {
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
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t('books.title')}</h1>
          <p className="text-slate-400">{t('books.subtitle')}</p>
        </div>

        {success && (
          <div className="mb-6 p-4 rounded-xl text-sm font-semibold" style={{ background: '#1e3a2f', color: '#10b981', border: '1px solid #10b981' }}>
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
            style={{ background: '#1a1a2e', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
          />
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="sm:w-48 p-3 rounded-xl text-sm"
            style={{ background: '#1a1a2e', border: '1px solid #2d2d4a', color: subject ? '#e2e8f0' : '#64748b', outline: 'none' }}
          >
            <option value="">{t('books.allSubjects')}</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{t(`subj.${s}`)}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">{t('books.loading')}</div>
        ) : books.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-slate-400 text-lg">{t('books.noneFound')}</p>
            <p className="text-slate-500 text-sm mt-1">{t('books.noneFoundHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {books.map(book => (
              <BookCard
                key={book.id}
                book={book}
                onTrade={() => setTradeBook(book)}
              />
            ))}
          </div>
        )}
      </main>

      {tradeBook && (
        <TradeModal
          targetBook={tradeBook}
          onClose={() => setTradeBook(null)}
          onSuccess={handleTradeSuccess}
        />
      )}
    </>
  );
}
