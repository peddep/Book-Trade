import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface Lookup {
  title: string | null;
  author: string | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  coverUrl: string | null; // data URL, ready to store like an uploaded photo
}

// Maps Google Books categories / title hints onto our own tag list.
const CATEGORY_TAGS: [RegExp, string][] = [
  [/comic|graphic novel|manga/i, 'Comics'],
  [/juvenile fiction|young adult/i, 'Novel'],
  [/fiction/i, 'Novel'],
  [/fantasy/i, 'Fantasy'],
  [/science fiction/i, 'Sci-Fi'],
  [/mystery|detective/i, 'Mystery'],
  [/horror/i, 'Horror'],
  [/romance|love/i, 'Romance'],
  [/humor|comedy/i, 'Comedy'],
  [/drama/i, 'Drama'],
  [/adventure/i, 'Adventure'],
  [/poetry/i, 'Poetry'],
  [/biography|autobiography/i, 'Biography'],
  [/self-help|self improvement/i, 'Self-Improvement'],
  [/psychology/i, 'Psychology'],
  [/philosophy/i, 'Philosophy'],
  [/religion/i, 'Religion'],
  [/business|economics/i, 'Business'],
  [/travel/i, 'Travel'],
  [/cook/i, 'Cooking'],
  [/sport/i, 'Sports'],
  [/health|medical/i, 'Health'],
  [/nature|science/i, 'Science'],
  [/technology|computer/i, 'Technology'],
  [/mathematic/i, 'Math'],
  [/history/i, 'History'],
  [/art/i, 'Art'],
  [/music/i, 'Music'],
  [/language|english/i, 'English'],
  [/education|study|textbook/i, 'Textbook'],
];

function toTags(categories: unknown): string[] {
  if (!Array.isArray(categories)) return [];
  const out = new Set<string>();
  for (const c of categories) {
    if (typeof c !== 'string') continue;
    for (const [re, tag] of CATEGORY_TAGS) {
      if (re.test(c)) { out.add(tag); break; }
    }
  }
  return [...out].slice(0, 4);
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
    fields: 'items(volumeInfo(title,authors,publisher,description,categories,imageLinks))',
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
    const desc = typeof info.description === 'string' ? info.description.trim().slice(0, 500) : null;
    return {
      title: typeof info.title === 'string' ? info.title : null,
      author: Array.isArray(info.authors) && info.authors.length ? info.authors[0] : null,
      publisher: typeof info.publisher === 'string' ? info.publisher : null,
      description: desc,
      categories: toTags(info.categories),
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
    const publishers = Array.isArray(d.publishers) && d.publishers.length ? String(d.publishers[0]) : null;
    return { title, author: null, publisher: publishers, description: null, categories: [], coverUrl: cover };
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
      // Top up anything Google was missing (cover / publisher) from Open Library.
      if (!g.coverUrl || !g.publisher) {
        const ol = await lookupOpenLibraryIsbn(isbn);
        if (ol) {
          g.coverUrl = g.coverUrl ?? ol.coverUrl;
          g.publisher = g.publisher ?? ol.publisher;
        }
      }
      return NextResponse.json({ found: true, isbn, ...g });
    }
    const ol = await lookupOpenLibraryIsbn(isbn);
    if (ol?.title) return NextResponse.json({ found: true, isbn, ...ol });
    return NextResponse.json({ found: false });
  }

  if (title.length >= 3) {
    const g = await lookupGoogle(`intitle:"${title}"`);
    if (g?.title) return NextResponse.json({ found: true, ...g });
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({ error: 'isbn or title required' }, { status: 400 });
}
