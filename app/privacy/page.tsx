'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

export default function PrivacyPage() {
  const { t } = useI18n();
  const router = useRouter();
  const sections = ['collect', 'use', 'share', 'processors', 'safety', 'keep', 'rights', 'changes'] as const;

  return (
    <>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-heading)]">{t('hub.back')}</button>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-heading)] mt-2 mb-1">🔒 {t('priv.title')}</h1>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t('priv.updated')}</p>
        <p className="text-sm text-[var(--text-mid)] leading-relaxed mb-6">{t('priv.intro')}</p>

        <div className="flex flex-col gap-4">
          {sections.map(s => (
            <div key={s} className="p-4 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h2 className="font-bold text-[var(--text-heading)] mb-1">{t(`priv.${s}Title`)}</h2>
              <p className="text-sm text-[var(--text-mid)] leading-relaxed">{t(`priv.${s}Body`)}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-6">{t('priv.contact')}</p>
      </main>
    </>
  );
}
