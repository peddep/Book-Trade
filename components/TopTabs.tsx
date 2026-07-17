'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

const TABS = [
  { href: '/trade', key: 'tabs.trade' },
  { href: '/room', key: 'tabs.room' },
  { href: '/profile', key: 'tabs.books' },
];

// Pokémon HOME-style top tab selector for the three main screens.
export default function TopTabs() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="flex justify-center gap-2 mb-6 md:hidden p-1 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
      {TABS.map(tab => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 max-w-[10rem] text-center py-2 rounded-xl text-sm font-bold transition-colors"
            style={active
              ? { background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: '#ffffff', boxShadow: '0 2px 8px rgba(124,58,237,0.4)' }
              : { color: '#7c3aed' }}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}
