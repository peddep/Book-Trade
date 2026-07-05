'use client';

import { useState, useEffect, useCallback } from 'react';
import BookShelf from '@/components/BookShelf';
import TitleInput from '@/components/TitleInput';
import { useI18n } from '@/lib/i18n';
import { findByTitle } from '@/lib/books-catalog';
import { fileToCoverDataUrl } from '@/lib/image';

const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Art', 'Music', 'PE', 'Computer Science', 'Other'];
const CONDITIONS = ['Like New', 'Good', 'Fair', 'Poor'];

interface Book {
  id: number;
  title: string;
  author: string;
  subject?: string;
  grade_level?: string;
  condition: string;
  description?: string;
  cover_color: string;
  cover_url?: string | null;
  available: number;
}

const EMPTY = { title: '', author: '', subject: '', grade_level: '', condition: 'Good', description: '', cover_url: '' };

// Manages the user's books as a bookshelf (3-column scrollable grid). Tapping a
// book reveals its title and edit actions. `compact` is the Trade page's left
// panel; the full variant is the Your Books page.
export default function MyBooksManager({ compact = false, onChange }: { compact?: boolean; onChange?: () => void }) {
  const { t } = useI18n();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/books?mine=1');
    const data = await res.json();
    setBooks(data.books ?? []);
    setLoading(false);
    onChange?.();
  }, [onChange]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  async function submitBook(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    if (editingId) {
      // Text fields only; cover is edited via the shelf's cover control.
      await fetch(`/api/books/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, author: form.author, subject: form.subject,
          grade_level: form.grade_level, condition: form.condition, description: form.description,
        }),
      });
    } else {
      await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    }
    closeForm();
    setSubmitting(false);
    fetchBooks();
  }

  function closeForm() {
    setForm(EMPTY);
    setShowForm(false);
    setEditingId(null);
  }

  function startAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(id: number) {
    const b = books.find(x => x.id === id);
    if (!b) return;
    setForm({
      title: b.title, author: b.author, subject: b.subject ?? '', grade_level: b.grade_level ?? '',
      condition: b.condition, description: b.description ?? '', cover_url: b.cover_url ?? '',
    });
    setEditingId(id);
    setShowForm(true);
  }

  async function deleteBook(id: number) {
    if (!confirm(t('profile.confirmRemove'))) return;
    await fetch(`/api/books/${id}`, { method: 'DELETE' });
    fetchBooks();
  }

  async function toggleAvailable(id: number, next: boolean) {
    await fetch(`/api/books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: next }),
    });
    fetchBooks();
  }

  function setTitle(title: string) {
    const match = findByTitle(title);
    setForm(prev => ({ ...prev, title, author: match?.author ?? prev.author }));
  }

  async function onPickCover(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToCoverDataUrl(file);
      setForm(prev => ({ ...prev, cover_url: dataUrl }));
    } catch {
      // ignore unreadable images
    }
  }

  // Upload / replace the cover of an existing book (immediate save).
  async function changeCover(bookId: number, file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToCoverDataUrl(file);
      await fetch(`/api/books/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_url: dataUrl }),
      });
      fetchBooks();
    } catch {
      // ignore
    }
  }

  const bookForm = showForm && (
    <form onSubmit={submitBook} className="p-4 rounded-2xl flex flex-col gap-3 mb-4" style={{ background: compact ? '#0f0f1a' : '#1a1a2e', border: '1px solid #2d2d4a' }}>
      <h3 className="font-bold text-white">{editingId ? t('profile.editBookTitle') : t('profile.addBookTitle')}</h3>
      <div className={compact ? 'flex flex-col gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
        <div>
          <label className="text-sm text-slate-300 mb-1.5 block">{t('profile.fTitle')} *</label>
          <TitleInput value={form.title} onChange={setTitle} placeholder={t('profile.fTitlePlaceholder')} listId="mybooks-title-suggestions" required />
        </div>
        <div>
          <label className="text-sm text-slate-300 mb-1.5 block">{t('profile.fAuthor')} *</label>
          <input required value={form.author} onChange={e => setForm({ ...form, author: e.target.value })}
            className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
            placeholder={t('profile.fAuthorPlaceholder')} />
        </div>
        <div>
          <label className="text-sm text-slate-300 mb-1.5 block">{t('profile.fSubject')}</label>
          <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
            className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: form.subject ? '#e2e8f0' : '#64748b', outline: 'none' }}>
            <option value="">{t('profile.fSelectSubject')}</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{t(`subj.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-300 mb-1.5 block">{t('profile.fCondition')}</label>
          <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}
            className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}>
            {CONDITIONS.map(c => <option key={c} value={c}>{t(`cond.${c}`)}</option>)}
          </select>
        </div>
        {!compact && (
          <>
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">{t('profile.fGradeLevel')}</label>
              <input value={form.grade_level} onChange={e => setForm({ ...form, grade_level: e.target.value })}
                className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                placeholder={t('profile.fGradePlaceholder')} />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">{t('profile.fDescription')}</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                placeholder={t('profile.fDescPlaceholder')} />
            </div>
          </>
        )}
      </div>

      {/* Cover upload — only when adding; existing books change cover from the shelf */}
      {!editingId && (
        <div>
          <label className="text-sm text-slate-300 mb-1.5 block">{t('profile.cover')}</label>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: '#2d2d4a' }}>
              {form.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">📖</span>
              )}
            </div>
            <label className="px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: '#2d2d4a', color: '#e2e8f0' }}>
              {form.cover_url ? t('profile.changeCover') : t('profile.addCover')}
              <input type="file" accept="image/*" className="hidden" onChange={e => onPickCover(e.target.files?.[0])} />
            </label>
            {form.cover_url && (
              <button type="button" onClick={() => setForm(prev => ({ ...prev, cover_url: '' }))} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#3a1e1e', color: '#ef4444' }}>
                {t('profile.removeCover')}
              </button>
            )}
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: '#64748b' }}>{t('profile.coverHint')}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={closeForm} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: '#2d2d4a', color: '#94a3b8' }}>
          {t('profile.cancel')}
        </button>
        <button type="submit" disabled={submitting} className="px-6 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          {editingId ? (submitting ? t('profile.saving') : t('profile.saveBtn')) : (submitting ? t('profile.adding') : t('profile.addBtn'))}
        </button>
      </div>
    </form>
  );

  const addButton = (
    <button onClick={startAdd} className="px-4 py-2 rounded-xl font-semibold text-sm text-white"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
      {t('profile.addBook')}
    </button>
  );

  const shelf = loading ? (
    <p className="text-sm text-slate-400">{t('profile.loading')}</p>
  ) : books.length === 0 ? (
    <div className={compact ? '' : 'text-center py-16'}>
      {!compact && <div className="text-5xl mb-4">📚</div>}
      <p className="text-slate-400">{compact ? t('hub.noBooks') : t('profile.none')}</p>
      {!compact && <p className="text-slate-500 text-sm mt-1">{t('profile.noneHint')}</p>}
    </div>
  ) : (
    <BookShelf
      books={books}
      onEdit={startEdit}
      onDelete={deleteBook}
      onToggleAvailable={toggleAvailable}
      onChangeCover={changeCover}
      maxHeight={compact ? '26rem' : '65vh'}
    />
  );

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white">📚 {t('hub.myBooks')} <span className="text-slate-500 font-normal">({books.length})</span></h2>
          {addButton}
        </div>
        {bookForm}
        {shelf}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">{t('tabs.books')}</h2>
        {addButton}
      </div>
      {bookForm}
      <div className="max-w-md">{shelf}</div>
    </div>
  );
}
