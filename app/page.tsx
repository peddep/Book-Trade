'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

export default function Home() {
  const { t } = useI18n();

  const steps = [
    { icon: '📝', title: t('home.step1Title'), desc: t('home.step1Desc') },
    { icon: '🔍', title: t('home.step2Title'), desc: t('home.step2Desc') },
    { icon: '🤝', title: t('home.step3Title'), desc: t('home.step3Desc') },
  ];

  const conditions = [
    { key: 'Like New', color: '#10b981' },
    { key: 'Good', color: '#3b82f6' },
    { key: 'Fair', color: '#f59e0b' },
    { key: 'Poor', color: '#ef4444' },
  ];

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #faf5ff 100%)' }}>
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #c4b5fd 0%, transparent 50%), radial-gradient(circle at 80% 20%, #ddd6fe 0%, transparent 50%)' }}
          />
          <div className="max-w-4xl mx-auto px-4 py-24 text-center relative z-10">
            <div className="text-7xl mb-6">📚</div>
            <h1 className="text-5xl font-bold text-[#2e1065] mb-4 leading-tight">
              {t('home.title1')}<br />
              <span style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t('home.title2')}
              </span>
            </h1>
            <p className="text-lg text-[#6b7280] mb-10 max-w-xl mx-auto">
              {t('home.subtitle')}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/register"
                className="px-8 py-3 rounded-xl font-bold text-white text-lg"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                {t('home.startTrading')}
              </Link>
              <Link
                href="/login"
                className="px-8 py-3 rounded-xl font-bold text-[#4b5563] text-lg"
                style={{ background: '#e9d5ff' }}
              >
                {t('nav.signIn')}
              </Link>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="max-w-5xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center text-[#2e1065] mb-12">{t('home.howItWorks')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="text-center p-6 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="font-bold text-[#2e1065] text-lg mb-2">{step.title}</h3>
                <p className="text-[#6b7280] text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Conditions legend */}
        <div className="max-w-5xl mx-auto px-4 pb-20">
          <div className="rounded-2xl p-6" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
            <h3 className="font-bold text-[#2e1065] mb-4">{t('home.conditionGuide')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {conditions.map(c => (
                <div key={c.key} className="flex items-start gap-2">
                  <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ background: c.color }} />
                  <div>
                    <p className="text-sm font-semibold text-[#2e1065]">{t(`cond.${c.key}`)}</p>
                    <p className="text-xs text-[#6b7280]">{t(`cond.${c.key}.desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
