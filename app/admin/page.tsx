'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Loading from '@/components/Loading';
import { useI18n } from '@/lib/i18n';
import { fileToCoverDataUrl } from '@/lib/image';

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
  const [tempPw, setTempPw] = useState<{ name: string; password: string } | null>(null);
  const [catalogLines, setCatalogLines] = useState('');
  const [catalogResult, setCatalogResult] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);
  const router = useRouter();

  async function addToCatalog() {
    if (!catalogLines.trim() || catalogBusy) return;
    setCatalogBusy(true);
    setCatalogResult('');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_catalog', lines: catalogLines }),
    });
    if (res.ok) {
      const d = await res.json();
      setCatalogResult(t('adm.catalogAdded', { n: d.inserted, skipped: d.skipped }));
      setCatalogLines('');
    }
    setCatalogBusy(false);
  }

  async function refresh() {
    const r = await fetch('/api/admin');
    if (r.ok) setData(await r.json());
  }

  async function editAuthor(bookId: unknown, current: unknown) {
    const author = prompt(t('adm.editAuthor'), typeof current === 'string' ? current : '');
    if (author == null) return;
    const res = await fetch(`/api/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author }),
    });
    if (res.ok) refresh();
  }

  async function uploadCover(bookId: unknown, file: File | undefined) {
    if (!file) return;
    const cover = await fileToCoverDataUrl(file);
    const res = await fetch(`/api/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover_url: cover }),
    });
    if (res.ok) refresh();
  }

  async function resetPassword(userId: unknown, name: unknown) {
    if (!confirm(`${t('adm.reset')}: ${String(name)}?`)) return;
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_password', user_id: userId }),
    });
    if (res.ok) {
      const d = await res.json();
      setTempPw({ name: d.name, password: d.password });
    }
  }

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

        {/* Add titles to the suggestion catalog (e.g. school textbooks) */}
        <details className="mb-6 rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          <summary className="px-4 py-3 cursor-pointer text-sm font-bold text-[#2e1065]">📚 {t('adm.catalogTitle')}</summary>
          <div className="px-4 pb-4">
            <p className="text-xs text-[#6b7280] mb-2">{t('adm.catalogHint')}</p>
            <textarea
              value={catalogLines}
              onChange={e => setCatalogLines(e.target.value)}
              rows={6}
              placeholder={'คณิตศาสตร์พื้นฐาน ม.4 เล่ม 1 | สสวท.\nภาษาไทย วรรณคดีวิจักษ์ ม.5\nAccess M.3 Student Book | Aksorn'}
              className="w-full p-3 rounded-xl text-sm font-mono"
              style={{ background: '#faf5ff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
            />
            <div className="flex items-center gap-3 mt-2">
              <button onClick={addToCatalog} disabled={catalogBusy || !catalogLines.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                {t('adm.catalogAdd')}
              </button>
              {catalogResult && <p className="text-sm font-semibold" style={{ color: '#10b981' }}>{catalogResult}</p>}
            </div>
          </div>
        </details>

        {/* Temporary password banner after a reset */}
        {tempPw && (
          <div className="mb-4 p-4 rounded-2xl flex items-center justify-between gap-3" style={{ background: '#fef9c3', border: '1px solid #fde68a' }}>
            <p className="text-sm font-semibold" style={{ color: '#b45309' }}>
              {t('adm.tempPw', { name: tempPw.name })} <code className="px-2 py-0.5 rounded font-mono" style={{ background: '#ffffff' }}>{tempPw.password}</code>
            </p>
            <button onClick={() => setTempPw(null)} className="text-lg" style={{ color: '#b45309' }}>✕</button>
          </div>
        )}

        {/* Data table */}
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          <table className="w-full text-left text-xs">
            <thead>
              <tr style={{ background: '#faf5ff' }}>
                {cols.map(c => (
                  <th key={c} className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: '#7c3aed' }}>{c}</th>
                ))}
                {tab === 'books' && <th className="px-3 py-2 font-semibold" style={{ color: '#7c3aed' }}>cover</th>}
                {tab === 'users' && <th className="px-3 py-2"></th>}
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
                  {tab === 'books' && (
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {typeof r.cover_url === 'string' && r.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.cover_url} alt="" className="rounded object-cover" style={{ width: 28, height: 42 }} />
                        ) : (
                          <span className="text-[#d1d5db]">—</span>
                        )}
                        <label className="px-2 py-1 rounded-lg font-semibold cursor-pointer"
                          style={{ background: '#ede9fe', color: '#7c3aed' }}>
                          🖼 {r.cover_url ? t('adm.changeCover') : t('adm.addCover')}
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => uploadCover(r.id, e.target.files?.[0])} />
                        </label>
                        <button onClick={() => editAuthor(r.id, r.author)}
                          className="px-2 py-1 rounded-lg font-semibold"
                          style={{ background: '#ede9fe', color: '#7c3aed' }}>
                          ✏️ {t('adm.editAuthor')}
                        </button>
                      </div>
                    </td>
                  )}
                  {tab === 'users' && (
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <button onClick={() => resetPassword(r.id, r.name)}
                        className="px-2 py-1 rounded-lg font-semibold"
                        style={{ background: '#fee2e2', color: '#ef4444' }}>
                        🔑 {t('adm.reset')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={cols.length + (tab === 'users' || tab === 'books' ? 1 : 0)} className="px-3 py-6 text-center text-[#9ca3af]">—</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
