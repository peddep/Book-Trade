'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import TopTabs from '@/components/TopTabs';
import { useI18n, type Lang } from '@/lib/i18n';

interface User {
  id: number;
  name: string;
  email: string;
  grade: string | null;
  avatar_color: string;
}

export default function RoomPage() {
  const { t, lang, setLang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [tradesMade, setTradesMade] = useState(0);
  const [booksListed, setBooksListed] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      setUser(d.user);
    });
    fetch('/api/trades').then(r => (r.ok ? r.json() : { trades: [] })).then(d =>
      setTradesMade((d.trades ?? []).filter((x: any) => x.status === 'accepted').length)
    );
    fetch('/api/books?mine=1').then(r => r.json()).then(d => setBooksListed((d.books ?? []).length));
  }, [router]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (!user) return null;

  const news = [
    { title: t('room2.news1Title'), body: t('room2.news1Body') },
    { title: t('room2.news2Title'), body: t('room2.news2Body') },
  ];

  const challenges = [
    { key: 'ch.firstBook', done: booksListed >= 1 },
    { key: 'ch.threeBooks', done: booksListed >= 3 },
    { key: 'ch.firstTrade', done: tradesMade >= 1 },
    { key: 'ch.fiveTrades', done: tradesMade >= 5 },
    { key: 'ch.wonderbox', done: tradesMade >= 1 },
  ];
  const achievements = challenges.filter(c => c.done);

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="p-5 rounded-2xl" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>{children}</div>
  );

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <TopTabs />

        {/* User card */}
        <div className="flex items-center gap-4 mb-6 p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, #1a1a2e, #241a3e)', border: '1px solid #2d2d4a' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0" style={{ background: user.avatar_color }}>
            {user.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{user.name}</h1>
            <p className="text-slate-400 text-sm truncate">{user.email}</p>
            {user.grade && <p className="text-sm mt-0.5" style={{ color: '#a78bfa' }}>{t('common.grade')} {user.grade}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <p className="text-3xl font-bold text-white">{tradesMade}</p>
            <p className="text-xs text-slate-400 mt-1">{t('room2.tradesMade')}</p>
          </Card>
          <Card>
            <p className="text-3xl font-bold text-white">{booksListed}</p>
            <p className="text-xs text-slate-400 mt-1">{t('room2.booksListed')}</p>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* News */}
          <div>
            <h2 className="font-bold text-white mb-3">📰 {t('room2.news')}</h2>
            <div className="flex flex-col gap-3">
              {news.map((n, i) => (
                <Card key={i}>
                  <p className="font-semibold text-white text-sm">{n.title}</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{n.body}</p>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Challenges */}
            <div>
              <h2 className="font-bold text-white mb-3">🎯 {t('room2.challenges')}</h2>
              <Card>
                <div className="flex flex-col gap-2.5">
                  {challenges.map(c => (
                    <div key={c.key} className="flex items-center gap-3">
                      <span className="text-lg">{c.done ? '✅' : '⬜'}</span>
                      <span className="text-sm" style={{ color: c.done ? '#10b981' : '#94a3b8' }}>{t(c.key)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Achievements */}
            <div>
              <h2 className="font-bold text-white mb-3">🏆 {t('room2.achievements')} <span className="text-slate-500 font-normal">({achievements.length}/{challenges.length})</span></h2>
              <Card>
                {achievements.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('ach.locked')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {achievements.map(a => (
                      <span key={a.key} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#0d2b1a', color: '#10b981' }}>
                        🏅 {t(a.key)}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>

        {/* Settings */}
        <h2 className="font-bold text-white mt-6 mb-3">⚙️ {t('room2.settings')}</h2>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-300">{t('room2.language')}</span>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#0f0f1a' }}>
              {(['th', 'en'] as Lang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={lang === l ? { background: '#6366f1', color: 'white' } : { color: '#94a3b8' }}
                >
                  {l === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={logout} className="w-full py-2.5 rounded-xl font-semibold text-sm" style={{ background: '#3a1e1e', color: '#ef4444' }}>
            {t('room2.signOut')}
          </button>
        </Card>
      </main>
    </>
  );
}
