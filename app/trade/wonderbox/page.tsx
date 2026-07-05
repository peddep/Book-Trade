'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import BookPicker from '@/components/BookPicker';
import BookThumb from '@/components/BookThumb';
import { useI18n } from '@/lib/i18n';

interface Deposit {
  id: number;
  status: string;
  my_title: string;
  my_color: string;
  my_cover_url?: string | null;
  received_title?: string;
  received_color?: string;
  received_cover_url?: string | null;
  received_from?: string;
}

export default function WonderBoxPage() {
  const { t } = useI18n();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [slots, setSlots] = useState(10);
  const [showPicker, setShowPicker] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [receivedMsg, setReceivedMsg] = useState<Deposit[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/wonderbox');
    if (res.ok) {
      const d = await res.json();
      setDeposits(d.deposits ?? []);
      setSlots(d.slots ?? 10);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deposit() {
    if (!picked) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/wonderbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: picked }),
    });
    const d = await res.json();
    if (res.ok) {
      setDeposits(d.deposits ?? []);
      setShowPicker(false);
      setPicked(null);
    } else {
      setError(d.error === 'box_full' ? t('wb.full', { total: slots }) : t('hub.noFreeBooks'));
    }
    setBusy(false);
  }

  async function withdraw(id: number) {
    await fetch(`/api/wonderbox?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function receiveAll() {
    setBusy(true);
    const res = await fetch('/api/wonderbox', { method: 'PATCH' });
    if (res.ok) {
      const d = await res.json();
      setReceivedMsg(d.received ?? []);
      setDeposits(d.deposits ?? []);
    }
    setBusy(false);
  }

  const matchedCount = deposits.filter(d => d.status === 'matched').length;
  const used = deposits.length;

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-slate-400 hover:text-white">{t('hub.back')}</Link>
        <div className="flex items-center justify-between mt-2 mb-1">
          <h1 className="text-3xl font-bold text-white">✨ {t('hub.wonderbox')}</h1>
          <span className="text-sm font-semibold" style={{ color: '#a78bfa' }}>{t('wb.slots', { used, total: slots })}</span>
        </div>
        <p className="text-sm text-slate-400 mb-6">{t('wb.desc')}</p>

        {receivedMsg.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl" style={{ background: '#0d2b1a', border: '1px solid #10b981' }}>
            <p className="font-bold mb-2" style={{ color: '#10b981' }}>🎉 {t('wb.youGot')}</p>
            {receivedMsg.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-1.5">
                <BookThumb coverUrl={r.received_cover_url} coverColor={r.received_color ?? '#2d2d4a'} />
                <div>
                  <p className="text-sm font-semibold text-white">{r.received_title}</p>
                  {r.received_from && <p className="text-xs text-slate-400">{t('wb.from', { name: r.received_from })}</p>}
                </div>
              </div>
            ))}
            <p className="text-xs mt-2" style={{ color: '#6ee7b7' }}>{t('wb.meetHint')}</p>
          </div>
        )}

        {/* Slots grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {Array.from({ length: slots }).map((_, i) => {
            const d = deposits[i];
            if (!d) {
              return (
                <div key={i} className="aspect-square rounded-2xl flex items-center justify-center"
                  style={{ background: '#12122a', border: '2px dashed #2d2d4a' }}>
                  <span className="text-2xl opacity-30">＋</span>
                </div>
              );
            }
            const matched = d.status === 'matched';
            return (
              <div key={d.id} className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 p-2 relative"
                style={{ background: matched ? '#2d1e5a' : '#1a1a2e', border: `1px solid ${matched ? '#8b5cf6' : '#2d2d4a'}` }}>
                {matched ? <span className="text-3xl">🎁</span> : <BookThumb coverUrl={d.my_cover_url} coverColor={d.my_color} size={44} />}
                <p className="text-[11px] text-center leading-tight line-clamp-2" style={{ color: matched ? '#c4b5fd' : '#94a3b8' }}>
                  {matched ? t('wb.matched') : d.my_title}
                </p>
                {!matched && (
                  <button onClick={() => withdraw(d.id)} className="text-[10px] px-2 py-0.5 rounded-full mt-0.5"
                    style={{ background: '#3a1e1e', color: '#ef4444' }}>
                    {t('wb.withdraw')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {deposits.length === 0 && <p className="text-center text-sm text-slate-500 mb-6">{t('wb.empty')}</p>}
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <div className="flex gap-3 flex-wrap">
          {used < slots && (
            <button onClick={() => setShowPicker(!showPicker)} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {t('wb.deposit')}
            </button>
          )}
          {matchedCount > 0 && (
            <button onClick={receiveAll} disabled={busy} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              🎁 {t('wb.receiveAll')} ({matchedCount})
            </button>
          )}
        </div>

        {showPicker && (
          <div className="mt-5 p-5 rounded-2xl" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
            <p className="text-sm font-semibold text-slate-300 mb-3">{t('hub.pickBook')}</p>
            <BookPicker selected={picked} onSelect={setPicked} />
            <button onClick={deposit} disabled={!picked || busy} className="mt-4 w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {t('wb.deposit')}
            </button>
          </div>
        )}
      </main>
    </>
  );
}
