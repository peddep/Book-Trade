import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface Lookup {
  title: string | null;
  author: string | null;
  coverUrl: string | null; // data URL, ready to store like an uploaded photo
}

const MAX_COVER_BYTES = 300_000;

// Downloads a cover image and inlines it as a data URL (same storage model as
// student-uploaded photos, so no external hotlinking).
async function fetchCoverAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    if (!type.startsWith('image/') || type.includes('svg')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_COVER_BYTES) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function lookupGoogle(query: string): Promise<Lookup | null> {
  const params = new URLSearchParams({
    q: query,
    maxResults: '1',
    printType: 'books',
    fields: 'items(volumeInfo(title,authors,imageLinks))',
  });
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) params.set('key', key);
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const d = await res.json();
    const info = d.items?.[0]?.volumeInfo;
    if (!info) return null;
    // Prefer a larger thumbnail; strip page-curl effect param.
    let img: string | null = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
    if (img) img = img.replace('http://', 'https://').replace('&edge=curl', '');
    return {
      title: typeof info.title === 'string' ? info.title : null,
      author: Array.isArray(info.authors) && info.authors.length ? info.authors[0] : null,
      coverUrl: img ? await fetchCoverAsDataUrl(img) : null,
    };
  } catch {
    return null;
  }
}

async function lookupOpenLibraryIsbn(isbn: string): Promise<Lookup | null> {
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const d = await res.json();
    const title = typeof d.title === 'string' ? d.title : null;
    const cover = await fetchCoverAsDataUrl(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`);
    return { title, author: null, coverUrl: cover };
  } catch {
    return null;
  }
}

// Looks up a book by ISBN (barcode scan) or by title, returning the official
// metadata + cover from Thai publishers' records on Google Books / Open Library.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isbn = searchParams.get('isbn')?.replace(/[^0-9Xx]/g, '') ?? '';
  const title = searchParams.get('title')?.trim() ?? '';

  if (isbn && (isbn.length === 10 || isbn.length === 13)) {
    const g = await lookupGoogle(`isbn:${isbn}`);
    if (g?.title) {
      // Fill a missing cover from Open Library if Google had none.
      if (!g.coverUrl) {
        const ol = await lookupOpenLibraryIsbn(isbn);
        if (ol?.coverUrl) g.coverUrl = ol.coverUrl;
      }
      return NextResponse.json({ found: true, ...g });
    }
    const ol = await lookupOpenLibraryIsbn(isbn);
    if (ol?.title) return NextResponse.json({ found: true, ...ol });
    return NextResponse.json({ found: false });
  }

  if (title.length >= 3) {
    const g = await lookupGoogle(`intitle:"${title}"`);
    if (g?.title) return NextResponse.json({ found: true, ...g });
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({ error: 'isbn or title required' }, { status: 400 });
}
