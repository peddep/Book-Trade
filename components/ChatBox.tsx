'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface Message {
  id: number;
  user_id: number | null;
  kind: string;
  body: string;
  created_at: string;
  user_name: string | null;
  user_avatar: string | null;
}

export default function ChatBox() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const d = await res.json();
    setMessages(d.messages ?? []);
    setMe(d.me ?? null);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 4000); // light polling
    return () => clearInterval(iv);
  }, [load]);

  // Auto-scroll to the bottom when new messages arrive.
  useEffect(() => {
    const last = messages[messages.length - 1]?.id ?? 0;
    if (last !== lastIdRef.current) {
      lastIdRef.current = last;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    await load();
    setSending(false);
  }

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: '#ffffff', border: '1px solid #e9d5ff', height: 340 }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
        <span className="text-base">💬</span>
        <p className="text-sm font-bold text-white">{t('chat.title')}</p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2" style={{ background: '#faf5ff' }}>
        {messages.length === 0 ? (
          <p className="text-xs text-[#9ca3af] text-center my-auto">{t('chat.empty')}</p>
        ) : (
          messages.map(m => {
            if (m.kind === 'announcement') {
              return (
                <div key={m.id} className="mx-auto text-center px-3 py-1.5 rounded-full max-w-[90%]"
                  style={{ background: '#ede9fe', border: '1px solid #ddd6fe' }}>
                  <p className="text-[11px] font-semibold" style={{ color: '#7c3aed' }}>
                    🏆 {t('chat.announce')} · {m.body}
                  </p>
                </div>
              );
            }
            const mine = m.user_id === me;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: m.user_avatar ?? '#8b5cf6' }}>
                  {(m.user_name?.[0] ?? '?').toUpperCase()}
                </span>
                <div className={`max-w-[75%] ${mine ? 'text-right' : ''}`}>
                  <p className="text-[10px] text-[#9ca3af] px-1">{mine ? t('chat.you') : m.user_name}</p>
                  <div className="px-3 py-1.5 rounded-2xl inline-block text-left"
                    style={mine
                      ? { background: '#7c3aed', color: '#ffffff', borderTopRightRadius: 4 }
                      : { background: '#ffffff', color: '#2e1065', border: '1px solid #e9d5ff', borderTopLeftRadius: 4 }}>
                    <p className="text-xs leading-snug break-words">{m.body}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 p-2.5" style={{ borderTop: '1px solid #e9d5ff' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('chat.placeholder')}
          maxLength={500}
          className="flex-1 px-3 py-2 rounded-full text-sm text-[#2e1065]"
          style={{ background: '#faf5ff', border: '1px solid #e9d5ff', outline: 'none' }}
        />
        <button type="submit" disabled={sending || !text.trim()}
          className="px-4 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
          {t('chat.send')}
        </button>
      </form>
    </div>
  );
}
