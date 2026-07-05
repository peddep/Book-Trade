'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import BookPicker from '@/components/BookPicker';
import BookThumb from '@/components/BookThumb';
import { useI18n } from '@/lib/i18n';

interface Member {
  user_id: number;
  name: string;
  avatar_color: string;
  title: string;
  title_en?: string | null;
  cover_color: string;
  cover_url?: string | null;
  received_title?: string;
  received_title_en?: string | null;
  received_color?: string;
  received_book_id?: number;
}

interface Room {
  code: string;
  status: string;
  is_owner: boolean;
  is_member: boolean;
  max: number;
  members: Member[];
}

export default function RoomsPage() {
  const { t, bookTitle } = useI18n();
  const [me, setMe] = useState<number | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [code, setCode] = useState('');
  const [picked, setPicked] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setMe(d.user?.id ?? null));
  }, []);

  const refresh = useCallback(async (roomCode?: string) => {
    const target = roomCode ?? room?.code;
    const res = await fetch(target ? `/api/rooms?code=${target}` : '/api/rooms');
    if (res.ok) {
      const d = await res.json();
      if (d.room) setRoom(d.room);
    }
  }, [room?.code]);

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while in an open room so members see joins/shuffle live.
  useEffect(() => {
    if (room && room.status === 'open') {
      pollRef.current = setInterval(() => refresh(room.code), 4000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [room, refresh]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setErr('');
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json();
    if (res.ok) {
      if (action === 'leave') {
        setRoom(null);
        setMode(null);
      } else if (d.room) {
        setRoom(d.room);
        setMode(null);
        setPicked(null);
        setCode('');
      }
    } else {
      const map: Record<string, string> = {
        not_found: t('room.notFound'),
        room_full: t('room.full2'),
        need_two: t('room.needTwo'),
        book_unavailable: t('hub.noFreeBooks'),
      };
      setErr(map[d.error] ?? t('admin.error'));
    }
    setBusy(false);
  }

  const myResult = room?.members.find(m => m.user_id === me);

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/trade" className="text-sm text-slate-400 hover:text-white">{t('hub.back')}</Link>
        <h1 className="text-3xl font-bold text-white mt-2 mb-1">🚪 {t('hub.rooms')}</h1>
        <p className="text-sm text-slate-400 mb-6">{t('room.desc')}</p>

        {!room && (
          <>
            <div className="grid sm:grid-cols-2 gap-3 mb-5">
              <button onClick={() => { setMode(mode === 'create' ? null : 'create'); setErr(''); }}
                className="p-5 rounded-2xl text-left"
                style={{ background: mode === 'create' ? '#2d1e5a' : '#1a1a2e', border: `1px solid ${mode === 'create' ? '#8b5cf6' : '#2d2d4a'}` }}>
                <p className="font-bold text-white">➕ {t('room.create')}</p>
                <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>⭐ {t('room.createNote')}</p>
              </button>
              <button onClick={() => { setMode(mode === 'join' ? null : 'join'); setErr(''); }}
                className="p-5 rounded-2xl text-left"
                style={{ background: mode === 'join' ? '#2d1e5a' : '#1a1a2e', border: `1px solid ${mode === 'join' ? '#8b5cf6' : '#2d2d4a'}` }}>
                <p className="font-bold text-white">🔑 {t('room.join')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('room.codePlaceholder')}</p>
              </button>
            </div>

            {mode && (
              <div className="p-5 rounded-2xl" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
                {mode === 'join' && (
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder={t('room.codePlaceholder')}
                    maxLength={6}
                    className="w-full p-3 rounded-xl text-sm mb-4 font-mono tracking-widest text-center"
                    style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                  />
                )}
                <p className="text-sm font-semibold text-slate-300 mb-2">{t('hub.pickBook')}</p>
                <BookPicker selected={picked} onSelect={setPicked} />
                {err && <p className="text-sm text-red-400 mt-3">{err}</p>}
                <button
                  onClick={() => (mode === 'create' ? act('create', { book_id: picked }) : act('join', { code, book_id: picked }))}
                  disabled={!picked || busy || (mode === 'join' && code.length !== 6)}
                  className="mt-4 w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
                >
                  {mode === 'create' ? t('room.create') : t('room.join')}
                </button>
              </div>
            )}
          </>
        )}

        {room && (
          <div className="p-5 rounded-2xl" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div>
                <p className="text-xs text-slate-400">{t('room.shareCode')}</p>
                <p className="font-mono text-2xl font-bold tracking-widest" style={{ color: '#a78bfa' }}>{room.code}</p>
              </div>
              <span className="text-sm font-semibold text-slate-300">{t('room.members', { n: room.members.length, max: room.max })}</span>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              {room.members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: '#0f0f1a' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: m.avatar_color }}>
                    {m.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-white font-semibold">{m.name}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-slate-400 min-w-0">
                    <BookThumb coverUrl={m.cover_url} coverColor={m.cover_color} size={24} />
                    <span className="truncate max-w-[10rem]">{bookTitle(m.title, m.title_en)}</span>
                  </span>
                </div>
              ))}
            </div>

            {room.status === 'open' ? (
              <>
                {room.is_owner ? (
                  <button onClick={() => act('shuffle', { code: room.code })} disabled={busy || room.members.length < 2}
                    className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
                    {t('room.shuffle')}
                  </button>
                ) : (
                  <p className="text-center text-sm text-slate-400 py-2">{t('room.waitOwner')}</p>
                )}
                {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
                <button onClick={() => act('leave', { code: room.code })} className="mt-3 w-full py-2 rounded-xl text-sm font-semibold"
                  style={{ background: '#2d2d4a', color: '#94a3b8' }}>
                  {t('room.leave')}
                </button>
              </>
            ) : (
              <div className="p-4 rounded-xl" style={{ background: '#0d2b1a', border: '1px solid #10b981' }}>
                <p className="font-bold mb-1" style={{ color: '#10b981' }}>🎉 {t('room.done')}</p>
                {myResult?.received_title ? (
                  <>
                    <p className="text-sm text-white">{t('room.youGot', { title: myResult.received_title })}</p>
                    <p className="text-xs mt-1" style={{ color: '#6ee7b7' }}>{t('wb.meetHint')}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-300">{t('room.noTrade')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
