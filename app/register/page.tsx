'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

const GRADES = ['6', '7', '8', '9', '10', '11', '12'];

export default function RegisterPage() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, grade }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push('/trade');
        return;
      }
      setError(data.error ?? t('reg.failed', { status: res.status }));
    } catch {
      setError(t('common.unreachable'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
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
                placeholder="Alex Johnson"
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
                placeholder="your@school.edu"
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
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('reg.gradeOptional')}</label>
              <select
                value={grade}
                onChange={e => setGrade(e.target.value)}
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: grade ? '#2e1065' : '#9ca3af', outline: 'none' }}
              >
                <option value="">{t('reg.selectGrade')}</option>
                {GRADES.map(g => <option key={g} value={g}>{t('common.grade')} {g}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
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
