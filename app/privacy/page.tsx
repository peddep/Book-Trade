'use client';

import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';

export default function PrivacyPage() {
  const { t } = useI18n();
  const router = useRouter();
  const sections = ['collect', 'use', 'share', 'safety', 'keep', 'rights'] as const;

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</button>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065] mt-2 mb-1">🔒 {t('priv.title')}</h1>
        <p className="text-sm text-[#6b7280] mb-6">{t('priv.intro')}</p>

        <div className="flex flex-col gap-4">
          {sections.map(s => (
            <div key={s} className="p-4 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
              <h2 className="font-bold text-[#2e1065] mb-1">{t(`priv.${s}Title`)}</h2>
              <p className="text-sm text-[#4b5563] leading-relaxed">{t(`priv.${s}Body`)}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#9ca3af] mt-6">{t('priv.contact')}</p>
      </main>
    </>
  );
}
