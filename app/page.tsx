'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

// Same purple-and-white palette as the rest of the site.
const PAPER = '#faf5ff';
const SURFACE = '#ffffff';
const INK = '#2e1065';
const MUTED = '#6b7280';
const RULE = '#e9d5ff';
const ACCENT = '#7c3aed';
const BAND = '#f3e8ff';

const serif = { fontFamily: 'var(--font-serif), Georgia, serif' } as const;

// Decorative shelf. Deliberately not real listings — the front page shows
// totals only, so these are just spines, not anyone's books.
const SPINES = [
  { h: 96, c: '#7c3aed' }, { h: 112, c: '#6366f1' }, { h: 88, c: '#a78bfa' },
  { h: 120, c: '#5b21b6' }, { h: 100, c: '#8b5cf6' }, { h: 108, c: '#818cf8' },
  { h: 92, c: '#c084fc' }, { h: 116, c: '#7c3aed' }, { h: 96, c: '#6d28d9' },
];

function Stat({ n, label }: { n: number | null; label: string }) {
  return (
    <div className="text-center px-2">
      <p className="text-3xl sm:text-4xl font-bold tabular-nums" style={{ ...serif, color: INK }}>
        {n === null ? '·' : n.toLocaleString()}
      </p>
      <p className="text-xs sm:text-sm mt-1" style={{ color: MUTED }}>{label}</p>
    </div>
  );
}

