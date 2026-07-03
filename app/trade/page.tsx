'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

interface Book {
  id: number;
  title: string;
  author: string;
  cover_color: string;
  available: number;
}

const OPTIONS = [
  { href: '/trade/wonderbox', icon: '✨', key: 'wonderbox', color: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
  { href: '/trade/gts', icon: '🌐', key: 'gts', color: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  { href: '/trade/rooms', icon: '🚪', key: 'rooms', color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  { href: '/books', icon: '🤝', key: 'friend', color: 'linear-gradient(135deg, #ec4899, #db2777)' },
];

export default function TradeHubPage() {
  const { t } = useI18n();
  const [books, setBooks] = useState<Book[]>([]);
  const [totalTrades, setTotalTrades] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) router.push('/login');
    });
    fetch('/api/books?mine=1').then(r => r.json()).then(d => setBooks(d.books ?? []));
    fetch('/api/trades').then(r => (r.ok ? r.json() : { trades: [] })).then(d =>
      setTotalTrades((d.trades ?? []).filter((x: any) => x.status === 'accepted').length)
    );
  }, [router]);

  const counter = String(totalTrades ?? 0).padStart(10, '0');

  const banners = (
    <div className="flex flex-col gap-3">
      {OPTIONS.map(o => (
        <Link
          key={o.key}
          href={o.href}
          className="flex items-center gap-4 px-6 py-5 rounded-full transition-transform hover:scale-[1.02]"
          style={{ background: o.color, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
        >
          <span className="text-3xl w-10 text-center flex-shrink-0">{o.icon}</span>
          <span className="flex-1">
            <span className="block font-bold text-white text-lg leading-tight">{t(`hub.${o.key}`)}</span>
            <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{t(`hub.${o.key}Desc`)}</span>
          </span>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">{t('hub.title')}</h1>
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#1a1a2e' }}
          >
            ⭐ {t('hub.premium')}
          </span>
        </div>

        {/* Total trades counter (Pokémon HOME style) */}
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-6"
          style={{ background: '#1e2a5a', border: '1px solid #34418a' }}
        >
          <span className="text-sm font-semibold" style={{ color: '#a5b4fc' }}>{t('hub.totalTrades')}</span>
          <span className="font-mono text-lg tracking-widest" style={{ color: '#e0e7ff' }}>{counter}</span>
        </div>

        {/* Phone: banners stacked. Desktop: books left, banners right. */}
        <div className="md:grid md:grid-cols-5 md:gap-6">
          <aside className="hidden md:block md:col-span-2">
            <div className="p-4 rounded-2xl" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
              <h2 className="font-bold text-white mb-3">📚 {t('hub.myBooks')}</h2>
              {books.length === 0 ? (
                <p className="text-sm text-slate-400">{t('hub.noBooks')}</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto">
                  {books.map(b => (
                    <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: '#0f0f1a' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: b.cover_color }}>📖</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{b.title}</p>
                        <p className="text-xs text-slate-400 truncate">{b.author}</p>
                      </div>
                      {!b.available && <span className="ml-auto text-xs flex-shrink-0" style={{ color: '#f59e0b' }}>⏳</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <div className="md:col-span-3">{banners}</div>
        </div>
      </main>
    </>
  );
}
