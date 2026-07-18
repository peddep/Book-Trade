'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface HarvestState {
  nextIndex: number;
  totalQueries: number;
  catalogCount: number;
  done: boolean;
  rateLimited?: boolean;
}

export default function AdminHarvestCard() {
  const { t } = useI18n();
  const [state, setState] = useState<HarvestState | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const stopRef = useRef(false);

  useEffect(() => {
    fetch('/api/admin/harvest')
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setState(d))
      .catch(() => {});
  }, []);

  async function run(reset: boolean) {
    setRunning(true);
    setMessage('');
    stopRef.current = false;
    let first = true;
    try {
      // Loop until a full cycle finishes or the API rate-limits us.
      for (let i = 0; i < 400 && !stopRef.current; i++) {
        const res = await fetch('/api/admin/harvest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(first && reset ? { reset: true } : {}),
        });
        first = false;
        if (!res.ok) {
          setMessage(t('admin.error'));
          break;
        }
        const d: HarvestState = await res.json();
        setState(d);
        if (d.rateLimited) {
          setMessage(t('admin.rateLimited'));
          break;
        }
        if (d.done) {
          setMessage(t('admin.done', { count: d.catalogCount }));
          break;
        }
      }
    } catch {
      setMessage(t('admin.error'));
    } finally {
      setRunning(false);
    }
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
              onClick={() => { stopRef.current = true; }}
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
        </div>
      )}

      {message && <p className="text-sm mt-3" style={{ color: '#7c3aed' }}>{message}</p>}
    </div>
  );
}
