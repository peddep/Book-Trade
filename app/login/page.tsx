'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

export default function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push('/trade');
        return;
      }
      const msg = data.error === 'banned' ? t('login.banned')
        : data.error === 'Invalid credentials' ? t('login.invalid')
        : t('login.failed', { status: res.status });
      setError(msg);
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
            <h1 className="text-2xl font-bold text-[#2e1065]">{t('login.welcome')}</h1>
            <p className="text-[#6b7280] text-sm mt-1">{t('login.subtitle')}</p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4 p-6 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
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
                className="w-full p-2.5 rounded-xl text-sm"
                style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
            <p className="text-center text-sm text-[#6b7280]">
              {t('login.noAccount')}{' '}
              <Link href="/register" className="text-purple-400 hover:text-purple-300 font-semibold">
                {t('login.joinLink')}
              </Link>
            </p>
            <p className="text-center text-xs text-[#9ca3af]">{t('login.forgot')}</p>
          </form>
        </div>
      </main>
    </>
  );
}
