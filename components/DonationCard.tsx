'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

// Instagram of the site — shown in the over-฿100 note. Update when the real
// account is created.
const IG_HANDLE = '@booktrade.ig';

interface TopDonator { user_id: number; name: string; avatar_color: string; total: number; }

// Room-page donation section: top donators + a donate flow.
// Stages: form (name + amount) → qr (scan to transfer) → thanks (shown when
// the student returns to this tab after going to their banking app).
export default function DonationCard({ userName }: { userName: string }) {
  const { t } = useI18n();
  const [top, setTop] = useState<TopDonator[]>([]);
  const [stage, setStage] = useState<'closed' | 'form' | 'qr' | 'thanks'>('closed');
  const [bankName, setBankName] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const leftTabRef = useRef(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/donations');
    if (r.ok) setTop((await r.json()).top ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // While the QR is showing: if the student switches away (to their banking
  // app) and comes back, show the thank-you.
  useEffect(() => {
    if (stage !== 'qr') return;
    function onVis() {
      if (document.visibilityState === 'hidden') leftTabRef.current = true;
      else if (leftTabRef.current) { setStage('thanks'); load(); }
    }
    leftTabRef.current = false;
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stage, load]);

  async function confirm() {
    const amt = Number(amount);
    if (!bankName.trim() || !isFinite(amt) || amt <= 0 || busy) return;
    setBusy(true);
    const res = await fetch('/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank_name: bankName.trim(), amount: amt }),
    });
    setBusy(false);
    if (res.ok) setStage('qr');
  }

  function closeAll() {
    setStage('closed');
    setBankName('');
    setAmount('');
  }

  const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

  return (
    <>
      <div className="p-5 rounded-2xl mb-6" style={{ background: 'linear-gradient(135deg, #ffffff, #f5f3ff)', border: '1px solid #ddd6fe' }}>
        <h2 className="font-bold text-[#2e1065] mb-3">{t('don.title')}</h2>
        {top.length === 0 ? (
          <p className="text-sm text-[#6b7280] mb-4">{t('don.none')}</p>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {top.map((d, i) => (
              <div key={d.user_id} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: i === 0 ? '#fef9c3' : '#ffffff', border: '1px solid #f3e8ff' }}>
                <span className="w-6 text-center text-sm font-bold flex-shrink-0">{medals[i] ?? `${i + 1}.`}</span>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: d.avatar_color }}>
                  {d.name[0].toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-[#2e1065] flex-1 truncate">{d.name}</span>
                <span className="text-sm font-bold flex-shrink-0" style={{ color: '#7c3aed' }}>฿{Number(d.total)}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setStage('form')}
          className="w-full py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
          {t('don.button')}
        </button>
      </div>

      {stage !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(46,16,101,0.45)' }}
          onClick={closeAll}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}
            onClick={e => e.stopPropagation()}>

            {stage === 'form' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-lg font-bold text-[#2e1065]">💜 {t('don.modalTitle')}</p>
                  <button onClick={closeAll} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6b7280] text-xl" style={{ background: '#f3f4f6' }}>✕</button>
                </div>
                <label className="block text-xs font-semibold text-[#6b7280] mb-1">{t('don.bankName')}</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)} maxLength={100}
                  placeholder={t('don.bankNamePlaceholder')}
                  className="w-full px-3 py-2 rounded-xl text-sm mb-3 text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff', outline: 'none' }} />
                <label className="block text-xs font-semibold text-[#6b7280] mb-1">{t('don.amount')}</label>
                <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="20"
                  className="w-full px-3 py-2 rounded-xl text-sm mb-3 text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff', outline: 'none' }} />
                <p className="text-xs mb-4 p-3 rounded-xl" style={{ background: '#fef9c3', color: '#b45309', border: '1px solid #fde68a' }}>
                  {t('don.igNote', { ig: IG_HANDLE })}
                </p>
                <button onClick={confirm} disabled={busy || !bankName.trim() || !(Number(amount) > 0)}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                  {t('don.confirm')}
                </button>
              </>
            )}

            {stage === 'qr' && (
              <>
                <p className="text-base font-bold text-[#2e1065] text-center mb-3">{t('don.scanTitle', { amount })}</p>
                <div className="rounded-2xl overflow-hidden mb-3" style={{ border: '1px solid #e9d5ff' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/donate-qr.jpg" alt="PromptPay QR" className="w-full h-auto" />
                </div>
                <p className="text-xs text-[#6b7280] text-center mb-3">{t('don.scanHint', { name: bankName })}</p>
                <button onClick={() => setStage('thanks')} className="w-full py-2 rounded-xl font-semibold text-sm" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                  {t('don.close')}
                </button>
              </>
            )}

            {stage === 'thanks' && (
              <div className="text-center">
                <div className="text-5xl mb-3">💜</div>
                <p className="text-lg font-bold text-[#2e1065] mb-2">{t('don.thanksTitle')}</p>
                <p className="text-sm text-[#6b7280] mb-4">{t('don.thanksBody', { name: userName, amount })}</p>
                <button onClick={closeAll} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                  {t('don.close')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
