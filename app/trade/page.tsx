'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BookShelf from '@/components/BookShelf';
import TradeModal from '@/components/TradeModal';
import TopTabs from '@/components/TopTabs';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';

import { SUBJECTS } from '@/lib/subjects';

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

// Red count bubble pinned to a corner of a button.
function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 z-10 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[11px] font-bold text-white animate-pulse"
      style={{ background: '#ef4444', boxShadow: '0 1px 5px rgba(239,68,68,0.6)' }}>
      {n}
    </span>
  );
}

// The trade page IS browsing other students' books. It used to be a menu of
// ways to trade, with browsing one banner among them; everything else on it
// either had no takers or has been retired, so the menu was a step in front of
// the only thing anyone came here to do. Wonder Box, in-person meet-ups and
// incoming offers keep their place as buttons at the top.
export default function TradePage() {
  const { t } = useI18n();
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [tradeBook, setTradeBook] = useState<Book | null>(null);
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(0);
  const [awaitingConfirm, setAwaitingConfirm] = useState(0);
  const [gifts, setGifts] = useState(0);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { router.replace('/'); return; }
    const userId = user.id;
    fetch('/api/trades?counts=1')
      .then(r => (r.ok ? r.json() : {}))
      .then((d: { pending?: number }) => setPending(Number(d.pending) || 0))
      .catch(() => {});
    // Meet-ups still waiting on this student to say whether the swap happened.
    fetch('/api/trades').then(r => (r.ok ? r.json() : { trades: [] })).catch(() => ({ trades: [] })).then(tr => {
      setAwaitingConfirm((tr.trades ?? []).filter((x: any) => {
        if (x.status !== 'accepted') return false;
        const mine = x.requester_id === userId ? x.requester_confirm : x.owner_confirm;
        return mine !== 'happened';
      }).length);
    });
    // Gift boxes waiting to be opened in the Wonder Box.
    fetch('/api/wonderbox').then(r => (r.ok ? r.json() : { deposits: [] })).then(d =>
      setGifts((d.deposits ?? []).filter((x: any) => x.status === 'matched').length)
    ).catch(() => {});
  }, [router, user, sessionLoading]);

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
      <main className="max-w-6xl 2xl:max-w-[110rem] mx-auto px-4 lg:px-8 py-6">
        <TopTabs />

        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065] mb-1">🔍 {t('hub.browse')}</h1>
            <p className="text-[#6b7280] text-sm">{t('books.subtitle')}</p>
          </div>

          {/* The other three places a trade can be: a surprise swap, the
              meet-ups already agreed, and offers waiting on an answer. */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="relative inline-block">
              <Badge n={gifts} />
              <Link href="/trade/wonderbox"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3 py-2 rounded-full text-white bt-press"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                ✨ {t('hub.wonderbox')}
              </Link>
            </span>
            <span className="relative inline-block">
              <Badge n={awaitingConfirm} />
              <Link href="/trade/irl"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3 py-2 rounded-full text-white bt-press"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                🤝 {t('hub.irl')}
              </Link>
            </span>
            <span className="relative inline-block">
              <Badge n={pending} />
              <Link href="/trades"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3 py-2 rounded-full bt-press"
                style={{ background: '#ffffff', color: '#6d28d9', border: '1px solid #e9d5ff' }}>
                🔔 {t('nav.trades')}
              </Link>
            </span>
          </div>
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
          /* The same shelf of covers at every size — a desktop just gets more
             of them across. Tapping a book opens the offer, where its details
             are laid out in full. */
          <BookShelf
            books={books}
            selectMode
            onSelect={id => { const b = books.find(x => x.id === id); if (b) setTradeBook(b); }}
            maxHeight="none"
            gridClass="grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10"
          />
        )}
      </main>

      {tradeBook && (
        <TradeModal targetBook={tradeBook} onClose={() => setTradeBook(null)} onSuccess={handleTradeSuccess} />
      )}
    </>
  );
}
