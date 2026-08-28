'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface Message {
  id: number;
  user_id: number | null;
  kind: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
  user_name: string | null;
  user_avatar: string | null;
}

export default function ChatBox() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Moderation, admin only. The server re-checks on every call, so this only
  // decides whether the controls are drawn.
  const [canModerate, setCanModerate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [unread, setUnread] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);
  const atBottomRef = useRef(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const d = await res.json();
    setMessages(d.messages ?? []);
    setMe(d.me ?? null);
    setCanModerate(Boolean(d.is_admin));
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 4000); // light polling
    return () => clearInterval(iv);
  }, [load]);

  // Auto-scroll on new messages only when already at the bottom; otherwise
  // show an unread pill instead of yanking the reader down.
  useEffect(() => {
    const last = messages[messages.length - 1]?.id ?? 0;
    if (last !== lastIdRef.current) {
      const first = lastIdRef.current === 0;
      lastIdRef.current = last;
      if (first || atBottomRef.current) {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: first ? 'auto' : 'smooth' });
      } else {
        setUnread(true);
      }
    }
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottomRef.current) setUnread(false);
  }

  function jumpToLatest() {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    setUnread(false);
  }

  function startEdit(m: Message) {
    setEditingId(m.id);
    setEditText(m.body);
  }

  async function saveEdit() {
    const body = editText.trim();
    if (!body || editingId === null) return;
    const id = editingId;
    setEditingId(null);
    await fetch('/api/chat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, body }),
    });
    await load();
  }

  async function remove(m: Message) {
    if (!confirm(t('chat.deleteConfirm'))) return;
    await fetch(`/api/chat?id=${m.id}`, { method: 'DELETE' });
    await load();
  }

  // Pencil / bin pair shown beside a message for the admin.
  function modControls(m: Message) {
    if (!canModerate || editingId === m.id) return null;
    return (
      <span className="flex gap-1 flex-shrink-0 self-center">
        <button onClick={() => startEdit(m)} aria-label={t('chat.edit')} title={t('chat.edit')}
          className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: '#f3e8ff', color: '#7c3aed' }}>✏️</button>
        <button onClick={() => remove(m)} aria-label={t('chat.delete')} title={t('chat.delete')}
          className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: '#fee2e2', color: '#ef4444' }}>🗑</button>
      </span>
    );
  }

  // Replaces the bubble while an admin is rewriting it.
  function editRow(m: Message) {
    return (
      <div className="flex gap-1.5 items-center w-full">
        <input
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
            if (e.key === 'Escape') setEditingId(null);
          }}
          autoFocus
          maxLength={500}
          className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs text-[#2e1065]"
          style={{ background: '#ffffff', border: '1px solid #7c3aed', outline: 'none' }}
        />
        <button onClick={saveEdit} disabled={!editText.trim()}
          className="text-[11px] font-bold px-2 py-1 rounded-lg text-white disabled:opacity-40" style={{ background: '#7c3aed' }}>
          {t('chat.save')}
        </button>
        <button onClick={() => setEditingId(null)}
          className="text-[11px] px-2 py-1 rounded-lg" style={{ background: '#f3f4f6', color: '#6b7280' }}>
          {t('chat.cancelEdit')}
        </button>
      </div>
    );
  }

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
    <div className="relative rounded-2xl overflow-hidden flex flex-col h-[340px] lg:h-[440px]" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
      {unread && (
        <button onClick={jumpToLatest}
          className="absolute left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg animate-bounce"
          style={{ bottom: 70, background: '#7c3aed' }}>
          ⬇ {t('chat.new')}
        </button>
      )}
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
        <span className="text-base">💬</span>
        <p className="text-sm font-bold text-white">{t('chat.title')}</p>
      </div>

      <div ref={listRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2" style={{ background: '#faf5ff' }}>
        {messages.length === 0 ? (
          <p className="text-xs text-[#9ca3af] text-center my-auto">{t('chat.empty')}</p>
        ) : (
          messages.map(m => {
            if (m.kind === 'announcement' || m.kind === 'donation') {
              const donation = m.kind === 'donation';
              // Donations posted before they had their own kind carry the label
              // inside the body; drop it so it isn't shown twice.
              const body = donation ? m.body.replace(/^💜\s*/, '') : m.body;
              if (editingId === m.id) {
                return <div key={m.id} className="px-1">{editRow(m)}</div>;
              }
              return (
                <div key={m.id} className="flex items-center justify-center gap-1.5 bt-slide-in">
                  <div className="text-center px-3 py-1.5 rounded-full max-w-[80%]"
                    style={donation
                      ? { background: '#fce7f3', border: '1px solid #fbcfe8' }
                      : { background: '#ede9fe', border: '1px solid #ddd6fe' }}>
                    <p className="text-[11px] font-semibold" style={{ color: donation ? '#be185d' : '#7c3aed' }}>
                      {donation ? `💜 ${t('chat.donate')}` : `🏆 ${t('chat.announce')}`} · {body}
                    </p>
                  </div>
                  {modControls(m)}
                </div>
              );
            }
            const mine = m.user_id === me;
            return (
              <div key={m.id} className={`flex items-end gap-2 bt-slide-in ${mine ? 'flex-row-reverse' : ''}`}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: m.user_avatar ?? '#8b5cf6' }}>
                  {(m.user_name?.[0] ?? '?').toUpperCase()}
                </span>
                <div className={`max-w-[75%] ${mine ? 'text-right' : ''}`}>
                  <p className="text-[10px] text-[#9ca3af] px-1">{mine ? t('chat.you') : m.user_name}</p>
                  {editingId === m.id ? editRow(m) : (
                    <div className="px-3 py-1.5 rounded-2xl inline-block text-left"
                      style={mine
                        ? { background: '#7c3aed', color: '#ffffff', borderTopRightRadius: 4 }
                        : { background: '#ffffff', color: '#2e1065', border: '1px solid #e9d5ff', borderTopLeftRadius: 4 }}>
                      <p className="text-xs leading-snug break-words">{m.body}</p>
                      {/* The message still carries this student's name, so say
                          plainly that the words are no longer only theirs. */}
                      {m.edited_at && (
                        <p className="text-[9px] mt-0.5" style={{ color: mine ? '#ddd6fe' : '#9ca3af' }}>{t('chat.edited')}</p>
                      )}
                    </div>
                  )}
                </div>
                {modControls(m)}
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
