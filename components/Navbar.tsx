'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: number;
  name: string;
  email: string;
  grade: string | null;
  avatar_color: string;
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user));
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
  }

  return (
    <nav style={{ background: '#1a1a2e', borderBottom: '1px solid #2d2d4a' }} className="sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">📚</span>
          <span className="font-bold text-xl" style={{ color: '#a78bfa' }}>BookTrade</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/books" className="text-sm text-slate-300 hover:text-white hidden sm:block">Browse</Link>
              <Link href="/trades" className="text-sm text-slate-300 hover:text-white hidden sm:block">My Trades</Link>
              <Link href="/profile" className="text-sm text-slate-300 hover:text-white hidden sm:block">My Books</Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 rounded-full p-1 hover:opacity-80"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: user.avatar_color }}
                  >
                    {user.name[0].toUpperCase()}
                  </div>
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-xl shadow-lg py-2 z-50"
                    style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}
                  >
                    <div className="px-4 py-2 border-b" style={{ borderColor: '#2d2d4a' }}>
                      <p className="font-semibold text-sm">{user.name}</p>
                      {user.grade && <p className="text-xs text-slate-400">Grade {user.grade}</p>}
                    </div>
                    <Link href="/books" className="block px-4 py-2 text-sm hover:bg-slate-700 sm:hidden">Browse Books</Link>
                    <Link href="/trades" className="block px-4 py-2 text-sm hover:bg-slate-700 sm:hidden">My Trades</Link>
                    <Link href="/profile" className="block px-4 py-2 text-sm hover:bg-slate-700 sm:hidden">My Books</Link>
                    <button onClick={logout} className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-slate-300 hover:text-white px-3 py-1.5"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                Join
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
