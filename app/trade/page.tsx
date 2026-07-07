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

export default function TradeHubPage() {
  const { t } = useI18n();
  const [totalTrades, setTotalTrades] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) router.push('/login');
    });
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
      <main className="w-full px-4 sm:px-6 lg:px-10 py-6">
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
