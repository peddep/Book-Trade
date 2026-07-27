import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { getDb, ensureBookColumns } from '@/lib/db';

export const runtime = 'nodejs';

// Admin-only. Reports exactly what each metadata source says about one ISBN,
// so "the scan didn't fill anything in" can be answered with facts instead of
// guesses: is the key reaching the server, is Google answering, and does the
// book it returns actually carry an author and publisher.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const isbn = new URL(req.url).searchParams.get('isbn')?.replace(/[^0-9Xx]/g, '') ?? '';
  if (isbn.length !== 10 && isbn.length !== 13) {
    return NextResponse.json({ error: 'pass ?isbn=9786160447893' }, { status: 400 });
  }

  const key = process.env.GOOGLE_BOOKS_API_KEY ?? '';
  const out: Record<string, unknown> = {
    isbn,
    // Never echo the key itself — just enough to tell it apart from "unset"
    // and from a value that was pasted with quotes or whitespace around it.
    apiKey: {
      present: Boolean(key),
      length: key.length,
      looksWrapped: /^["' ]|["' ]$/.test(key),
      startsWithAIza: key.startsWith('AIza'),
    },
  };

  // 1. Our own data.
  try {
    await ensureBookColumns();
    const r = await getDb().execute({
      sql: 'SELECT id, title, author, publisher, cover_source FROM books WHERE isbn = ? LIMIT 3',
      args: [isbn],
    });
    out.localBooks = r.rows;
  } catch (e) {
    out.localBooks = { error: String(e) };
  }

  // 2. Google Books — the status code and the raw shape of what came back.
  const params = new URLSearchParams({ q: `isbn:${isbn}`, maxResults: '1', printType: 'books' });
  if (key) params.set('key', key);
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(body); } catch { /* not json */ }
    const info = parsed?.items?.[0]?.volumeInfo;
    out.google = {
      status: res.status,
      totalItems: parsed?.totalItems,
      // On failure this is the message that explains why (quota, location, key).
      errorMessage: parsed?.error?.message ?? null,
      // On success: which fields the entry actually carries. A Thai book is
      // often present but sparse, which looks identical to "not found" in the
      // form even though the request succeeded.
      volumeInfoKeys: info ? Object.keys(info) : null,
      title: info?.title ?? null,
      authors: info?.authors ?? null,
      publisher: info?.publisher ?? null,
      hasImageLinks: Boolean(info?.imageLinks),
    };
  } catch (e) {
    out.google = { error: String(e) };
  }

  // 3. Open Library, the fallback.
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { signal: AbortSignal.timeout(8000) });
    const d = res.ok ? await res.json() : null;
    out.openLibrary = { status: res.status, title: d?.title ?? null, publishers: d?.publishers ?? null };
  } catch (e) {
    out.openLibrary = { error: String(e) };
  }

  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
}
