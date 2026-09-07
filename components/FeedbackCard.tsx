'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

const MAX_LEN = 1000;

// Suggestion / bug-report box. Sits on the room page so there is one obvious
// place to tell the admin something is wrong, rather than nowhere.
export default function FeedbackCard() {
  const { t } = useI18n();
  const [kind, setKind] = useState<'suggestion' | 'bug'>('suggestion');
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function send() {
    if (body.trim().length < 5 || state === 'sending') return;
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, body }),
      });
      if (res.ok) {
        setBody('');
        setState('sent');
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d.error === 'rate_limited' ? t('fb.tooMany') : t('fb.failed'));
      setState('error');
    } catch {
      setError(t('fb.failed'));
      setState('error');
    }
  }

  const tab = (k: 'suggestion' | 'bug', label: string) => (
    <button
      type="button"
      onClick={() => { setKind(k); setState('idle'); }}
      className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors"
      style={kind === k
        ? { background: '#986D8E', color: '#ffffff' }
        : { background: '#EFE3D0', color: '#6b7280', border: '1px solid #D9CAB3' }}
    >
      {label}
    </button>
  );

  return (
    <div className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #D9CAB3' }}>
      <h2 className="font-bold text-[#3D2A39] mb-1">💡 {t('fb.title')}</h2>
      <p className="text-xs text-[#6b7280] mb-3 leading-relaxed">{t('fb.subtitle')}</p>

      <div className="flex gap-2 mb-3">
        {tab('suggestion', `✨ ${t('fb.kindSuggestion')}`)}
        {tab('bug', `🐛 ${t('fb.kindBug')}`)}
      </div>

      {state === 'sent' ? (
        <div className="text-center py-5">
          <p className="text-2xl mb-1">🙏</p>
          <p className="text-sm font-semibold" style={{ color: '#10b981' }}>{t('fb.thanks')}</p>
          <button onClick={() => setState('idle')} className="text-xs mt-3 px-3 py-1.5 rounded-full font-semibold"
            style={{ background: '#D9CAB3', color: '#3D2A39' }}>
            {t('fb.sendAnother')}
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value.slice(0, MAX_LEN))}
            rows={3}
            placeholder={kind === 'bug' ? t('fb.placeholderBug') : t('fb.placeholderSuggestion')}
            className="w-full p-2.5 rounded-xl text-sm resize-none"
            style={{ background: '#ffffff', border: '1px solid #D9CAB3', color: '#3D2A39', outline: 'none' }}
          />
          <div className="flex items-center justify-between mt-2 gap-3">
            <span className="text-[11px]" style={{ color: '#9ca3af' }}>{body.length}/{MAX_LEN}</span>
            <button
              onClick={send}
              disabled={body.trim().length < 5 || state === 'sending'}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #87A8A4, #A67C9C)' }}
            >
              {state === 'sending' ? t('fb.sending') : t('fb.send')}
            </button>
          </div>
          {error && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{error}</p>}
        </>
      )}
    </div>
  );
}
