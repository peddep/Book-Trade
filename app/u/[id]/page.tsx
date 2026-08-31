'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '@/components/Loading';
import BookCard from '@/components/BookCard';
import BookShelf from '@/components/BookShelf';
import TradeModal from '@/components/TradeModal';
import ReportButton from '@/components/ReportButton';
import { useI18n } from '@/lib/i18n';

interface PublicUser {
  id: number;
  name: string;
  grade: string | null;
  class_no?: string | null;
  contact?: string | null;
  avatar_color: string;
}

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
  cover_len?: number | null;
  price?: number | null;
  available: number;
  owner_name: string;
  owner_avatar_color: string;
  owner_grade?: string;
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, gradeLabel } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [isMe, setIsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tradeBook, setTradeBook] = useState<Book | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch(`/api/users/${id}`).then(async r => {
      if (r.status === 401) { router.replace('/'); return; }
      if (!r.ok) { setNotFound(true); setLoading(false); return; }
      const d = await r.json();
      setUser(d.user);
      setBooks(d.books ?? []);
      setIsMe(!!d.isMe);
      setLoading(false);
    });
  }, [id, router]);

  function handleTradeSuccess() {
    setTradeBook(null);
    setSuccess(t('books.tradeSent'));
    setTimeout(() => setSuccess(''), 5000);
  }

  if (loading) return (<Loading />);
  if (notFound || !user) return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🤷</div>
        <p className="text-[#6b7280] text-lg">{t('user.notFound')}</p>
      </main>
    </>
  );

  return (
    <>
      <main className="max-w-6xl 2xl:max-w-[100rem] mx-auto px-4 lg:px-8 py-6">
        <button onClick={() => router.back()} className="text-sm text-[#6b7280] hover:text-[#2e1065] mb-3">← {t('hub.back').replace('← ', '')}</button>

        {/* Profile header. Everything about this student sits together on the
            left; the shelf count is the one number worth pulling out. */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, #ffffff, #ede9fe)', border: '1px solid #e9d5ff' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0" style={{ background: user.avatar_color }}>
            {user.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#2e1065] truncate">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
              {user.grade && <p className="text-sm" style={{ color: '#7c3aed' }}>{gradeLabel(user.grade, user.class_no)}</p>}
              <p className="text-sm text-[#6b7280]">
                <span className="font-bold text-[#2e1065]">{books.length}</span> {t('profile.booksListed')}
              </p>
              {user.contact && (
                <span className="text-sm inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: '#faf5ff', border: '1px solid #e9d5ff', color: '#6b7280' }}>
                  📱 <span className="font-semibold text-[#2e1065]">{user.contact}</span>
                </span>
              )}
            </div>
          </div>
          {!isMe && <div className="ml-auto self-start"><ReportButton targetType="user" targetId={user.id} variant="text" /></div>}
        </div>

        {success && (
          <div className="mb-6 p-4 rounded-xl text-sm font-semibold" style={{ background: '#dcfce7', color: '#10b981', border: '1px solid #10b981' }}>
            ✓ {success}
          </div>
        )}

        <h2 className="text-lg font-bold text-[#2e1065] mb-4">{t('user.booksOf', { name: user.name })}</h2>
        {books.length === 0 ? (
          <p className="text-[#6b7280] text-sm py-10 text-center">{t('user.noBooks')}</p>
        ) : (
          <>
            {/* Phone: 3-column thumbnail shelf, tap a book to offer a trade */}
            <div className="sm:hidden">
              <BookShelf
                books={books}
                selectMode
                onSelect={id => { if (isMe) return; const b = books.find(x => x.id === id); if (b) setTradeBook(b); }}
                maxHeight="none"
              />
            </div>
            {/* Larger screens: detailed cards */}
            <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-4">
              {books.map(book => (
                <BookCard key={book.id} book={book} hideOwner onTrade={isMe ? undefined : () => setTradeBook(book)} />
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
