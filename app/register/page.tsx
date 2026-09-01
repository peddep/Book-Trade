'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import AvailabilityGrid from '@/components/AvailabilityGrid';

const DRAFT_KEY = 'register-draft';

const GRADES = ['1', '2', '3', '4', '5', '6'];
const CLASSES = Array.from({ length: 16 }, (_, i) => String(i + 1));

export default function RegisterPage() {
  const { t, gradeLabel } = useI18n();
  const [name, setName] = useState('');
  const [realName, setRealName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [classNo, setClassNo] = useState('');
  const [contact, setContact] = useState('');
  const [availability, setAvailability] = useState<string[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user: sessionUser, setUser, refresh } = useSession();
  const router = useRouter();
  const firstSave = useRef(true);

  // Already signed in: registering again would create a second account and
  // swap the session to it, leaving this student's books on the first one.
  useEffect(() => {
    if (sessionUser) router.replace('/trade');
  }, [router, sessionUser]);

  // Restore a saved draft (e.g. after visiting the Rules / Privacy pages).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setName(d.name ?? ''); setRealName(d.realName ?? ''); setEmail(d.email ?? '');
        setPassword(d.password ?? ''); setConfirmPassword(d.confirmPassword ?? '');
        setGrade(d.grade ?? ''); setClassNo(d.classNo ?? ''); setContact(d.contact ?? '');
        setAvailability(Array.isArray(d.availability) ? d.availability : []);
        setAcceptTerms(d.acceptTerms === true);
      }
    } catch { /* ignore corrupt draft */ }
  }, []);

  // Keep the draft in sync so the info survives navigating away and back.
  // Skip the very first run (initial empty mount) so it never clobbers a saved
  // draft before the restore above has applied.
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ name, realName, email, password, confirmPassword, grade, classNo, contact, availability, acceptTerms }));
    } catch { /* storage full / unavailable */ }
  }, [name, realName, email, password, confirmPassword, grade, classNo, contact, availability, acceptTerms]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('reg.passwordMismatch'));
      return;
    }
    if (availability.length === 0) {
      setError(t('reg.availabilityRequired'));
      return;
    }
    if (!acceptTerms) {
      setError(t('reg.termsRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, grade, class_no: classNo, contact, real_name: realName, availability, accept_terms: acceptTerms }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        // The account exists and the cookie is set, but the app only learns
        // that if we tell it — otherwise the new student lands back on the
        // front page as though nothing happened.
        setUser(data.user ?? null);
        if (!data.user) await refresh();
        router.push('/trade');
        return;
      }
      setError(
        data.error === 'terms_required' ? t('reg.termsRequired')
        : data.error === 'missing_fields' ? t('reg.missingFields')
        : data.error === 'email_taken' ? t('reg.emailTaken')
        : data.error === 'name_taken' ? t('reg.nameTaken')
        : data.error === 'email_domain' ? t('reg.emailDomain', { domain: data.domain })
        : data.error === 'rate_limited' ? t('err.rateLimited')
        : (data.error ?? t('reg.failed', { status: res.status }))
      );
    } catch {
      setError(t('common.unreachable'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">📚</div>
            <h1 className="text-2xl font-bold text-[#2e1065]">{t('reg.join')}</h1>
            <p className="text-[#6b7280] text-sm mt-1">{t('reg.subtitle')}</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4 p-6 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.yourName')}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder="bookworm123"
              />
            </div>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.realName')}</label>
              <input
                type="text"
                value={realName}
                onChange={e => setRealName(e.target.value)}
                required
                maxLength={120}
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder={t('reg.realNamePlaceholder')}
              />
            </div>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder="XXXXX.somchai@student.nssc.ac.th"
              />
            </div>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder={t('reg.passwordHint')}
              />
            </div>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.confirmPassword')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: `1px solid ${confirmPassword && confirmPassword !== password ? '#ef4444' : '#e9d5ff'}`, color: '#2e1065', outline: 'none' }}
                placeholder={t('reg.confirmPasswordHint')}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{t('reg.passwordMismatch')}</p>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.grade')}</label>
                <select
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: grade ? '#2e1065' : '#9ca3af', outline: 'none' }}
                >
                  <option value="">{t('reg.selectGrade')}</option>
                  {GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.class')}</label>
                <select
                  value={classNo}
                  onChange={e => setClassNo(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: classNo ? '#2e1065' : '#9ca3af', outline: 'none' }}
                >
                  <option value="">{t('reg.selectClass')}</option>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.contact')}</label>
              <input
                type="text"
                value={contact}
                onChange={e => setContact(e.target.value)}
                required
                maxLength={100}
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder={t('reg.contactHint')}
              />
            </div>
            {/* Where trades happen + weekly availability */}
            <div className="p-3 rounded-xl" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
              <p className="text-sm font-bold text-[#2e1065] mb-1">{t('reg.libraryTitle')}</p>
              <p className="text-xs text-[#6b7280] leading-relaxed">{t('reg.libraryBody')}</p>
            </div>

            <div>
              <label className="text-sm text-[#4b5563] mb-1 block">{t('reg.availabilityTitle')}</label>
              <p className="text-xs text-[#9ca3af] mb-2">{t('reg.availabilityHint')}</p>
              <AvailabilityGrid value={availability} onChange={setAvailability} />

            </div>

            {/* Agreement. A ticked box the student has to reach for, rather
                than fine print under the button they have already pressed. */}
            <label className="flex gap-2.5 items-start p-3 rounded-xl cursor-pointer"
              style={{ background: '#faf5ff', border: `1px solid ${error === t('reg.termsRequired') ? '#ef4444' : '#e9d5ff'}` }}>
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={e => setAcceptTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#7c3aed]"
              />
              <span className="text-xs text-[#4b5563] leading-relaxed">
                {t('reg.agreeRead')}{' '}
                <Link href="/rules" className="underline font-semibold text-[#7c3aed]">{t('rules.title')}</Link>
                {' '}{t('reg.agreeAnd')}{' '}
                <Link href="/privacy" className="underline font-semibold text-[#7c3aed]">{t('priv.title')}</Link>
              </span>
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !acceptTerms}
              className="w-full py-2.5 rounded-xl font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {loading ? t('reg.creating') : t('reg.createAccount')}
            </button>
            <p className="text-center text-sm text-[#6b7280]">
              {t('reg.haveAccount')}{' '}
              <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold">
                {t('login.signIn')}
              </Link>
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
