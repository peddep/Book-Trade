'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

export default function RulesPage() {
  const { t } = useI18n();
  const CONDITIONS = ['Like New', 'Good', 'Fair', 'Poor'] as const;
  const rules = ['meet', 'noCash', 'noSchoolBooks', 'honest', 'decline', 'respect', 'report'] as const;

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065] mt-2 mb-1">📋 {t('rules.title')}</h1>
        <p className="text-sm text-[#6b7280] mb-6">{t('rules.intro')}</p>

        {/* The rules */}
        <ol className="flex flex-col gap-3 mb-8">
          {rules.map((r, i) => (
            <li key={r} className="flex gap-3 p-4 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: '#7c3aed' }}>{i + 1}</span>
              <div>
                <p className="font-semibold text-[#2e1065]">{t(`rules.${r}Title`)}</p>
                <p className="text-sm text-[#4b5563] leading-relaxed mt-0.5">{t(`rules.${r}Body`)}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Condition scale */}
        <h2 className="font-bold text-[#2e1065] mb-3">{t('rules.conditionTitle')}</h2>
        <div className="flex flex-col gap-2">
          {CONDITIONS.map(c => (
            <div key={c} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
              <span className="text-sm font-bold text-[#7c3aed] w-24 flex-shrink-0">{t(`cond.${c}`)}</span>
              <span className="text-sm text-[#4b5563]">{t(`cond.${c}.desc`)}</span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
