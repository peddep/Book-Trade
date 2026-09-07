'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function DonatePage() {
  const { t } = useI18n();

  return (
    <>
      <main className="max-w-md mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-heading)]">{t('hub.back')}</Link>

        <div className="text-center mt-4 mb-6">
          <div className="text-5xl mb-3">💜</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-heading)]">{t('donate.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{t('donate.subtitle')}</p>
        </div>

        <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(124,58,237,0.15)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/donate-qr.jpg" alt="PromptPay QR" className="w-full h-auto" />
        </div>

        <p className="text-xs text-[var(--text-muted)] text-center mt-4 leading-relaxed">{t('donate.hint')}</p>
        <p className="text-sm font-semibold text-center mt-2" style={{ color: '#986D8E' }}>{t('donate.thanks')}</p>
      </main>
    </>
  );
}
