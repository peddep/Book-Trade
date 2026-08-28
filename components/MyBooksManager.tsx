'use client';

import { useState, useEffect, useCallback } from 'react';
import BookShelf from '@/components/BookShelf';
import TitleInput from '@/components/TitleInput';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useI18n } from '@/lib/i18n';
import { catalogTitleParts } from '@/lib/books-catalog';
import { fileToCoverDataUrl } from '@/lib/image';

import { SUBJECTS } from '@/lib/subjects';
const CONDITIONS = ['Like New', 'Good', 'Fair', 'Poor'];

type SortKey = 'recent' | 'price' | 'alpha';

interface Book {
  id: number;
  title: string;
  title_en?: string | null;
  author: string;
  subject?: string;
  grade_level?: string;
  condition: string;
  description?: string;
  cover_color: string;
  cover_url?: string | null;
  price?: number | null;
  volume?: string | null;
  publisher?: string | null;
  isbn?: string | null;
  cover_source?: string | null;
  created_at?: string;
  available: number;
}

const EMPTY = { title: '', title_en: '', price: '', volume: '', publisher: '', author: '', subject: '', grade_level: '', condition: 'Good', description: '', cover_url: '', cover_source: '', isbn: '' };

// Manages the user's books as a bookshelf (3-column scrollable grid). Tapping a
// book reveals its title and edit actions. `compact` is the Trade page's left
// panel; the full variant is the Your Books page.
export default function MyBooksManager({ compact = false, onChange }: { compact?: boolean; onChange?: () => void }) {
  const { t, bookTitle } = useI18n();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [sort, setSort] = useState<SortKey>('recent');
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  // Reported to the scanner so it can hold the camera on the barcode until the
  // lookup actually resolves, then either close, ask for a cover photo, or
  // resume scanning.
  const [scanStatus, setScanStatus] = useState<'idle' | 'looking' | 'foundCover' | 'foundNoCover' | 'notFound'>('idle');
  const [scanTitle, setScanTitle] = useState<string | null>(null);

  // Barcode scanned → look the ISBN up and fill in as much of the form as we
  // can: title, author, publisher, cover, tags, description and (for series)
  // the volume number parsed out of the title. Checked against books already
  // listed on the site first, then the book APIs.
  async function onIsbn(isbn: string) {
    setScanMsg(t('scan.looking'));
    setScanStatus('looking');
    setScanTitle(null);
    try {
      const res = await fetch(`/api/book-lookup?isbn=${isbn}`);
      const d = await res.json();
      if (!d.found || !d.title) {
        setScanStatus('notFound');
        setScanMsg(d.blocked ? t('scan.blocked') : t('scan.notFound'));
        return;
      }
      // Remember the barcode, so the next student who scans this book is
      // answered from our own database.
      setForm(prev => ({ ...prev, isbn }));
      setScanTitle(String(d.title));
      setScanStatus(d.coverUrl ? 'foundCover' : 'foundNoCover');

      // "One Piece, Vol. 12" / "วันพีซ เล่ม 12" → volume 12
      const volMatch = String(d.title).match(/(?:vol\.?|volume|เล่ม(?:ที่)?)\s*(\d+)/i);
      const tags: string[] = Array.isArray(d.categories) ? d.categories : [];
      const thai = /[฀-๿]/.test(String(d.title));

      setForm(prev => ({
        ...prev,
        title: d.title,
        // A Latin-script result doubles as the English title.
        title_en: prev.title_en || (thai ? '' : d.title),
        author: d.author ?? prev.author,
        publisher: d.publisher ?? prev.publisher,
        volume: prev.volume || (volMatch ? volMatch[1] : ''),
        subject: prev.subject || tags.join(','),
        description: prev.description || (d.description ?? ''),
        price: prev.price || (d.price != null ? String(d.price) : ''),
        cover_url: d.coverUrl ?? prev.cover_url,
        cover_source: d.coverUrl ? 'api' : prev.cover_source,
      }));

      // Tell the student what was filled so they only complete the rest.
      const filled = [
        d.author && t('profile.fAuthor'),
        d.publisher && t('profile.fPublisher'),
        d.price != null && t('profile.fPrice'),
        d.coverUrl && t('scan.gotCover'),
        tags.length > 0 && t('profile.fSubject'),
      ].filter(Boolean) as string[];
      const via = d.source === 'local' ? ` ${t('scan.fromSite')}` : '';
      setScanMsg(`✓ ${d.title}${filled.length ? ` — ${t('scan.filled', { fields: filled.join(', ') })}` : ''}${via}`);
    } catch {
      setScanStatus('notFound');
      setScanMsg(t('scan.notFound'));
    }
  }

  // When a title is chosen and no cover has been set, quietly try to fetch the
  // official cover (and author) for that title from the book APIs.
  useEffect(() => {
    if (!showForm || editingId || !form.title.trim() || form.title.trim().length < 3 || form.cover_url) return;
    const title = form.title.trim();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/book-lookup?title=${encodeURIComponent(title)}`);
        const d = await res.json();
        if (!d.found) return;
        setForm(prev => {
          // The student may have typed on or added their own photo meanwhile.
          if (prev.title.trim() !== title || prev.cover_url) return prev;
          return {
            ...prev,
            cover_url: d.coverUrl ?? prev.cover_url,
            cover_source: d.coverUrl ? 'api' : prev.cover_source,
            author: prev.author || (d.author ?? ''),
            publisher: prev.publisher || (d.publisher ?? ''),
            subject: prev.subject || (Array.isArray(d.categories) ? d.categories.join(',') : ''),
          };
        });
      } catch { /* best-effort */ }
    }, 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, form.cover_url, showForm, editingId]);

  // Sorted view of the books for display.
  const sortedBooks = [...books].sort((a, b) => {
    if (sort === 'price') {
      const pa = a.price ?? Infinity; // no-price goes last
      const pb = b.price ?? Infinity;
      return pa - pb;
    }
    if (sort === 'alpha') {
      return bookTitle(a.title, a.title_en).localeCompare(bookTitle(b.title, b.title_en), undefined, { numeric: true });
    }
    // recent: newest first (fall back to id if no timestamp)
    if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at);
    return b.id - a.id;
  });

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
          title: form.title, title_en: form.title_en, price: form.price, volume: form.volume, publisher: form.publisher, author: form.author, subject: form.subject,
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
    setScanMsg('');
    setScanStatus('idle');
    setScanTitle(null);
  }

  function startEdit(id: number) {
    const b = books.find(x => x.id === id);
    if (!b) return;
    setForm({
      title: b.title, title_en: b.title_en ?? '', price: b.price != null ? String(b.price) : '', volume: b.volume ?? '', publisher: b.publisher ?? '', author: b.author, subject: b.subject ?? '', grade_level: b.grade_level ?? '',
      condition: b.condition, description: b.description ?? '', cover_url: b.cover_url ?? '',
      cover_source: b.cover_source ?? '', isbn: b.isbn ?? '',
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
    // Optimistic update: flip locally so the shelf doesn't reload/flicker.
    setBooks(prev => prev.map(b => (b.id === id ? { ...b, available: next ? 1 : 0 } : b)));
    try {
      const res = await fetch(`/api/books/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure.
      setBooks(prev => prev.map(b => (b.id === id ? { ...b, available: next ? 0 : 1 } : b)));
    }
  }

  // Single title box (Thai-first). When the input matches a known book —
  // including its English name — swap in the Thai main title and keep the
  // English name + author behind the scenes.
  function setTitle(title: string) {
    const parts = catalogTitleParts(title);
    setForm(prev => ({
      ...prev,
      title: parts?.th ?? title,
      author: parts?.author ?? prev.author,
      title_en: parts?.en ?? prev.title_en,
    }));
  }

  async function onPickCover(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToCoverDataUrl(file);
      setForm(prev => ({ ...prev, cover_url: dataUrl, cover_source: 'upload' }));
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
    <form onSubmit={submitBook} className="p-4 rounded-2xl flex flex-col gap-3 mb-4" style={{ background: compact ? '#ffffff' : '#ffffff', border: '1px solid #e9d5ff' }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-[#2e1065]">{editingId ? t('profile.editBookTitle') : t('profile.addBookTitle')}</h3>
        {!editingId && (
          <button type="button" onClick={() => { setScanMsg(''); setScanStatus('idle'); setScanTitle(null); setScanning(true); }}
            className="px-3 py-1.5 rounded-full text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
            📷 {t('scan.button')}
          </button>
        )}
      </div>
      {scanMsg && <p className="text-xs font-semibold" style={{ color: scanMsg.startsWith('✓') ? '#10b981' : '#7c3aed' }}>{scanMsg}</p>}
      {/* Which book is this? Title first, then the details a scan fills in. */}
      <div className={compact ? 'flex flex-col gap-3' : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'}>
        <div className={compact ? '' : 'sm:col-span-2'}>
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('profile.fTitleTh')} *</label>
              <TitleInput value={form.title} onChange={setTitle}
                onMeta={m => setForm(prev => ({ ...prev, author: m.author || prev.author, publisher: m.publisher || prev.publisher }))}
                placeholder={t('profile.fTitlePlaceholder')} listId="mybooks-title-suggestions" required />
            </div>
            {/* Volume sits with the title — together they name the book */}
            <div className="w-20 sm:w-24 flex-shrink-0">
              <label className="text-sm text-[#4b5563] mb-1.5 block">{t('profile.fVolume')}</label>
              <input value={form.volume} maxLength={20} inputMode="numeric"
                onChange={e => setForm({ ...form, volume: e.target.value })}
                className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
                placeholder="1" />
            </div>
          </div>
        </div>
        <div>
          <label className="text-sm text-[#4b5563] mb-1.5 block">{t('profile.fAuthor')}</label>
          <input value={form.author} maxLength={120}
            onChange={e => setForm({ ...form, author: e.target.value })}
            className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
            placeholder={t('profile.fAuthorPlaceholder')} />
          <p className="text-xs text-[#9ca3af] mt-1">{t('profile.fAuthorHint')}</p>
        </div>
        <div>
          <label className="text-sm text-[#4b5563] mb-1.5 block">{t('profile.fPublisher')}</label>
          <input value={form.publisher} maxLength={120}
            onChange={e => setForm({ ...form, publisher: e.target.value })}
            className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
            placeholder={t('profile.fPublisherPlaceholder')} />
        </div>

        {/* Your particular copy — the two things no lookup can know */}
        <div>
          <label className="text-sm text-[#4b5563] mb-1.5 block">{t('profile.fCondition')}</label>
          <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}
            className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}>
            {CONDITIONS.map(c => <option key={c} value={c}>{t(`cond.${c}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-[#4b5563] mb-1.5 block">{t('profile.fPrice')}{!editingId && ' *'}</label>
          <input type="number" min="0" step="1" inputMode="numeric" required={!editingId} value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
            className="w-full p-2.5 rounded-xl text-sm" style={{ background: '#ffffff', border: '1px solid #e9d5ff', color: '#2e1065', outline: 'none' }}
            placeholder={t('profile.fPricePlaceholder')} />
        </div>
      </div>

      {/* Cover upload — only when adding; existing books change cover from the shelf */}
      {!editingId && (
        <div>
          <label className="text-sm text-[#4b5563] mb-1.5 block">{t('profile.cover')}</label>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: '#e9d5ff' }}>
              {form.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">📖</span>
              )}
            </div>
            <label className="px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: '#e9d5ff', color: '#2e1065' }}>
              {form.cover_url ? t('profile.changeCover') : t('profile.addCover')}
              <input type="file" accept="image/*" className="hidden" onChange={e => onPickCover(e.target.files?.[0])} />
            </label>
            {form.cover_url && (
              <button type="button" onClick={() => setForm(prev => ({ ...prev, cover_url: '' }))} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#fee2e2', color: '#ef4444' }}>
                {t('profile.removeCover')}
              </button>
            )}
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: '#9ca3af' }}>{t('profile.coverHint')}</p>
        </div>
      )}

      {/* Tags last: helpful for browsing but rarely edited, and the chip list is
          tall enough to push everything else off the screen if it sits higher. */}
      <div>
        <label className="text-sm text-[#4b5563] mb-1.5 block">{t('profile.fSubject')}</label>
        {/* Multi-select tag chips; stored as a comma-separated list */}
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl max-h-36 overflow-y-auto"
          style={{ background: '#ffffff', border: '1px solid #e9d5ff' }}>
          {SUBJECTS.map(s => {
            const selected = form.subject.split(',').filter(Boolean).includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const tags = form.subject.split(',').filter(Boolean);
                  const next = selected ? tags.filter(x => x !== s) : [...tags, s];
                  setForm({ ...form, subject: next.join(',') });
                }}
                className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
                style={selected
                  ? { background: '#7c3aed', color: '#ffffff', border: '1px solid #7c3aed' }
                  : { background: '#faf5ff', color: '#6b7280', border: '1px solid #e9d5ff' }}
              >
                {selected ? '✓ ' : ''}{t(`subj.${s}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={closeForm} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: '#e9d5ff', color: '#6b7280' }}>
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
    <p className="text-sm text-[#6b7280]">{t('profile.loading')}</p>
  ) : books.length === 0 ? (
    <div className={compact ? '' : 'text-center py-16'}>
      {!compact && <div className="text-5xl mb-4">📚</div>}
      <p className="text-[#6b7280]">{compact ? t('hub.noBooks') : t('profile.none')}</p>
      {!compact && <p className="text-[#9ca3af] text-sm mt-1">{t('profile.noneHint')}</p>}
    </div>
  ) : (
    <BookShelf
      books={sortedBooks}
      onEdit={startEdit}
      onDelete={deleteBook}
      onToggleAvailable={toggleAvailable}
      onChangeCover={changeCover}
      // Your books and the books you are browsing are the same kind of thing,
      // so they get the same shelf: the same columns at the same widths, and
      // the page scrolling rather than a shelf-sized window scrolling inside
      // it, which is what made the two pages feel unrelated on a big screen.
      maxHeight={compact ? '70vh' : 'none'}
      gridClass={compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10'}
    />
  );

  // Sort selector (segmented buttons).
  const sortControl = books.length > 1 && (
    <div className="flex items-center gap-1.5 flex-wrap mb-4">
      <span className="text-xs text-[#9ca3af] mr-1">{t('sort.by')}:</span>
      {(['recent', 'price', 'alpha'] as SortKey[]).map(k => (
        <button
          key={k}
          onClick={() => setSort(k)}
          className="px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
          style={sort === k
            ? { background: '#7c3aed', color: '#ffffff' }
            : { background: '#ede9fe', color: '#7c3aed' }}
        >
          {t(`sort.${k}`)}
        </button>
      ))}
    </div>
  );

  const scanner = scanning && (
    <BarcodeScanner
      onDetected={onIsbn}
      onClose={() => setScanning(false)}
      status={scanStatus}
      foundTitle={scanTitle}
      // The student's own photo of the front cover — kept on their listing only.
      onCapture={dataUrl => setForm(prev => ({ ...prev, cover_url: dataUrl, cover_source: 'camera' }))}
    />
  );

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[#2e1065]">📚 {t('hub.myBooks')} <span className="text-[#9ca3af] font-normal">({books.length})</span></h2>
          {addButton}
        </div>
        {bookForm}
        {sortControl}
        {shelf}
        {scanner}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#2e1065]">{t('tabs.books')}</h2>
        {addButton}
      </div>
      {bookForm}
      {sortControl}
      <div className="max-w-md sm:max-w-none">{shelf}</div>
      {scanner}
    </div>
  );
}
