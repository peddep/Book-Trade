import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface Suggestion {
  title: string;
  author: string;
}

const THAI_SCRIPT = /[฀-๿]/;

// Open Library: no key, no quota. Thin Thai coverage, good English coverage.
async function searchOpenLibrary(q: string, thai: boolean): Promise<Suggestion[]> {
  const query = thai ? `${q} language:tha` : q;
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=title,author_name`;
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
    out.push({ title, author });
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
    fields: 'items(volumeInfo(title,authors))',
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
    out.push({ title, author });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ books: [] });

  const thai = THAI_SCRIPT.test(q);

  // Thai input: Google Books (Thai-restricted) is the primary source, Open
  // Library the backup. English input: Open Library alone is plenty.
  const sources: Promise<Suggestion[]>[] = thai
    ? [searchGoogleBooks(q), searchOpenLibrary(q, true)]
    : [searchOpenLibrary(q, false)];

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
