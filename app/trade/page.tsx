'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import TopTabs from '@/components/TopTabs';
import MyBooksManager from '@/components/MyBooksManager';
import ChatBox from '@/components/ChatBox';
import { useI18n } from '@/lib/i18n';

const OPTIONS = [
  { href: '/trade/wonderbox', icon: '✨', key: 'wonderbox', color: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
  { href: '/trade/friend', icon: '🔍', key: 'browse', color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
];

// Red count bubble pinned to a corner of a button/banner.
function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 z-10 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-[11px] font-bold text-white animate-pulse"
      style={{ background: '#ef4444', boxShadow: '0 1px 5px rgba(239,68,68,0.6)' }}>
      {n}
    </span>
  );
}

export default function TradeHubPage() {
  const { t } = useI18n();
  const [totalTrades, setTotalTrades] = useState<number | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(0);
  const [gifts, setGifts] = useState(0);
  const [wishMatches, setWishMatches] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // Fire all requests at once instead of waterfalling them.
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).catch(() => ({ user: null })),
      fetch('/api/trades').then(r => (r.ok ? r.json() : { trades: [] })).catch(() => ({ trades: [] })),
    ]).then(([me, tr]) => {
      if (!me.user) { router.push('/login'); return; }
      const userId = me.user.id;
      const all = tr.trades ?? [];
      setTotalTrades(all.filter((x: any) => x.status === 'accepted' || x.status === 'completed').length);
      setAwaitingConfirm(all.filter((x: any) => {
        if (x.status !== 'accepted') return false;
        const mine = x.requester_id === userId ? x.requester_confirm : x.owner_confirm;
        return mine !== 'happened';
      }).length);
    });
    // Gift boxes waiting to be opened in the Wonder Box.
    fetch('/api/wonderbox').then(r => (r.ok ? r.json() : { deposits: [] })).then(d =>
      setGifts((d.deposits ?? []).filter((x: any) => x.status === 'matched').length)
    );
    // Wishlist books currently available.
    fetch('/api/wishlist').then(r => (r.ok ? r.json() : { matches: [] })).then(d =>
      setWishMatches((d.matches ?? []).length)
    );
  }, [router]);

  const counter = String(totalTrades ?? 0).padStart(10, '0');

  const banners = (
    <div className="flex flex-col gap-3">
      <ChatBox />
      {OPTIONS.map(o => (
        <div key={o.key} className="relative">
          <Badge n={o.key === 'wonderbox' ? gifts : 0} />
          <Link
            href={o.href}
            className="flex items-center gap-4 px-6 py-5 rounded-full transition-transform hover:scale-[1.02]"
            style={{ background: o.color, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
          >
            <span className="text-3xl w-10 text-center flex-shrink-0">{o.icon}</span>
            <span className="flex-1">
              <span className="block font-bold text-[#2e1065] text-lg leading-tight">{t(`hub.${o.key}`)}</span>
              <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{t(`hub.${o.key}Desc`)}</span>
            </span>
            {o.key === 'wonderbox' && gifts > 0 && <span className="text-2xl flex-shrink-0">🎁</span>}
          </Link>
        </div>
      ))}
      {/* Wishlist */}
      <div className="relative">
        <Badge n={wishMatches} />
        <Link href="/wishlist"
          className="flex items-center gap-4 px-6 py-5 rounded-full transition-transform hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}>
          <span className="text-3xl w-10 text-center flex-shrink-0">⭐</span>
          <span className="flex-1">
            <span className="block font-bold text-[#2e1065] text-lg leading-tight">{t('hub.wishlist')}</span>
            <span className="block text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {wishMatches > 0 ? t('hub.wishlistMatches', { n: wishMatches }) : t('hub.wishlistDesc')}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <TopTabs />

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2e1065]">{t('hub.title')}</h1>
          <span className="relative inline-block">
            <Badge n={awaitingConfirm} />
            <Link
              href="/trade/irl"
              className="inline-block text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full transition-transform hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#ffffff' }}
            >
              🤝 {t('hub.irl')}
            </Link>
          </span>
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
