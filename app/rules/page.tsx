'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

export default function RulesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const CONDITIONS = ['Like New', 'Good', 'Fair', 'Poor'] as const;
  // Ordered as a set of terms reads: who may use it, their obligations, then
  // what happens when they are broken.
  const rules = [
    'eligibility', 'account', 'meet', 'noCash', 'noSchoolBooks', 'honest',
    'decline', 'respect', 'prohibited', 'report', 'enforcement', 'liability', 'changes',
  ] as const;

  return (
    <>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-sm text-[#6b7280] hover:text-[#3D2A39]">{t('hub.back')}</button>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#3D2A39] mt-2 mb-1">📋 {t('rules.title')}</h1>
        <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>{t('rules.updated')}</p>
        <p className="text-sm text-[#4b5563] leading-relaxed mb-6">{t('rules.intro')}</p>

        {/* The rules */}
        <ol className="flex flex-col gap-3 mb-8">
          {rules.map((r, i) => (
            <li key={r} className="flex gap-3 p-4 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #D9CAB3' }}>
              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: '#986D8E' }}>{i + 1}</span>
              <div>
                <p className="font-semibold text-[#3D2A39]">{t(`rules.${r}Title`)}</p>
                <p className="text-sm text-[#4b5563] leading-relaxed mt-0.5">{t(`rules.${r}Body`)}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Condition scale */}
        <h2 className="font-bold text-[#3D2A39] mb-3">{t('rules.conditionTitle')}</h2>
        <div className="flex flex-col gap-2">
          {CONDITIONS.map(c => (
            <div key={c} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#EFE3D0', border: '1px solid #D9CAB3' }}>
              <span className="text-sm font-bold text-[#986D8E] w-24 flex-shrink-0">{t(`cond.${c}`)}</span>
              <span className="text-sm text-[#4b5563]">{t(`cond.${c}.desc`)}</span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
