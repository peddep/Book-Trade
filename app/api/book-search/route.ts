import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface Suggestion {
  title: string;
  author: string;
  publisher: string;
}

const THAI_SCRIPT = /[฀-๿]/;

let catalogEnsured = false;

// Searches our own database: the harvested Thai catalog plus titles students
// have already listed on the site. Instant and quota-free.
async function searchLocalDb(q: string): Promise<Suggestion[]> {
  try {
    const db = getDb();
    if (!catalogEnsured) {
      await db.execute(`CREATE TABLE IF NOT EXISTS catalog_books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        author TEXT,
        publisher TEXT,
        source TEXT DEFAULT 'harvest',
        created_at TEXT DEFAULT (datetime('now'))
      )`);
      catalogEnsured = true;
    }
    const like = `%${q}%`;
    // The publisher is already stored on both tables — carry it through so
    // picking a suggestion fills that box too instead of re-asking an API.
    const [catalog, listed] = await Promise.all([
      db.execute({ sql: 'SELECT title, author, publisher FROM catalog_books WHERE title LIKE ? LIMIT 8', args: [like] }),
      db.execute({ sql: 'SELECT DISTINCT title, author, publisher FROM books WHERE title LIKE ? LIMIT 4', args: [like] })
        .catch(() => ({ rows: [] as Record<string, unknown>[] })),
    ]);
    const out: Suggestion[] = [];
    for (const row of [...listed.rows, ...catalog.rows]) {
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      if (!title) continue;
      out.push({
        title,
        author: typeof row.author === 'string' ? row.author : '',
        publisher: typeof row.publisher === 'string' ? row.publisher : '',
      });
    }
    return out;
  } catch {
    return [];
  }
}

// Open Library: no key, no quota. Thin Thai coverage, good English coverage.
async function searchOpenLibrary(q: string, thai: boolean): Promise<Suggestion[]> {
  const query = thai ? `${q} language:tha` : q;
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=title,author_name,publisher`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BookTrade/1.0 (student book trading app)' },
    signal: AbortSignal.timeout(6000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const out: Suggestion[] = [];
  for (const doc of data.docs ?? []) {
    const title = typeof doc.title === 'string' ? doc.title.trim() : '';
    if (!title) continue;
    const author = Array.isArray(doc.author_name) && doc.author_name.length ? doc.author_name[0] : '';
    const publisher = Array.isArray(doc.publisher) && doc.publisher.length ? String(doc.publisher[0]) : '';
    out.push({ title, author, publisher });
  }
  return out;
}

// Google Books: much better Thai coverage (Thai publishers + translations).
// Queried only for Thai-script input to conserve the free quota. An optional
// GOOGLE_BOOKS_API_KEY env var raises the quota but is not required.
async function searchGoogleBooks(q: string): Promise<Suggestion[]> {
  const params = new URLSearchParams({
    q,
    langRestrict: 'th',
    maxResults: '8',
    printType: 'books',
    // Google thins or refuses results for callers it cannot geolocate, which
    // includes datacenter IPs like Vercel's.
    country: 'TH',
    fields: 'items(volumeInfo(title,authors,publisher))',
  });
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) params.set('key', key);
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, {
    signal: AbortSignal.timeout(6000),
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const out: Suggestion[] = [];
  for (const item of data.items ?? []) {
    const info = item.volumeInfo ?? {};
    const title = typeof info.title === 'string' ? info.title.trim() : '';
    if (!title) continue;
    const author = Array.isArray(info.authors) && info.authors.length ? info.authors[0] : '';
    out.push({ title, author, publisher: typeof info.publisher === 'string' ? info.publisher : '' });
  }
  return out;
}

export async function GET(req: NextRequest) {
  // Sign-in required: the local half of these suggestions is drawn from books
  // students have listed, and it is only ever called from the add-book form.
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ books: [] });

  const thai = THAI_SCRIPT.test(q);

  // Our own database first (harvested Thai catalog + titles already listed on
  // the site) — instant and quota-free. External APIs fill in the rest:
  // Thai input prefers Google Books (Thai-restricted); English uses Open Library.
  const sources: Promise<Suggestion[]>[] = thai
    ? [searchLocalDb(q), searchGoogleBooks(q), searchOpenLibrary(q, true)]
    : [searchLocalDb(q), searchOpenLibrary(q, false)];

  const settled = await Promise.allSettled(sources);

  const seen = new Set<string>();
  const books: Suggestion[] = [];
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    for (const b of result.value) {
      const key = b.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      books.push(b);
      if (books.length >= 10) break;
    }
    if (books.length >= 10) break;
  }

  return NextResponse.json({ books });
}
