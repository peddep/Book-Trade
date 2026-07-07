'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import TopTabs from '@/components/TopTabs';
import MyBooksManager from '@/components/MyBooksManager';
import { useI18n } from '@/lib/i18n';

const OPTIONS = [
  { href: '/trade/wonderbox', icon: '✨', key: 'wonderbox', color: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
  { href: '/trade/friend', icon: '🔍', key: 'browse', color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
];

interface RecentTrade {
  offered_title: string;
  offered_title_en?: string | null;
  offered_color: string;
  offered_cover_url?: string | null;
  wanted_title: string;
  wanted_title_en?: string | null;
  wanted_color: string;
  wanted_cover_url?: string | null;
}

function MiniCover({ url, color, title }: { url?: string | null; color: string; title: string }) {
  return (
    <div className="relative rounded-r-md rounded-l-sm overflow-hidden flex-shrink-0"
      style={{ width: 40, aspectRatio: '2 / 3', background: color, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="absolute inset-0 w-full h-full object-cover" loading="lazy"
          onError={e => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-base">📖</span>
      )}
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.3), rgba(0,0,0,0))' }} />
    </div>
  );
}

export default function TradeHubPage() {
  const { t, bookTitle } = useI18n();
  const [totalTrades, setTotalTrades] = useState<number | null>(null);
  const [recent, setRecent] = useState<RecentTrade | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) router.push('/login');
    });
    fetch('/api/trades').then(r => (r.ok ? r.json() : { trades: [] })).then(d => {
      const all = d.trades ?? [];
      setTotalTrades(all.filter((x: any) => x.status === 'accepted').length);
      // Most recently completed in-person trade.
      const completed = all
        .filter((x: any) => x.status === 'completed')
        .sort((a: any, b: any) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
      setRecent(completed[0] ?? null);
    });
  }, [router]);

  const counter = String(totalTrades ?? 0).padStart(10, '0');

  const recentCard = recent && (
    <div className="p-3 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
      <p className="text-xs font-semibold mb-2" style={{ color: '#7c3aed' }}>🤝 {t('hub.recentIrl')}</p>
      <div className="flex items-center gap-2">
        <MiniCover url={recent.offered_cover_url} color={recent.offered_color} title={bookTitle(recent.offered_title, recent.offered_title_en)} />
        <p className="text-xs font-semibold text-[#2e1065] leading-tight flex-1 min-w-0 truncate">{bookTitle(recent.offered_title, recent.offered_title_en)}</p>
        <span className="text-sm text-[#9ca3af] flex-shrink-0">⇄</span>
        <p className="text-xs font-semibold text-[#2e1065] leading-tight flex-1 min-w-0 truncate text-right">{bookTitle(recent.wanted_title, recent.wanted_title_en)}</p>
        <MiniCover url={recent.wanted_cover_url} color={recent.wanted_color} title={bookTitle(recent.wanted_title, recent.wanted_title_en)} />
      </div>
    </div>
  );

  const banners = (
    <div className="flex flex-col gap-3">
      {recentCard}
      {OPTIONS.map(o => (
        <Link
          key={o.key}
          href={o.href}
          className="flex items-center gap-4 px-6 py-5 rounded-full transition-transform hover:scale-[1.02]"
          style={{ background: o.color, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
        >
          <span className="text-3xl w-10 text-center flex-shrink-0">{o.icon}</span>
          <span className="flex-1">
            <span className="block font-bold text-[#2e1065] text-lg leading-tight">{t(`hub.${o.key}`)}</span>
            <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{t(`hub.${o.key}Desc`)}</span>
          </span>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <TopTabs />

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2e1065]">{t('hub.title')}</h1>
          <Link
            href="/trade/irl"
            className="text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full transition-transform hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#ffffff' }}
          >
            🤝 {t('hub.irl')}
          </Link>
        </div>

        {/* Total trades counter (Pokémon HOME style) */}
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-6"
          style={{ background: '#ede9fe', border: '1px solid #7c3aed' }}
        >
          <span className="text-sm font-semibold" style={{ color: '#7c3aed' }}>{t('hub.totalTrades')}</span>
          <span className="font-mono text-lg tracking-widest" style={{ color: '#6d28d9' }}>{counter}</span>
        </div>

        {/* Desktop (16:9): books + add on the left, trade options on the right.
            Phone: just the trade banners (books live in the Your Books tab). */}
        <div className="md:grid md:grid-cols-2 md:gap-6">
          <aside className="hidden md:block">
            <div className="p-4 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
              <MyBooksManager compact />
            </div>
          </aside>

          <div className="flex flex-col justify-center gap-4">{banners}</div>
        </div>
      </main>
    </>
  );
}
