'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Loading from '@/components/Loading';
import BookCard from '@/components/BookCard';
import TradeModal from '@/components/TradeModal';
import TitleInput from '@/components/TitleInput';
import { useI18n } from '@/lib/i18n';
import { catalogTitleParts } from '@/lib/books-catalog';

interface Wish { id: number; title: string; title_en?: string | null; }
interface Book {
  id: number; title: string; title_en?: string | null; author: string; subject?: string;
  condition: string; cover_color: string; cover_url?: string | null; price?: number | null;
  available: number; owner_name: string; owner_avatar_color: string; owner_grade?: string; mutual?: number;
}

export default function WishlistPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [matches, setMatches] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [tradeBook, setTradeBook] = useState<Book | null>(null);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/wishlist');
    if (res.status === 401) { router.push('/login'); return; }
    if (res.ok) {
      const d = await res.json();
      setWishes(d.wishes ?? []);
      setMatches(d.matches ?? []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function addWish() {
    const title = input.trim();
    if (!title) return;
    const parts = catalogTitleParts(title);
    await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: parts?.th ?? title, title_en: parts?.en ?? null }),
    });
    setInput('');
    load();
  }

  async function removeWish(id: number) {
    setWishes(prev => prev.filter(w => w.id !== id));
    await fetch(`/api/wishlist?id=${id}`, { method: 'DELETE' });
    load();
  }

  function handleTradeSuccess() {
    setTradeBook(null);
    setSuccess(t('books.tradeSent'));
    setTimeout(() => setSuccess(''), 4000);
  }

  if (loading) return (<><Navbar /><Loading /></>);

  const mutual = matches.filter(b => Number(b.mutual) === 1);

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065] mt-2">⭐ {t('wish.title')}</h1>
        <p className="text-sm text-[#6b7280] mb-5">{t('wish.subtitle')}</p>

        {success && (
          <div className="mb-5 p-3 rounded-xl text-sm font-semibold" style={{ background: '#dcfce7', color: '#10b981', border: '1px solid #10b981' }}>✓ {success}</div>
        )}

        {/* Add a wish */}
        <div className="p-4 rounded-2xl mb-6" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          <label className="text-sm font-semibold text-[#4b5563] mb-1.5 block">{t('wish.add')}</label>
          <div className="flex gap-2">
            <div className="flex-1"><TitleInput value={input} onChange={setInput} placeholder={t('profile.fTitlePlaceholder')} listId="wish-title" /></div>
            <button onClick={addWish} disabled={!input.trim()}
              className="px-4 rounded-xl font-semibold text-sm text-white disabled:opacity-40 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
              {t('wish.addBtn')}
            </button>
          </div>
          {/* Current wishes as chips */}
          {wishes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {wishes.map(w => (
                <span key={w.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm" style={{ background: '#faf5ff', border: '1px solid #e9d5ff', color: '#2e1065' }}>
                  {w.title}
                  <button onClick={() => removeWish(w.id)} className="text-[#ef4444] font-bold" aria-label="remove">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Mutual matches — the best trades */}
        {mutual.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-1" style={{ color: '#7c3aed' }}>🔥 {t('wish.mutual')}</h2>
            <p className="text-xs text-[#6b7280] mb-3">{t('wish.mutualHint')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {mutual.map(book => (
                <div key={book.id} className="rounded-2xl" style={{ boxShadow: '0 0 0 2px #f59e0b' }}>
                  <BookCard book={book} onTrade={() => setTradeBook(book)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All available matches */}
        <h2 className="text-lg font-bold text-[#2e1065] mb-3">{t('wish.available', { n: matches.length })}</h2>
        {matches.length === 0 ? (
          <p className="text-[#6b7280] text-sm py-10 text-center">{wishes.length === 0 ? t('wish.empty') : t('wish.noneYet')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {matches.map(book => (
              <BookCard key={book.id} book={book} onTrade={() => setTradeBook(book)} />
            ))}
          </div>
        )}
      </main>

      {tradeBook && <TradeModal targetBook={tradeBook} onClose={() => setTradeBook(null)} onSuccess={handleTradeSuccess} />}
    </>
  );
}
