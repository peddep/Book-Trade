'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import NotificationBell from '@/components/NotificationBell';

const NAV = [
  { href: '/trade', key: 'tabs.trade' },
  { href: '/room', key: 'tabs.room' },
  { href: '/profile', key: 'tabs.books' },
  { href: '/trades', key: 'nav.trades' },
];

export default function Navbar() {
  // Shared session: fetched once for the whole app, so opening a page no longer
  // re-asks who is signed in.
  const { user, setUser, refresh } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang, t, gradeLabel } = useI18n();

  // Count incoming offers awaiting a reply. Deliberately not keyed on the
  // pathname: the number does not change because the student changed page, and
  // re-fetching it on every hop was making navigation wait on the network.
  useEffect(() => {
    if (!user) { setPending(0); return; }
    const check = () =>
      fetch('/api/trades?counts=1')
        .then(r => {
          // Refused: the account has been banned since this page loaded. Ask
          // the session who we are now — that clears the cookie and signs them
          // out, without waiting for the session's own slower timer.
          if (r.status === 403) { refresh(); return { pending: 0 }; }
          return r.ok ? r.json() : { pending: 0 };
        })
        .then(d => setPending(Number(d.pending) || 0))
        .catch(() => {});
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [user, refresh]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
  }

  return (
    <nav style={{ background: '#ffffff', borderBottom: '1px solid #e9d5ff' }} className="sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8 min-w-0">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl hidden sm:inline">📚</span>
            <span className="font-bold text-lg sm:text-xl whitespace-nowrap" style={{ color: '#7c3aed' }}>{t('brand.name')}</span>
          </Link>

          {/* Desktop navigation. On a phone these three live in the tab strip on
              the page itself; on a big screen there was nothing at all — the way
              to any of them was to notice the avatar was a menu. */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {NAV.map(item => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                    style={active
                      ? { background: '#f3e8ff', color: '#6d28d9' }
                      : { color: '#6b7280' }}
                  >
                    {t(item.key)}
                    {item.href === '/trades' && pending > 0 && (
                      <span className="ml-1.5 inline-flex min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white items-center justify-center align-middle"
                        style={{ background: '#ef4444' }}>
                        {pending}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="text-sm font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg whitespace-nowrap"
            style={{ background: '#e9d5ff', color: '#2e1065' }}
            title="Change language"
            aria-label="Change language"
          >
            {lang === 'th' ? '🇹🇭' : '🇬🇧'}<span className="hidden sm:inline"> {lang === 'th' ? 'ไทย' : 'EN'}</span>
          </button>
          {user && <NotificationBell />}
          {user ? (
            // Hidden on phone: the three tabs sit on the page itself, sign-out
            // is in the room page settings, and offers are reachable from there
            // and from the bell — so on a small screen this menu was only
            // crowding the header.
            <div className="relative hidden sm:block">
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
                  {/* Between sm and md the inline links are not shown yet, so
                      keep them reachable here. */}
                  <div className="md:hidden">
                    <Link href="/trade" className="block px-4 py-2 text-sm hover:bg-[#f5f3ff]" style={{ color: '#7c3aed' }}>✨ {t('tabs.trade')}</Link>
                    <Link href="/room" className="block px-4 py-2 text-sm hover:bg-[#f5f3ff]">{t('tabs.room')}</Link>
                    <Link href="/profile" className="block px-4 py-2 text-sm hover:bg-[#f5f3ff]">{t('tabs.books')}</Link>
                    <Link href="/trades" className="flex items-center justify-between px-4 py-2 text-sm hover:bg-[#f5f3ff]">
                      <span>{t('nav.trades')}</span>
                      {pending > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#ef4444' }}>{pending}</span>
                      )}
                    </Link>
                  </div>
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
                className="hidden min-[360px]:inline text-sm text-[#4b5563] hover:text-[#2e1065] px-2 sm:px-3 py-1.5 whitespace-nowrap"
              >
                {t('nav.signIn')}
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-lg text-white whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                <span className="sm:hidden">{t('nav.joinShort')}</span>
                <span className="hidden sm:inline">{t('nav.join')}</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
