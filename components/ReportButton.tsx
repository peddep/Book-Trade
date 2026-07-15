'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface Props {
  targetType: 'book' | 'user';
  targetId: number;
  // 'icon' = small flag button (on cards); 'text' = a text link (on profiles).
  variant?: 'icon' | 'text';
}

// Lets a student report a book listing or a user. Opens a small reason prompt.
export default function ReportButton({ targetType, targetId, variant = 'icon' }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);

  async function submit() {
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
    });
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); setReason(''); }, 1500);
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          title={t('report.button')}
          aria-label={t('report.button')}
          className="text-xs text-[#9ca3af] hover:text-[#ef4444]"
        >
          ⚑
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-[#9ca3af] hover:text-[#ef4444]">
          ⚑ {t('report.button')}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(46,16,101,0.4)' }}
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm p-5 rounded-2xl shadow-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}
            onClick={e => e.stopPropagation()}>
            {sent ? (
              <p className="text-center text-sm font-semibold py-4" style={{ color: '#10b981' }}>✓ {t('report.thanks')}</p>
            ) : (
              <>
                <p className="text-base font-bold text-[#2e1065] mb-1">{t('report.title')}</p>
                <p className="text-xs text-[#6b7280] mb-3">{t('report.hint')}</p>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500}
                  placeholder={t('report.placeholder')}
                  className="w-full p-2.5 rounded-xl text-sm mb-3 text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff', outline: 'none' }} />
                <div className="flex gap-2">
                  <button onClick={() => setOpen(false)} className="flex-1 py-2 rounded-xl font-semibold text-sm" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                    {t('report.cancel')}
                  </button>
                  <button onClick={submit} className="flex-1 py-2 rounded-xl font-semibold text-sm text-white" style={{ background: '#ef4444' }}>
                    {t('report.send')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
