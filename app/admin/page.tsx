'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Loading from '@/components/Loading';
import AdminHarvestCard from '@/components/AdminHarvestCard';
import { useI18n } from '@/lib/i18n';
import { fileToCoverDataUrl } from '@/lib/image';

type Row = Record<string, unknown>;

interface AdminData {
  stats: { users: number; books: number; trades: number; completed: number; messages: number; openReports: number; catalog: number };
  users: Row[];
  books: Row[];
  trades: Row[];
  wonderbox: Row[];
  messages: Row[];
  reports: Row[];
  catalog: Row[];
  donations: Row[];
}

const TABS = ['reports', 'donations', 'users', 'books', 'catalog', 'trades', 'wonderbox', 'messages'] as const;
type Tab = (typeof TABS)[number];

// Columns shown per table (order matters).
const COLUMNS: Record<Tab, string[]> = {
  reports: ['id', 'status', 'target_type', 'target_label', 'reason', 'reporter_name', 'created_at'],
  donations: ['id', 'user_name', 'bank_name', 'amount', 'status', 'created_at'],
  users: ['id', 'name', 'real_name', 'email', 'grade', 'class_no', 'contact', 'banned', 'books_count', 'trades_completed', 'created_at'],
  books: ['id', 'title', 'title_en', 'author', 'subject', 'condition', 'price', 'available', 'owner_name', 'created_at'],
  catalog: ['id', 'title', 'author', 'publisher', 'source', 'created_at'],
  trades: ['id', 'status', 'requester_name', 'offered_title', 'owner_name', 'wanted_title', 'message', 'created_at', 'updated_at'],
  wonderbox: ['id', 'user_name', 'title', 'status', 'created_at'],
  messages: ['id', 'kind', 'user_name', 'body', 'created_at'],
};

