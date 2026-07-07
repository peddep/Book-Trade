'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Loading from '@/components/Loading';
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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', grade: '', avatar_color: '#6366f1' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const router = useRouter();

  const AVATAR_COLORS = ['#6366f1', '#7c3aed', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

  function openEdit() {
    if (!user) return;
    setForm({ name: user.name, grade: user.grade ?? '', avatar_color: user.avatar_color });
    setFormError('');
    setEditing(true);
  }

  async function saveProfile() {
    if (!form.name.trim()) { setFormError(t('profile2.nameRequired')); return; }
    setSaving(true);
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const d = await res.json();
      setUser(d.user);
      setEditing(false);
    } else {
      setFormError(t('profile2.nameRequired'));
    }
    setSaving(false);
  }

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

  if (!user) return (
    <>
      <Navbar />
      <Loading />
    </>
  );

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
    <div className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>{children}</div>
  );

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <TopTabs />

        {/* User card */}
        <div className="flex items-center gap-4 mb-6 p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, #ffffff, #ede9fe)', border: '1px solid #e9d5ff' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-[#2e1065] text-2xl font-bold flex-shrink-0" style={{ background: user.avatar_color }}>
            {user.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#2e1065] truncate">{user.name}</h1>
            <p className="text-[#6b7280] text-sm truncate">{user.email}</p>
            {user.grade && <p className="text-sm mt-0.5" style={{ color: '#7c3aed' }}>{t('common.grade')} {user.grade}</p>}
          </div>
          <button onClick={openEdit} className="ml-auto flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
            ✏️ {t('room2.editProfile')}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <p className="text-3xl font-bold text-[#2e1065]">{tradesMade}</p>
            <p className="text-xs text-[#6b7280] mt-1">{t('room2.tradesMade')}</p>
          </Card>
          <Card>
            <p className="text-3xl font-bold text-[#2e1065]">{booksListed}</p>
            <p className="text-xs text-[#6b7280] mt-1">{t('room2.booksListed')}</p>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* News */}
          <div>
            <h2 className="font-bold text-[#2e1065] mb-3">📰 {t('room2.news')}</h2>
            <div className="flex flex-col gap-3">
              {news.map((n, i) => (
                <Card key={i}>
                  <p className="font-semibold text-[#2e1065] text-sm">{n.title}</p>
                  <p className="text-xs text-[#6b7280] mt-1 leading-relaxed">{n.body}</p>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Challenges */}
            <div>
              <h2 className="font-bold text-[#2e1065] mb-3">🎯 {t('room2.challenges')}</h2>
              <Card>
                <div className="flex flex-col gap-2.5">
                  {challenges.map(c => (
                    <div key={c.key} className="flex items-center gap-3">
                      <span className="text-lg">{c.done ? '✅' : '⬜'}</span>
                      <span className="text-sm" style={{ color: c.done ? '#10b981' : '#6b7280' }}>{t(c.key)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Achievements */}
            <div>
              <h2 className="font-bold text-[#2e1065] mb-3">🏆 {t('room2.achievements')} <span className="text-[#9ca3af] font-normal">({achievements.length}/{challenges.length})</span></h2>
              <Card>
                {achievements.length === 0 ? (
                  <p className="text-sm text-[#6b7280]">{t('ach.locked')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {achievements.map(a => (
                      <span key={a.key} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#dcfce7', color: '#10b981' }}>
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
        <h2 className="font-bold text-[#2e1065] mt-6 mb-3">⚙️ {t('room2.settings')}</h2>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[#4b5563]">{t('room2.language')}</span>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#ffffff' }}>
              {(['th', 'en'] as Lang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={lang === l ? { background: '#6366f1', color: 'white' } : { color: '#6b7280' }}
                >
                  {l === 'th' ? '🇹🇭 ไทย' : '🇬🇧 EN'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={logout} className="w-full py-2.5 rounded-xl font-semibold text-sm" style={{ background: '#fee2e2', color: '#ef4444' }}>
            {t('room2.signOut')}
          </button>
        </Card>

        {/* Edit profile modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(46, 16, 101, 0.4)' }}
            onClick={() => setEditing(false)}>
            <div className="w-full max-w-sm p-6 rounded-2xl shadow-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-lg font-bold text-[#2e1065]">{t('profile2.title')}</p>
                <button onClick={() => setEditing(false)} className="text-[#6b7280] hover:text-[#2e1065] text-xl">✕</button>
              </div>

              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ background: form.avatar_color }}>
                  {(form.name.trim()[0] || '?').toUpperCase()}
                </div>
              </div>

              <label className="block text-xs font-semibold text-[#6b7280] mb-1">{t('profile2.name')}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm mb-3 text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }} />

              <label className="block text-xs font-semibold text-[#6b7280] mb-1">{t('profile2.gradeOptional')}</label>
              <input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm mb-3 text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }} />

              <label className="block text-xs font-semibold text-[#6b7280] mb-2">{t('profile2.avatarColor')}</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, avatar_color: c }))}
                    className="w-8 h-8 rounded-full transition-transform"
                    style={{ background: c, transform: form.avatar_color === c ? 'scale(1.15)' : 'scale(1)', boxShadow: form.avatar_color === c ? '0 0 0 3px #ffffff, 0 0 0 5px ' + c : 'none' }} />
                ))}
              </div>

              {formError && <p className="text-sm text-red-500 mb-3">{formError}</p>}

              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                  {t('profile2.cancel')}
                </button>
                <button onClick={saveProfile} disabled={saving} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                  {t('profile2.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
