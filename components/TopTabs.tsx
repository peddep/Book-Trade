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
    <div className="flex justify-center gap-2 mb-6 md:hidden">
      {TABS.map(tab => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 max-w-[10rem] text-center py-2.5 text-sm font-bold transition-colors"
            style={{
              color: active ? '#ffffff' : '#9ca3af',
              borderBottom: active ? '3px solid #8b5cf6' : '3px solid transparent',
            }}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}
