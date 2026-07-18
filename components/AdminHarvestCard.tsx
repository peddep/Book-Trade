'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface HarvestState {
  nextIndex: number;
  totalQueries: number;
  catalogCount: number;
  done: boolean;
  running?: boolean;
  rateLimited?: boolean;
}

export default function AdminHarvestCard() {
  const { t } = useI18n();
  const [state, setState] = useState<HarvestState | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function poll() {
    try {
      const r = await fetch('/api/admin/harvest');
      if (!r.ok) return;
      const d: HarvestState = await r.json();
      setState(d);
      setRunning(!!d.running);
      if (!d.running) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (d.done) setMessage(t('admin.done', { count: d.catalogCount }));
      }
    } catch { /* keep polling */ }
  }

  // On mount: read state, and if a run is already going (started elsewhere or
  // before the page was reopened), resume showing its live progress.
  useEffect(() => {
    poll().then(() => {
      if (pollRef.current) return;
      // start polling only if it's running
      setState(s => {
        if (s?.running && !pollRef.current) pollRef.current = setInterval(poll, 3000);
        return s;
      });
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start the self-continuing server harvest, then just poll for progress.
  async function run(reset: boolean) {
    setMessage('');
    setRunning(true);
    try {
      await fetch('/api/admin/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reset ? { reset: true } : {}),
      });
    } catch { /* the poll will reflect state */ }
    if (!pollRef.current) pollRef.current = setInterval(poll, 3000);
    poll();
  }

  async function stop() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setRunning(false);
    await fetch('/api/admin/harvest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stop: true }),
    }).catch(() => {});
  }

  if (!state) return null;

  const pct = state.totalQueries ? Math.round((Math.min(state.nextIndex, state.totalQueries) / state.totalQueries) * 100) : 0;

  return (
    <div className="mb-8 p-6 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #6d28d9' }}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-bold text-[#2e1065] flex items-center gap-2">🛠️ {t('admin.title')}</h3>
          <p className="text-sm text-[#6b7280] mt-1">
            {t('admin.subtitle', { count: state.catalogCount })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => run(state.done)}
            disabled={running}
            className="px-4 py-2 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {running ? t('admin.running', { pct }) : state.done ? t('admin.runAgain') : state.nextIndex > 0 ? t('admin.continue') : t('admin.start')}
          </button>
          {running && (
            <button
              onClick={stop}
              className="px-4 py-2 rounded-xl font-semibold text-sm"
              style={{ background: '#e9d5ff', color: '#6b7280' }}
            >
              {t('admin.stop')}
            </button>
          )}
        </div>
      </div>

      {(running || (state.nextIndex > 0 && !state.done)) && (
        <div className="mt-4">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#ffffff' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
          </div>
          <p className="text-xs text-[#6b7280] mt-1.5">
            {t('admin.progress', { current: Math.min(state.nextIndex, state.totalQueries), total: state.totalQueries, count: state.catalogCount })}
          </p>
          {running && <p className="text-xs mt-1" style={{ color: '#7c3aed' }}>{t('admin.keepsRunning')}</p>}
        </div>
      )}

      {message && <p className="text-sm mt-3" style={{ color: '#7c3aed' }}>{message}</p>}
    </div>
  );
}
