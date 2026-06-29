'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BookCard from '@/components/BookCard';

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

interface User {
  id: number;
  name: string;
  email: string;
  grade: string | null;
  avatar_color: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', author: '', subject: '', grade_level: '', condition: 'Good', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login'); return; }
      setUser(d.user);
    });
    fetchBooks();
  }, [router]);

  async function fetchBooks() {
    setLoading(true);
    const res = await fetch('/api/books?mine=1');
    const data = await res.json();
    setBooks(data.books ?? []);
    setLoading(false);
  }

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', author: '', subject: '', grade_level: '', condition: 'Good', description: '' });
    setShowForm(false);
    setSubmitting(false);
    fetchBooks();
  }

  async function deleteBook(id: number) {
    if (!confirm('Remove this book?')) return;
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

  if (!user) return null;

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-8 p-6 rounded-2xl" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background: user.avatar_color }}
          >
            {user.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{user.name}</h1>
            <p className="text-slate-400 text-sm">{user.email}</p>
            {user.grade && <p className="text-sm mt-0.5" style={{ color: '#a78bfa' }}>Grade {user.grade}</p>}
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold text-white">{books.length}</p>
            <p className="text-xs text-slate-400">Books Listed</p>
          </div>
        </div>

        {/* Add book */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">My Books</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl font-semibold text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            + Add Book
          </button>
        </div>

        {showForm && (
          <form onSubmit={addBook} className="mb-8 p-6 rounded-2xl flex flex-col gap-4" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
            <h3 className="font-bold text-white">Add a Book to Trade</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                  placeholder="Book title"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Author *</label>
                <input
                  required
                  value={form.author}
                  onChange={e => setForm({ ...form, author: e.target.value })}
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                  placeholder="Author name"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Subject</label>
                <select
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: form.subject ? '#e2e8f0' : '#64748b', outline: 'none' }}
                >
                  <option value="">Select subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Condition</label>
                <select
                  value={form.condition}
                  onChange={e => setForm({ ...form, condition: e.target.value })}
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                >
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Grade Level</label>
                <input
                  value={form.grade_level}
                  onChange={e => setForm({ ...form, grade_level: e.target.value })}
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                  placeholder="e.g. 9, 10-12, All"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Description</label>
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl text-sm"
                  style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
                  placeholder="Any notes about the book"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: '#2d2d4a', color: '#94a3b8' }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-6 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {submitting ? 'Adding...' : 'Add Book'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading your books...</div>
        ) : books.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-slate-400 text-lg">No books listed yet</p>
            <p className="text-slate-500 text-sm mt-1">Add books you want to trade!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {books.map(book => (
              <BookCard
                key={book.id}
                book={book}
                isOwner
                onDelete={() => deleteBook(book.id)}
                onToggleAvailable={() => toggleAvailable(book)}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
