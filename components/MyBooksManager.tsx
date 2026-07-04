'use client';

import { useState, useEffect, useCallback } from 'react';
import BookCard from '@/components/BookCard';
import TitleInput from '@/components/TitleInput';
import { useI18n } from '@/lib/i18n';
import { findByTitle } from '@/lib/books-catalog';

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
  available: number;
}

const EMPTY = { title: '', author: '', subject: '', grade_level: '', condition: 'Good', description: '' };

// Manages the user's books: add form + list. `compact` renders a slim single
// column (for the Trade page's left panel); otherwise a full card grid.
export default function MyBooksManager({ compact = false, onChange }: { compact?: boolean; onChange?: () => void }) {
  const { t } = useI18n();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm(EMPTY);
    setShowForm(false);
    setSubmitting(false);
    fetchBooks();
  }

  async function deleteBook(id: number) {
    if (!confirm(t('profile.confirmRemove'))) return;
    await fetch(`/api/books/${id}`, { method: 'DELETE' });
    fetchBooks();
  }

  async function toggleAvailable(book: Book) {
    await fetch(`/api/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !book.available }),
    });
    fetchBooks();
  }

  function setTitle(title: string) {
    const match = findByTitle(title);
    setForm(prev => ({ ...prev, title, author: match?.author ?? prev.author }));
  }

  const addForm = showForm && (
    <form onSubmit={addBook} className="p-4 rounded-2xl flex flex-col gap-3 mb-4" style={{ background: compact ? '#0f0f1a' : '#1a1a2e', border: '1px solid #2d2d4a' }}>
      {!compact && <h3 className="font-bold text-white">{t('profile.addBookTitle')}</h3>}
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
      <div className="flex gap-2">
        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: '#2d2d4a', color: '#94a3b8' }}>
          {t('profile.cancel')}
        </button>
        <button type="submit" disabled={submitting} className="px-6 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          {submitting ? t('profile.adding') : t('profile.addBtn')}
        </button>
      </div>
    </form>
  );

  const addButton = (
    <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl font-semibold text-sm text-white"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
      {t('profile.addBook')}
    </button>
  );

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white">📚 {t('hub.myBooks')} <span className="text-slate-500 font-normal">({books.length})</span></h2>
          {addButton}
        </div>
        {addForm}
        {loading ? (
          <p className="text-sm text-slate-400">{t('profile.loading')}</p>
        ) : books.length === 0 ? (
          <p className="text-sm text-slate-400">{t('hub.noBooks')}</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[26rem] overflow-y-auto">
            {books.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: '#0f0f1a' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: b.cover_color }}>📖</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{b.title}</p>
                  <p className="text-xs text-slate-400 truncate">{b.author}</p>
                </div>
                {b.available ? (
                  <button onClick={() => deleteBook(b.id)} className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#3a1e1e', color: '#ef4444' }}>
                    {t('card.remove')}
                  </button>
                ) : (
                  <span className="text-xs flex-shrink-0" style={{ color: '#f59e0b' }}>⏳</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">{t('tabs.books')}</h2>
        {addButton}
      </div>
      {addForm}
      {loading ? (
        <div className="text-center py-20 text-slate-400">{t('profile.loading')}</div>
      ) : books.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-slate-400 text-lg">{t('profile.none')}</p>
          <p className="text-slate-500 text-sm mt-1">{t('profile.noneHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map(book => (
            <BookCard key={book.id} book={book} isOwner onDelete={() => deleteBook(book.id)} onToggleAvailable={() => toggleAvailable(book)} />
          ))}
        </div>
      )}
    </div>
  );
}
