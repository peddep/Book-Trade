'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user: sessionUser, setUser, refresh } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Already signed in: signing in again as someone else would swap the session
  // out from under them with no warning. Send them to the app instead.
  useEffect(() => {
    if (sessionUser) router.replace('/trade');
  }, [router, sessionUser]);

  // The Google flow is a full-page redirect, not a fetch, so a failure has
  // nowhere to report itself except a query param on the page it sends the
  // student back to.
  useEffect(() => {
    const err = searchParams.get('error');
    if (!err) return;
    const msg = err === 'google_not_configured' ? t('login.googleNotConfigured')
      : err === 'google_unverified' ? t('login.googleUnverified')
      : err === 'google_domain' ? t('login.googleDomain', { domain: searchParams.get('domain') ?? '' })
      : err === 'banned' ? t('login.banned')
      : t('login.googleFailed');
    setError(msg);
    // router.replace() leaves the query string in place on a statically
    // optimized page like this one — there's no server data tied to it for
    // Next to re-fetch, so it skips updating the address bar. Dropping to
    // the browser's own history API strips it reliably either way, and nothing
    // here depends on Next's router noticing the change.
    window.history.replaceState(null, '', '/login');
  }, [searchParams, router, t]);

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
        // Hand the new session straight to the provider. Without this the app
        // still believes nobody is signed in, /trade bounces back to the front
        // page, and the student has to reload before the site will let them in.
        setUser(data.user ?? null);
        if (!data.user) await refresh();
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

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px" style={{ background: '#e9d5ff' }} />
              <span className="text-xs text-[#9ca3af]">{t('auth.orDivider')}</span>
              <div className="flex-1 h-px" style={{ background: '#e9d5ff' }} />
            </div>
            <GoogleSignInButton label={t('auth.googleSignIn')} />
          </form>
        </div>
      </main>
    </>
  );
}
