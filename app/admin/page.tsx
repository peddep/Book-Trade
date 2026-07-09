'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Loading from '@/components/Loading';
import { useI18n } from '@/lib/i18n';

type Row = Record<string, unknown>;

interface AdminData {
  stats: { users: number; books: number; trades: number; completed: number; messages: number };
  users: Row[];
  books: Row[];
  trades: Row[];
  wonderbox: Row[];
  messages: Row[];
}

const TABS = ['users', 'books', 'trades', 'wonderbox', 'messages'] as const;
type Tab = (typeof TABS)[number];

// Columns shown per table (order matters).
const COLUMNS: Record<Tab, string[]> = {
  users: ['id', 'name', 'real_name', 'email', 'grade', 'class_no', 'contact', 'books_count', 'trades_completed', 'availability', 'created_at'],
  books: ['id', 'title', 'title_en', 'author', 'subject', 'condition', 'price', 'available', 'owner_name', 'created_at'],
  trades: ['id', 'status', 'requester_name', 'offered_title', 'owner_name', 'wanted_title', 'message', 'created_at', 'updated_at'],
  wonderbox: ['id', 'user_name', 'title', 'status', 'created_at'],
  messages: ['id', 'kind', 'user_name', 'body', 'created_at'],
};

export default function AdminPage() {
  const { t } = useI18n();
  const [data, setData] = useState<AdminData | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>('users');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin').then(async r => {
      if (r.status === 401) { router.push('/login'); return; }
      if (!r.ok) { setDenied(true); return; }
      setData(await r.json());
    });
  }, [router]);

  if (denied) return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <p className="text-[#6b7280]">Admin only</p>
      </main>
    </>
  );
  if (!data) return (<><Navbar /><Loading /></>);

  const stats = [
    { label: t('adm.users'), value: data.stats.users },
    { label: t('adm.books'), value: data.stats.books },
    { label: t('adm.trades'), value: data.stats.trades },
    { label: t('adm.completed'), value: data.stats.completed },
    { label: t('adm.messages'), value: data.stats.messages },
  ];

  const rows = data[tab] ?? [];
  const cols = COLUMNS[tab];

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/room" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065] mt-2 mb-5">🛠️ {t('adm.title')}</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {stats.map(s => (
            <div key={s.label} className="p-4 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
              <p className="text-2xl font-bold text-[#2e1065]">{String(s.value)}</p>
              <p className="text-xs text-[#6b7280] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Table tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-4 overflow-x-auto" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          {TABS.map(k => (
            <button key={k} onClick={() => setTab(k)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors"
              style={tab === k ? { background: '#7c3aed', color: 'white' } : { color: '#6b7280' }}>
              {t(`adm.${k}`)} ({(data[k] ?? []).length})
            </button>
          ))}
        </div>

        {/* Data table */}
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          <table className="w-full text-left text-xs">
            <thead>
              <tr style={{ background: '#faf5ff' }}>
                {cols.map(c => (
                  <th key={c} className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: '#7c3aed' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f3e8ff' }}>
                  {cols.map(c => (
                    <td key={c} className="px-3 py-2 text-[#2e1065] align-top" style={{ maxWidth: 260 }}>
                      <span className="line-clamp-2 break-words">{r[c] == null ? '—' : String(r[c])}</span>
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={cols.length} className="px-3 py-6 text-center text-[#9ca3af]">—</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
