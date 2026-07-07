'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

interface User {
  id: number;
  name: string;
  email: string;
  grade: string | null;
  class_no?: string | null;
  avatar_color: string;
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang, t, gradeLabel } = useI18n();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user));
  }, [pathname]);

  // Count incoming trade requests still awaiting my response, and keep it fresh.
  useEffect(() => {
    if (!user) { setPending(0); return; }
    const check = () =>
      fetch('/api/trades')
        .then(r => (r.ok ? r.json() : { trades: [] }))
        .then(d => setPending((d.trades ?? []).filter((tr: any) => tr.owner_id === user.id && tr.status === 'pending').length))
        .catch(() => {});
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [user, pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
  }

  return (
    <nav style={{ background: '#ffffff', borderBottom: '1px solid #e9d5ff' }} className="sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">📚</span>
          <span className="font-bold text-xl" style={{ color: '#7c3aed' }}>BookTrade</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: '#e9d5ff', color: '#2e1065' }}
            title="Change language"
            aria-label="Change language"
          >
            {lang === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN'}
          </button>
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="relative flex items-center gap-2 rounded-full p-1 hover:opacity-80"
                aria-label="Menu"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#2e1065] font-bold text-sm"
                  style={{ background: user.avatar_color }}
                >
                  {user.name[0].toUpperCase()}
                </div>
                {pending > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#ef4444' }}>
                    {pending}
                  </span>
                )}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 rounded-xl shadow-lg py-2 z-50"
                  style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="px-4 py-2 border-b" style={{ borderColor: '#e9d5ff' }}>
                    <p className="font-semibold text-sm">{user.name}</p>
                    {user.grade && <p className="text-xs text-[#6b7280]">{gradeLabel(user.grade, user.class_no)}</p>}
                  </div>
                  <Link href="/trade" className="block px-4 py-2 text-sm hover:bg-[#f5f3ff]" style={{ color: '#7c3aed' }}>✨ {t('tabs.trade')}</Link>
                  <Link href="/room" className="block px-4 py-2 text-sm hover:bg-[#f5f3ff]">{t('tabs.room')}</Link>
                  <Link href="/profile" className="block px-4 py-2 text-sm hover:bg-[#f5f3ff]">{t('tabs.books')}</Link>
                  <Link href="/trades" className="flex items-center justify-between px-4 py-2 text-sm hover:bg-[#f5f3ff]">
                    <span>{t('nav.trades')}</span>
                    {pending > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#ef4444' }}>{pending}</span>
                    )}
                  </Link>
                  <button onClick={logout} className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#f5f3ff]">
                    {t('nav.signOut')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-[#4b5563] hover:text-[#2e1065] px-3 py-1.5"
              >
                {t('nav.signIn')}
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                {t('nav.join')}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