export default function AdminPage() {
  const { t } = useI18n();
  const [data, setData] = useState<AdminData | null>(null);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>('reports');
  const [tempPw, setTempPw] = useState<{ name: string; password: string } | null>(null);
  const [catalogLines, setCatalogLines] = useState('');
  const [catalogResult, setCatalogResult] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogQ, setCatalogQ] = useState('');
  const [editBook, setEditBook] = useState<Record<string, any> | null>(null);
  const router = useRouter();

  // Reload catalog rows when the search box changes (debounced).
  useEffect(() => {
    if (!data) return;
    const id = setTimeout(async () => {
      const r = await fetch(`/api/admin?catalog_q=${encodeURIComponent(catalogQ)}`);
      if (r.ok) { const d = await r.json(); setData(prev => prev ? { ...prev, catalog: d.catalog } : prev); }
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogQ]);

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

  async function saveBookEdit() {
    if (!editBook) return;
    await fetch(`/api/books/${editBook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editBook.title,
        title_en: editBook.title_en,
        author: editBook.author,
        subject: editBook.subject,
        condition: editBook.condition,
        description: editBook.description,
        price: editBook.price === '' || editBook.price == null ? '' : Number(editBook.price),
        available: editBook.available ? 1 : 0,
      }),
    });
    setEditBook(null);
    refresh();
  }

  async function adminAction(payload: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
    { label: t('adm.openReports'), value: data.stats.openReports ?? 0 },
    { label: t('adm.users'), value: data.stats.users },
    { label: t('adm.books'), value: data.stats.books },
    { label: t('adm.catalog'), value: data.stats.catalog ?? 0 },
    { label: t('adm.trades'), value: data.stats.trades },
  ];

  const rows = data[tab] ?? [];
  const cols = COLUMNS[tab];

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/room" className="text-sm text-[#6b7280] hover:text-[#2e1065]">{t('hub.back')}</Link>
        <div className="flex items-center justify-between gap-3 mt-2 mb-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2e1065]">🛠️ {t('adm.title')}</h1>
          <a href="/api/admin?export=1" className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex-shrink-0"
            style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
            {t('adm.export')}
          </a>
        </div>

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

        {/* Auto-harvest Thai books until done or rate-limited */}
        <AdminHarvestCard />

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

        {/* Catalog search */}
        {tab === 'catalog' && (
          <input
            value={catalogQ}
            onChange={e => setCatalogQ(e.target.value)}
            placeholder={t('adm.catalogSearch')}
            className="w-full mb-3 px-3 py-2 rounded-xl text-sm"
            style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
          />
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
                {(tab === 'users' || tab === 'reports' || tab === 'donations') && <th className="px-3 py-2"></th>}
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
                        <button onClick={() => setEditBook({ ...r })}
                          className="px-2 py-1 rounded-lg font-semibold"
                          style={{ background: '#ede9fe', color: '#7c3aed' }}>
                          ✏️ {t('adm.editBook')}
                        </button>
                        <button onClick={() => adminAction({ action: 'delete_book', book_id: r.id }, `${t('adm.deleteBook')}: ${String(r.title)}?`)}
                          className="px-2 py-1 rounded-lg font-semibold"
                          style={{ background: '#fee2e2', color: '#ef4444' }}>
                          🗑 {t('adm.deleteBook')}
                        </button>
                      </div>
                    </td>
                  )}
                  {tab === 'users' && (
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => resetPassword(r.id, r.name)}
                          className="px-2 py-1 rounded-lg font-semibold"
                          style={{ background: '#fee2e2', color: '#ef4444' }}>
                          🔑 {t('adm.reset')}
                        </button>
                        {Number(r.banned) === 1 ? (
                          <button onClick={() => adminAction({ action: 'unban_user', user_id: r.id })}
                            className="px-2 py-1 rounded-lg font-semibold"
                            style={{ background: '#dcfce7', color: '#10b981' }}>
                            ✓ {t('adm.unban')}
                          </button>
                        ) : (
                          <button onClick={() => adminAction({ action: 'ban_user', user_id: r.id }, `${t('adm.ban')}: ${String(r.name)}?`)}
                            className="px-2 py-1 rounded-lg font-semibold"
                            style={{ background: '#fee2e2', color: '#ef4444' }}>
                            🚫 {t('adm.ban')}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {tab === 'reports' && (
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {r.target_type === 'book' ? (
                          <button onClick={() => adminAction({ action: 'delete_book', book_id: r.target_id }, `${t('adm.deleteBook')}?`)}
                            className="px-2 py-1 rounded-lg font-semibold" style={{ background: '#fee2e2', color: '#ef4444' }}>
                            🗑 {t('adm.deleteBook')}
                          </button>
                        ) : (
                          <button onClick={() => adminAction({ action: 'ban_user', user_id: r.target_id }, `${t('adm.ban')}?`)}
                            className="px-2 py-1 rounded-lg font-semibold" style={{ background: '#fee2e2', color: '#ef4444' }}>
                            🚫 {t('adm.ban')}
                          </button>
                        )}
                        {r.status === 'open' && (
                          <button onClick={() => adminAction({ action: 'resolve_report', report_id: r.id })}
                            className="px-2 py-1 rounded-lg font-semibold" style={{ background: '#dcfce7', color: '#10b981' }}>
                            ✓ {t('adm.resolve')}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {tab === 'donations' && (
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {r.status === 'verified' ? (
                          <button onClick={() => adminAction({ action: 'unverify_donation', donation_id: r.id })}
                            className="px-2 py-1 rounded-lg font-semibold" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                            ↩ {t('adm.unverify')}
                          </button>
                        ) : (
                          <button onClick={() => adminAction({ action: 'verify_donation', donation_id: r.id })}
                            className="px-2 py-1 rounded-lg font-semibold" style={{ background: '#dcfce7', color: '#10b981' }}>
                            ✓ {t('adm.verify')}
                          </button>
                        )}
                        <button onClick={() => adminAction({ action: 'delete_donation', donation_id: r.id }, `${t('adm.deleteDonation')}?`)}
                          className="px-2 py-1 rounded-lg font-semibold" style={{ background: '#fee2e2', color: '#ef4444' }}>
                          🗑 {t('adm.deleteDonation')}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={cols.length + (tab === 'users' || tab === 'books' || tab === 'reports' || tab === 'donations' ? 1 : 0)} className="px-3 py-6 text-center text-[#9ca3af]">—</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Full book editor (admin can change any field) */}
        {editBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(46,16,101,0.4)' }} onClick={() => setEditBook(null)}>
            <div className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e9d5ff', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid #f3e8ff' }}>
                <p className="font-bold text-[#2e1065]">✏️ {t('adm.editBook')} #{String(editBook.id)}</p>
                <button onClick={() => setEditBook(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6b7280] text-xl" style={{ background: '#f3f4f6' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
                {[
                  { k: 'title', label: t('profile.fTitleTh') },
                  { k: 'title_en', label: t('profile.fTitleEn') },
                  { k: 'author', label: t('profile.fAuthor') },
                  { k: 'subject', label: t('profile.fSubject') },
                  { k: 'price', label: t('profile.fPrice'), type: 'number' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-xs font-semibold text-[#6b7280] mb-1 block">{f.label}</label>
                    <input
                      type={f.type ?? 'text'}
                      value={editBook[f.k] ?? ''}
                      onChange={e => setEditBook(b => b && ({ ...b, [f.k]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff', outline: 'none' }} />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-[#6b7280] mb-1 block">{t('profile.fCondition')}</label>
                  <select value={editBook.condition ?? 'Good'} onChange={e => setEditBook(b => b && ({ ...b, condition: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm text-[#2e1065]" style={{ background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                    {['Like New', 'Good', 'Fair', 'Poor'].map(c => <option key={c} value={c}>{t(`cond.${c}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#6b7280] mb-1 block">{t('profile.fDescription')}</label>
                  <textarea rows={2} value={editBook.description ?? ''} onChange={e => setEditBook(b => b && ({ ...b, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm text-[#2e1065] resize-none" style={{ background: '#faf5ff', border: '1px solid #e9d5ff', outline: 'none' }} />
                </div>
                <label className="flex items-center gap-2 text-sm text-[#2e1065]">
                  <input type="checkbox" checked={!!Number(editBook.available)} onChange={e => setEditBook(b => b && ({ ...b, available: e.target.checked ? 1 : 0 }))} />
                  {t('adm.bookAvailable')}
                </label>
              </div>
              <div className="flex gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid #f3e8ff' }}>
                <button onClick={() => setEditBook(null)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm" style={{ background: '#f3f4f6', color: '#6b7280' }}>{t('profile2.cancel')}</button>
                <button onClick={saveBookEdit} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>{t('profile2.save')}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