export default function Home() {
  const { t } = useI18n();
  const [stats, setStats] = useState<{ books: number; trades: number; students: number } | null>(null);
  // null = still checking. Signed-in students must not be shown sign-up or
  // sign-in buttons: following either one silently replaces their session, and
  // registering again would strand their books on the old account.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/stats').then(r => (r.ok ? r.json() : null)).then(setStats).catch(() => {});
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : { user: null }))
      .then(d => setSignedIn(Boolean(d.user)))
      .catch(() => setSignedIn(false));
  }, []);

  const steps = [
    { icon: '📖', title: t('home.step1Title'), desc: t('home.step1Desc') },
    { icon: '🔍', title: t('home.step2Title'), desc: t('home.step2Desc') },
    { icon: '🤝', title: t('home.step3Title'), desc: t('home.step3Desc') },
  ];

  const features = [
    { icon: '📷', title: t('home.f1Title'), desc: t('home.f1Desc') },
    { icon: '✨', title: t('home.f2Title'), desc: t('home.f2Desc') },
    { icon: '⚖️', title: t('home.f3Title'), desc: t('home.f3Desc') },
  ];

  const conditions = [
    // Same colours BookCard uses, so a condition means the same thing everywhere.
    { key: 'Like New', color: '#10b981' },
    { key: 'Good', color: '#3b82f6' },
    { key: 'Fair', color: '#f59e0b' },
    { key: 'Poor', color: '#ef4444' },
  ];

  // Reserve the row's height while the session check is in flight, so the page
  // doesn't jump once we know which pair of buttons belongs here.
  const cta = signedIn === null ? (
    <div className="h-[50px]" />
  ) : signedIn ? (
    <div className="flex gap-3 justify-center flex-wrap">
      <Link href="/trade" className="px-7 py-3 rounded-xl font-bold text-white text-base shadow-sm"
        style={{ background: 'linear-gradient(135deg, #5b21b6, #7c3aed)' }}>
        {t('home.continueTrading')}
      </Link>
      <Link href="/profile" className="px-7 py-3 rounded-xl font-bold text-base"
        style={{ background: SURFACE, color: INK, border: `1px solid ${RULE}` }}>
        {t('tabs.books')}
      </Link>
    </div>
  ) : (
    <div className="flex gap-3 justify-center flex-wrap">
      <Link href="/register" className="px-7 py-3 rounded-xl font-bold text-white text-base shadow-sm"
        style={{ background: 'linear-gradient(135deg, #5b21b6, #7c3aed)' }}>
        {t('home.startTrading')}
      </Link>
      <Link href="/login" className="px-7 py-3 rounded-xl font-bold text-base"
        style={{ background: SURFACE, color: INK, border: `1px solid ${RULE}` }}>
        {t('nav.signIn')}
      </Link>
    </div>
  );

  return (
    <>
      <Navbar />
      <main style={{ background: PAPER, color: INK }}>
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Soft wash behind the hero, drawn rather than loaded as an image */}
          <div className="absolute inset-0 pointer-events-none opacity-40" style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, #ddd6fe 0%, transparent 45%), radial-gradient(circle at 85% 10%, #ede9fe 0%, transparent 40%)',
          }} />
          <div className="max-w-3xl mx-auto px-4 pt-16 pb-12 text-center relative z-10">
            <h1 className="text-4xl sm:text-5xl font-bold leading-[1.25] mb-5" style={serif}>
              {t('home.title1')}{' '}
              <span style={{ color: ACCENT }}>{t('home.title2')}</span>
            </h1>
            <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl mx-auto" style={{ color: MUTED }}>
              {t('home.subtitle')}
            </p>
            {cta}
            {signedIn === false && (
              <p className="text-xs mt-4" style={{ color: MUTED }}>{t('home.ctaNote')}</p>
            )}
          </div>

          {/* Bookshelf */}
          <div className="max-w-3xl mx-auto px-4 relative z-10">
            <div className="flex items-end justify-center gap-[3px] sm:gap-1.5">
              {SPINES.map((s, i) => (
                <div key={i} className="rounded-t-sm flex-1 max-w-[26px]"
                  style={{
                    height: s.h, background: s.c,
                    boxShadow: 'inset -3px 0 0 rgba(0,0,0,0.18), inset 3px 0 0 rgba(255,255,255,0.12)',
                  }} />
              ))}
            </div>
            <div className="h-2 rounded-sm" style={{ background: '#6d28d9', boxShadow: '0 3px 6px rgba(46,16,101,0.18)' }} />
          </div>
        </section>

        {/* Live totals — counts only, never anyone's listings */}
        <section className="max-w-3xl mx-auto px-4 py-12">
          <div className="rounded-2xl py-6 px-4 grid grid-cols-3 divide-x"
            style={{ background: SURFACE, border: `1px solid ${RULE}`, borderColor: RULE }}>
            <Stat n={stats?.books ?? null} label={t('home.statBooks')} />
            <Stat n={stats?.trades ?? null} label={t('home.statTrades')} />
            <Stat n={stats?.students ?? null} label={t('home.statStudents')} />
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-4xl mx-auto px-4 pb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2" style={serif}>{t('home.howItWorks')}</h2>
          <p className="text-sm text-center mb-10" style={{ color: MUTED }}>{t('home.howItWorksSub')}</p>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map((step, i) => (
              <li key={i} className="relative p-6 rounded-2xl" style={{ background: SURFACE, border: `1px solid ${RULE}` }}>
                <span className="absolute top-4 right-5 text-3xl font-bold opacity-25" style={{ ...serif, color: ACCENT }}>
                  {i + 1}
                </span>
                <div className="text-3xl mb-3">{step.icon}</div>
                <h3 className="font-bold text-lg mb-1.5" style={serif}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* What you get */}
        <section className="py-14" style={{ background: BAND, borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10" style={serif}>{t('home.why')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {features.map((f, i) => (
                <div key={i} className="p-5 rounded-2xl" style={{ background: SURFACE, border: `1px solid ${RULE}` }}>
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <h3 className="font-bold mb-1.5" style={serif}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Condition guide */}
        <section className="max-w-4xl mx-auto px-4 py-14">
          <h2 className="text-xl font-bold mb-1" style={serif}>{t('home.conditionGuide')}</h2>
          <p className="text-sm mb-6" style={{ color: MUTED }}>{t('home.conditionSub')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {conditions.map(c => (
              <div key={c.key} className="p-4 rounded-xl" style={{ background: SURFACE, border: `1px solid ${RULE}` }}>
                <div className="w-8 h-1.5 rounded-full mb-2.5" style={{ background: c.color }} />
                <p className="text-sm font-bold" style={{ color: INK }}>{t(`cond.${c.key}`)}</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{t(`cond.${c.key}.desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="px-4 pb-20">
          <div className="max-w-2xl mx-auto text-center p-10 rounded-3xl"
            style={{ background: SURFACE, border: `1px solid ${RULE}` }}>
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={serif}>{t('home.finalTitle')}</h2>
            <p className="text-sm mb-7 leading-relaxed" style={{ color: MUTED }}>{t('home.finalDesc')}</p>
            {cta}
          </div>
          <div className="max-w-2xl mx-auto mt-8 flex justify-center gap-6 text-xs" style={{ color: MUTED }}>
            <Link href="/rules" className="hover:underline">{t('home.linkRules')}</Link>
            <Link href="/privacy" className="hover:underline">{t('home.linkPrivacy')}</Link>
          </div>
        </section>
      </main>
    </>
  );
}
