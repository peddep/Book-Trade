import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Proxies the public Open Library search API (no key / no quota) so the
// Add Book title field can suggest real titles. On any failure it returns an
// empty list and the client falls back to the built-in catalog.
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ books: [] });

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=title,author_name`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BookTrade/1.0 (student book trading app)' },
      signal: AbortSignal.timeout(6000),
      // Cache identical queries at the edge for a day to be kind to the API.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ books: [] });

    const data = await res.json();
    const seen = new Set<string>();
    const books: { title: string; author: string }[] = [];
    for (const doc of data.docs ?? []) {
      const title = typeof doc.title === 'string' ? doc.title.trim() : '';
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const author = Array.isArray(doc.author_name) && doc.author_name.length ? doc.author_name[0] : '';
      books.push({ title, author });
      if (books.length >= 8) break;
    }
    return NextResponse.json({ books });
  } catch {
    return NextResponse.json({ books: [] });
  }
}
