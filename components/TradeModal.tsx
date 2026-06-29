'use client';

import { useState, useEffect } from 'react';

interface Book {
  id: number;
  title: string;
  author: string;
  cover_color: string;
}

interface Props {
  targetBook: Book;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TradeModal({ targetBook, onClose, onSuccess }: Props) {
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/books?mine=1')
      .then(r => r.json())
      .then(d => setMyBooks(d.books.filter((b: any) => b.available)));
  }, []);

  async function submit() {
    if (!selectedBook) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offered_book_id: selectedBook, wanted_book_id: targetBook.id, message }),
    });
    const data = await res.json();
    if (res.ok) {
      onSuccess();
    } else {
      setError(data.error ?? 'Something went wrong');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
        <div className="flex justify-between items-start">
          <h2 className="text-lg font-bold text-white">Offer a Trade</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#0f0f1a' }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: targetBook.cover_color }}>📖</div>
          <div>
            <p className="text-xs text-slate-400">You want</p>
            <p className="font-semibold text-white text-sm">{targetBook.title}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-300 mb-2">Offer one of your books:</p>
          {myBooks.length === 0 ? (
            <p className="text-sm text-slate-400">You have no available books to offer. Add some books first!</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {myBooks.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBook(b.id)}
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors text-left"
                  style={{
                    background: selectedBook === b.id ? '#2d1e5a' : '#0f0f1a',
                    border: `1px solid ${selectedBook === b.id ? '#8b5cf6' : '#2d2d4a'}`
                  }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: b.cover_color }}>📖</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{b.title}</p>
                    <p className="text-xs text-slate-400">{b.author}</p>
                  </div>
                  {selectedBook === b.id && <span className="ml-auto text-purple-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-300 mb-1">Message (optional)</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Hey, I'd love to trade! My book is in great shape..."
            className="w-full text-sm p-2.5 rounded-xl resize-none"
            style={{ background: '#0f0f1a', border: '1px solid #2d2d4a', color: '#e2e8f0', outline: 'none' }}
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl font-semibold text-sm"
            style={{ background: '#2d2d4a', color: '#94a3b8' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!selectedBook || loading}
            className="flex-1 py-2 rounded-xl font-semibold text-sm text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {loading ? 'Sending...' : 'Send Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}
