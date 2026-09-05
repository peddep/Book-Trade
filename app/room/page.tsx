'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Loading from '@/components/Loading';
import TopTabs from '@/components/TopTabs';
import DonationCard from '@/components/DonationCard';
import FeedbackCard from '@/components/FeedbackCard';
import AvailabilityGrid from '@/components/AvailabilityGrid';
import PushToggle from '@/components/PushToggle';
import { useI18n, type Lang } from '@/lib/i18n';
import { useSession } from '@/lib/session';

interface User {
  id: number;
  name: string;
  email: string;
  grade: string | null;
  class_no?: string | null;
  avatar_color: string;
  contact?: string | null;
  availability?: string[];
  is_admin?: boolean;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>{children}</div>
  );
}

export default function RoomPage() {
  const { t, lang, setLang, gradeLabel } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [tradesMade, setTradesMade] = useState(0);
  const [booksListed, setBooksListed] = useState(0);
  const [pendingOffers, setPendingOffers] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', grade: '', class_no: '', contact: '', avatar_color: '#6366f1', new_password: '' });
  const [availability, setAvailability] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const { user: sessionUser, loading: sessionLoading, setUser: setSessionUser } = useSession();
  const router = useRouter();

  const AVATAR_COLORS = ['#6366f1', '#7c3aed', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

  function openEdit() {
    if (!user) return;
    setForm({ name: user.name, grade: user.grade ?? '', class_no: user.class_no ?? '', contact: user.contact ?? '', avatar_color: user.avatar_color, new_password: '' });
    setAvailability(Array.isArray(user.availability) ? user.availability : []);
    setFormError('');
    setEditing(true);
  }

  async function saveProfile() {
    if (!form.name.trim()) { setFormError(t('profile2.nameRequired')); return; }
    if (!form.grade || !form.class_no || !form.contact.trim()) { setFormError(t('reg.missingFields')); return; }
    if (availability.length === 0) { setFormError(t('reg.availabilityRequired')); return; }
    if (form.new_password && form.new_password.length < 6) { setFormError(t('reg.passwordHint')); return; }
    setSaving(true);
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, availability }),
    });
    if (res.ok) {
      const d = await res.json();
      setUser(d.user);
      // Keep the shared session in step, or the navbar keeps showing the old
      // name and avatar until a full reload.
      setSessionUser(d.user);
      setEditing(false);
    } else {
      const d = await res.json().catch(() => ({}));
      setFormError(
        d.error === 'name_taken' ? t('profile2.nameTaken')
        : d.error === 'missing_fields' ? t('reg.missingFields')
        : t('profile2.nameRequired'));
    }
    setSaving(false);
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) { router.replace('/'); return; }
    setUser(sessionUser as User);
    // Two numbers, counted in the database, instead of every trade row this
    // student has ever been part of.
    fetch('/api/trades?counts=1').then(r => (r.ok ? r.json() : {})).catch(() => ({})).then((d: { pending?: number; accepted?: number }) => {
      setTradesMade(Number(d.accepted) || 0);
      setPendingOffers(Number(d.pending) || 0);
    });
    fetch('/api/books?mine=1').then(r => r.json()).then(d => setBooksListed((d.books ?? []).length));
  }, [router, sessionUser, sessionLoading]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Clear the shared session as well, or the app carries on showing the
    // signed-in site to somebody who has just signed out of it.
    setSessionUser(null);
    router.push('/');
  }

  async function confirmDelete() {
    if (!user) return;
    setDeleting(true);
    setDeleteError('');
    const res = await fetch('/api/auth/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm_name: deleteInput }),
    });
    if (res.ok) {
      setSessionUser(null);
      router.push('/');
      return;
    }
    const d = await res.json().catch(() => ({}));
    setDeleteError(
      d.error === 'name_mismatch' ? t('account.deleteMismatch')
      : d.error === 'in_agreed_trade' ? t('account.deleteBlocked')
      : t('account.deleteFailed')
    );
    setDeleting(false);
  }

  if (!user) return (
    <>
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

  return (
    <>
      <main className="max-w-4xl xl:max-w-6xl mx-auto px-4 lg:px-8 py-6">
        <TopTabs />

        {/* User card */}
        <div className="flex items-center gap-4 mb-6 p-6 rounded-2xl" style={{ background: 'linear-gradient(135deg, #ffffff, #ede9fe)', border: '1px solid #e9d5ff' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-[#2e1065] text-2xl font-bold flex-shrink-0" style={{ background: user.avatar_color }}>
            {user.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#2e1065] truncate">{user.name}</h1>
            <p className="text-[#6b7280] text-sm truncate">{user.email}</p>
            {user.grade && <p className="text-sm mt-0.5" style={{ color: '#7c3aed' }}>{gradeLabel(user.grade, user.class_no)}</p>}
          </div>
          <button onClick={openEdit} className="ml-auto flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
            ✏️ {t('room2.editProfile')}
          </button>
          <button onClick={() => setShowSettings(true)} aria-label={t('room2.settings')}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base"
            style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
            ⚙️
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

        {/* Incoming offers. This is the only route to /trades on a phone, where
            the navbar menu that used to hold it is hidden. */}
        <Link href="/trades"
          className="flex items-center justify-between gap-3 mb-6 px-5 py-3.5 rounded-2xl bt-press"
          style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          <span className="font-semibold text-sm text-[#2e1065]">🤝 {t('nav.trades')}</span>
          <span className="flex items-center gap-2">
            {pendingOffers > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white flex items-center justify-center"
                style={{ background: '#ef4444' }}>
                {pendingOffers}
              </span>
            )}
            <span style={{ color: '#9ca3af' }}>›</span>
          </span>
        </Link>

        {/* Donation section: top donators + donate flow */}
        <DonationCard userName={user.name} />

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

            {/* Suggestions / bug reports */}
            <FeedbackCard />
          </div>
        </div>

        {/* Settings modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(46, 16, 101, 0.4)' }}
            onClick={() => setShowSettings(false)}>
            <div className="w-full max-w-sm rounded-2xl shadow-2xl bt-pop-in flex flex-col overflow-hidden"
              style={{ background: '#ffffff', border: '1px solid #e9d5ff', maxHeight: 'calc(100dvh - 2rem)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
                <p className="text-lg font-bold text-[#2e1065]">⚙️ {t('room2.settings')}</p>
                <button onClick={() => setShowSettings(false)} className="text-[#6b7280] hover:text-[#2e1065] text-xl">✕</button>
              </div>

              <div className="px-6 pb-6 overflow-y-auto">
                <p className="text-xs font-semibold text-[#6b7280] mb-2">{t('room2.notifications')}</p>
                <div className="p-3 rounded-xl mb-4" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                  <PushToggle />
                </div>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-[#4b5563]">{t('room2.language')}</span>
                  <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#faf5ff' }}>
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
                <div className="flex gap-2 mb-3">
                  <Link href="/rules" className="flex-1 py-2 rounded-xl font-semibold text-xs text-center" style={{ background: '#faf5ff', color: '#6b7280', border: '1px solid #e9d5ff' }}>
                    📋 {t('rules.title')}
                  </Link>
                  <Link href="/privacy" className="flex-1 py-2 rounded-xl font-semibold text-xs text-center" style={{ background: '#faf5ff', color: '#6b7280', border: '1px solid #e9d5ff' }}>
                    🔒 {t('priv.title')}
                  </Link>
                </div>
                {user.is_admin && (
                  <Link href="/admin" className="block w-full py-2.5 mb-3 rounded-xl font-semibold text-sm text-center"
                    style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                    {t('room2.admin')}
                  </Link>
                )}
                <button onClick={logout} className="w-full py-2.5 mb-3 rounded-xl font-semibold text-sm" style={{ background: '#fee2e2', color: '#ef4444' }}>
                  {t('room2.signOut')}
                </button>
                <button
                  onClick={() => { setShowSettings(false); setDeleteInput(''); setDeleteError(''); setShowDeleteConfirm(true); }}
                  className="w-full py-2 rounded-xl font-semibold text-xs"
                  style={{ background: '#ffffff', color: '#ef4444', border: '1px solid #fecaca' }}>
                  {t('account.delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete account confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(46, 16, 101, 0.4)' }}
            onClick={() => !deleting && setShowDeleteConfirm(false)}>
            <div className="w-full max-w-sm rounded-2xl shadow-2xl bt-pop-in overflow-hidden"
              style={{ background: '#ffffff', border: '1px solid #fecaca' }}
              onClick={e => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-5">
                <p className="text-lg font-bold mb-2" style={{ color: '#ef4444' }}>⚠️ {t('account.deleteTitle')}</p>
                <p className="text-sm text-[#4b5563] leading-relaxed mb-4">{t('account.deleteBody')}</p>
                <label className="block text-xs font-semibold text-[#6b7280] mb-1.5">
                  {t('account.deleteConfirmLabel', { name: user.name })}
                </label>
                <input
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm mb-3 text-[#2e1065]"
                  style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                {deleteError && <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                    {t('account.deleteCancel')}
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting || deleteInput.trim().toLowerCase() !== user.name.toLowerCase()}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                    style={{ background: '#ef4444' }}>
                    {t('account.deleteConfirmButton')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit profile modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(46, 16, 101, 0.4)' }}
            onClick={() => setEditing(false)}>
            {/* Taller than a phone screen, so the middle scrolls and the title
                and the buttons stay put. It used to be one tall box: on a small
                phone the heading sat above the top of the screen and Save below
                the bottom, with no way to reach either. */}
            <div className="w-full max-w-sm rounded-2xl shadow-2xl bt-pop-in flex flex-col overflow-hidden"
              style={{ background: '#ffffff', border: '1px solid #e9d5ff', maxHeight: 'calc(100dvh - 2rem)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
                <p className="text-lg font-bold text-[#2e1065]">{t('profile2.title')}</p>
                <button onClick={() => setEditing(false)} className="text-[#6b7280] hover:text-[#2e1065] text-xl">✕</button>
              </div>

              <div className="px-6 overflow-y-auto">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ background: form.avatar_color }}>
                  {(form.name.trim()[0] || '?').toUpperCase()}
                </div>
              </div>

              <label className="block text-xs font-semibold text-[#6b7280] mb-1">{t('profile2.name')}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm mb-3 text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }} />

              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#6b7280] mb-1">{t('reg.grade')}</label>
                  <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                    <option value="">{t('reg.selectGrade')}</option>
                    {['1', '2', '3', '4', '5', '6'].map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#6b7280] mb-1">{t('reg.class')}</label>
                  <select value={form.class_no} onChange={e => setForm(f => ({ ...f, class_no: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                    <option value="">{t('reg.selectClass')}</option>
                    {Array.from({ length: 16 }, (_, i) => String(i + 1)).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <label className="block text-xs font-semibold text-[#6b7280] mb-1">{t('reg.contact')}</label>
              <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                maxLength={100} placeholder={t('reg.contactHint')}
                className="w-full px-3 py-2 rounded-xl text-sm mb-3 text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }} />

              <label className="block text-xs font-semibold text-[#6b7280] mb-1">{t('profile2.newPassword')}</label>
              <input type="password" value={form.new_password} minLength={6} autoComplete="new-password"
                onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm mb-3 text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }} />

              <label className="block text-xs font-semibold text-[#6b7280] mb-2">{t('reg.availabilityTitle')}</label>
              <div className="mb-4">
                <AvailabilityGrid value={availability} onChange={setAvailability} />
              </div>

              <label className="block text-xs font-semibold text-[#6b7280] mb-2">{t('profile2.avatarColor')}</label>
              {/* Eight of them: a row of four twice on a phone, rather than
                  seven and a stray one wrapped underneath. */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 justify-items-center mb-4">
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, avatar_color: c }))}
                    className="w-8 h-8 rounded-full transition-transform"
                    style={{ background: c, transform: form.avatar_color === c ? 'scale(1.15)' : 'scale(1)', boxShadow: form.avatar_color === c ? '0 0 0 3px #ffffff, 0 0 0 5px ' + c : 'none' }} />
                ))}
              </div>

              </div>

              <div className="px-6 pt-3 pb-6 flex-shrink-0" style={{ borderTop: '1px solid #f3e8ff' }}>
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
          </div>
        )}
      </main>
    </>
  );
}
