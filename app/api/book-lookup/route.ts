import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb, ensureBookColumns } from '@/lib/db';
import { inferTags } from '@/lib/book-tags';

export const runtime = 'nodejs';

interface Lookup {
  title: string | null;
  author: string | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  price: number | null; // list price, only when the API reports it in THB
  coverUrl: string | null; // data URL, ready to store like an uploaded photo
}

// Set when an upstream API refused the request (quota/rate limit) rather than
// genuinely not having the book — the two need different messages.
let lastCallBlocked = false;

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
// Google and Open Library both answer "no cover for this book" with a valid
// placeholder image — a mostly-white panel reading "Image not available" —
// rather than a 404. Those compress to a couple of KB, where real cover art is
// photographic and lands well above this. Anything smaller is treated as a
// miss, which sends the student to the camera step instead of pasting a
// placeholder onto their listing.
const MIN_COVER_BYTES = 4_000;

// Downloads a cover image and inlines it as a data URL (same storage model as
// student-uploaded photos, so no external hotlinking).
async function fetchCoverAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    // Cover art from these APIs is always JPEG or PNG; the placeholders are
    // served as GIFs in some regions.
    if (!type.startsWith('image/') || /svg|gif/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_COVER_BYTES || buf.length > MAX_COVER_BYTES) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Tries each candidate in turn and keeps the first that yields a real image.
async function fetchFirstCover(urls: (string | null | undefined)[]): Promise<string | null> {
  for (const url of urls) {
    if (!url) continue;
    const data = await fetchCoverAsDataUrl(url);
    if (data) return data;
  }
  return null;
}

// Cover URLs to try, in order. `imageLinks` is Google's own statement that a
// cover exists, so it gates the whole thing: asking the cover host for a volume
// with no imageLinks does not find a missing picture, it just returns the
// "Image not available" placeholder. The host is only used to fetch a larger
// rendering of a cover Google has already said it has.
function googleCoverCandidates(volumeId: string | null, imageLinks: any): (string | null)[] {
  const fromLinks = (imageLinks?.thumbnail ?? imageLinks?.smallThumbnail ?? null) as string | null;
  if (!fromLinks) return [];
  const cleaned = fromLinks.replace('http://', 'https://').replace('&edge=curl', '');
  if (!volumeId) return [cleaned];
  const base = `https://books.google.com/books/content?id=${encodeURIComponent(volumeId)}&printsec=frontcover&img=1&source=gbs_api`;
  // zoom=1 is the standard cover size, and is larger than the thumbnail URL.
  return [`${base}&zoom=1`, cleaned];
}

// Looks the book up in data we already own: books other students have listed,
// plus the harvested Thai catalog. Instant, quota-free, and it keeps working
// when the upstream APIs refuse us — which is the normal case without an API
// key. The more the school lists, the better this gets.
async function lookupLocal(by: { isbn?: string; title?: string }): Promise<Lookup | null> {
  try {
    await ensureBookColumns();
    const db = getDb();

    // A previously scanned copy of the same barcode is the best match; failing
    // that, an exact title match. Prefer rows that carry the most information.
    const listed = by.isbn
      ? await db.execute({
          sql: `SELECT title, title_en, author, publisher, subject, cover_url, cover_source FROM books
                WHERE isbn = ? ORDER BY (cover_url IS NOT NULL) DESC, id DESC LIMIT 1`,
          args: [by.isbn],
        })
      : await db.execute({
          sql: `SELECT title, title_en, author, publisher, subject, cover_url, cover_source FROM books
                WHERE lower(title) = lower(?) ORDER BY (cover_url IS NOT NULL) DESC, id DESC LIMIT 1`,
          args: [by.title ?? ''],
        });

    const row = listed.rows[0];
    // Harvested catalog: title/author/publisher only, no cover.
    const title = row ? String(row.title) : by.title ?? '';
    const cat = title
      ? await db.execute({
          sql: 'SELECT author, publisher FROM catalog_books WHERE lower(title) = lower(?) LIMIT 1',
          args: [title],
        }).catch(() => ({ rows: [] as Record<string, unknown>[] }))
      : { rows: [] as Record<string, unknown>[] };
    const catRow = cat.rows[0];

    if (!row && !catRow) return null;

    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    // Which covers may appear on another student's listing. A camera capture
    // qualifies because it comes from a flow that asks for the front cover and
    // crops to a cover-shaped frame — it is a picture of the book. A plain
    // upload is an arbitrary file from the student's gallery and stays private
    // to their own listing.
    const SHAREABLE_COVERS = new Set(['api', 'camera', 'admin']);
    const reusableCover = row && SHAREABLE_COVERS.has(String(row.cover_source)) ? str(row.cover_url) : null;
    const tags = str(row?.subject)?.split(',').map(s => s.trim()).filter(Boolean) ?? [];

    return {
      title: title || null,
      author: str(row?.author) ?? str(catRow?.author),
      publisher: str(row?.publisher) ?? str(catRow?.publisher),
      description: null,
      categories: tags.slice(0, 4),
      price: null, // another student's asking price is theirs, not a list price
      coverUrl: reusableCover,
    };
  } catch {
    return null;
  }
}

// True when the local hit is thin enough that it's still worth asking an API
// to top it up (the APIs can add a cover, description and price).
function localIsComplete(l: Lookup): boolean {
  return Boolean(l.title && l.author && l.publisher && l.coverUrl && l.categories.length);
}

function googleKeyParam(): string {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  return key ? `&key=${encodeURIComponent(key)}` : '';
}

// A search hit carries an abbreviated volumeInfo — for Thai books it very often
// has the title and nothing else. The single-volume endpoint returns the full
// record, which frequently does have the author and publisher.
async function fetchGoogleVolumeInfo(id: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}?country=TH${googleKeyParam()}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) {
      if (res.status === 429 || res.status === 403) lastCallBlocked = true;
      return null;
    }
    return (await res.json())?.volumeInfo ?? null;
  } catch {
    return null;
  }
}

async function lookupGoogle(query: string): Promise<Lookup | null> {
  const params = new URLSearchParams({
    q: query,
    maxResults: '1',
    printType: 'books',
    // Google refuses or silently thins results for callers it cannot geolocate,
    // which includes datacenter IPs like Vercel's.
    country: 'TH',
    // `id` lets us re-fetch the full record when the summary is thin.
    // saleInfo carries the publisher's list price when Google has it.
    fields: 'items(id,volumeInfo(title,authors,publisher,description,categories,imageLinks),saleInfo(listPrice,retailPrice))',
  });
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) params.set('key', key);
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      // 429 = quota/rate limit (very common without an API key), 403 = blocked.
      if (res.status === 429 || res.status === 403) lastCallBlocked = true;
      return null;
    }
    const d = await res.json();
    const item = d.items?.[0];
    let info = item?.volumeInfo;
    if (!info) return null;
    // Thin summary → ask for the full record and use whichever fields it adds.
    const volumeId: string | null = typeof item?.id === 'string' ? item.id : null;
    const thin = !info.authors?.length || !info.publisher || !info.categories?.length || !info.imageLinks;
    if (volumeId && thin) {
      const full = await fetchGoogleVolumeInfo(volumeId);
      if (full) {
        info = {
          ...full,
          ...info,
          authors: info.authors ?? full.authors,
          publisher: info.publisher ?? full.publisher,
          categories: info.categories ?? full.categories,
          imageLinks: info.imageLinks ?? full.imageLinks,
        };
      }
    }
    const desc = typeof info.description === 'string' ? info.description.trim().slice(0, 500) : null;
    // Only trust a price the API reports in baht — converting currencies would
    // put a misleading number in the student's price box.
    const sale = item?.saleInfo ?? {};
    const p = sale.retailPrice ?? sale.listPrice;
    const price = p && p.currencyCode === 'THB' && Number(p.amount) > 0 ? Math.round(Number(p.amount)) : null;
    return {
      title: typeof info.title === 'string' ? info.title : null,
      author: Array.isArray(info.authors) && info.authors.length ? info.authors[0] : null,
      publisher: typeof info.publisher === 'string' ? info.publisher : null,
      description: desc,
      categories: toTags(info.categories),
      price,
      // Fall back to Google's cover host, which answers for a volume id even
      // when the JSON carried no imageLinks.
      coverUrl: await fetchFirstCover(googleCoverCandidates(volumeId, info.imageLinks)),
    };
  } catch {
    return null;
  }
}

async function lookupOpenLibraryIsbn(isbn: string): Promise<Lookup | null> {
  try {
    // jscmd=data resolves author and publisher *names* in a single request.
    // The /isbn/{isbn}.json record this used to call holds only /authors/OL…A
    // references, so it could never produce an author name at all.
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      { headers: { 'User-Agent': 'BookTrade/1.0 (student book trading app)' }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const d = (await res.json())?.[`ISBN:${isbn}`];
    if (!d) return null;
    const firstName = (arr: unknown): string | null => {
      if (!Array.isArray(arr) || !arr.length) return null;
      const n = (arr[0] as Record<string, unknown> | undefined)?.name;
      return typeof n === 'string' && n.trim() ? n.trim() : null;
    };
    return {
      title: typeof d.title === 'string' ? d.title : null,
      author: firstName(d.authors),
      publisher: firstName(d.publishers),
      description: null,
      categories: [],
      price: null,
      // default=false makes the cover host 404 instead of returning its grey
      // placeholder, so a miss stays a miss.
      coverUrl: await fetchFirstCover([
        d.cover?.large, d.cover?.medium, d.cover?.small,
        `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
      ]),
    };
  } catch {
    return null;
  }
}

// Fills the gaps in `primary` from `extra`, keeping `primary`'s values.
function merge(primary: Lookup, extra: Lookup | null): Lookup {
  if (!extra) return primary;
  return {
    title: primary.title ?? extra.title,
    author: primary.author ?? extra.author,
    publisher: primary.publisher ?? extra.publisher,
    description: primary.description ?? extra.description,
    categories: primary.categories.length ? primary.categories : extra.categories,
    price: primary.price ?? extra.price,
    coverUrl: primary.coverUrl ?? extra.coverUrl,
  };
}

// Every success path returns through here, so a book never reaches the form
// untagged while we still have enough signal to propose something.
function foundResponse(l: Lookup, extra: Record<string, unknown> = {}) {
  const categories = l.categories.length
    ? l.categories
    : inferTags({ title: l.title, publisher: l.publisher, description: l.description });
  return NextResponse.json({ found: true, ...extra, ...l, categories });
}

// Looks up a book by ISBN (barcode scan) or by title. Checks our own data
// first — books other students already listed and the harvested Thai catalog —
// then tops up whatever is still missing from Google Books / Open Library.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isbn = searchParams.get('isbn')?.replace(/[^0-9Xx]/g, '') ?? '';
  const title = searchParams.get('title')?.trim() ?? '';
  lastCallBlocked = false;

  if (isbn && (isbn.length === 10 || isbn.length === 13)) {
    // Someone at this school already listed this exact barcode — answer from
    // our own database and skip the APIs entirely.
    const local = await lookupLocal({ isbn });
    if (local?.title && localIsComplete(local)) {
      return foundResponse(local, { isbn, source: 'local' });
    }

    const g = await lookupGoogle(`isbn:${isbn}`);
    if (g?.title) {
      // Top up anything Google was missing (author / publisher / cover).
      const topped = !g.coverUrl || !g.publisher || !g.author ? merge(g, await lookupOpenLibraryIsbn(isbn)) : g;
      // The local title is the one students here actually use, so keep it.
      return foundResponse(merge(local ?? topped, topped), { isbn, source: local?.title ? 'local' : 'api' });
    }
    const ol = await lookupOpenLibraryIsbn(isbn);
    if (ol?.title) return foundResponse(merge(local ?? ol, ol), { isbn, source: 'api' });
    // APIs gave us nothing; a partial local hit still beats an empty form.
    if (local?.title) return foundResponse(local, { isbn, source: 'local' });
    // `blocked` means the APIs refused us (quota) rather than not knowing the
    // book — without GOOGLE_BOOKS_API_KEY this is the usual outcome.
    return NextResponse.json({ found: false, blocked: lastCallBlocked });
  }

  if (title.length >= 3) {
    const local = await lookupLocal({ title });
    if (local?.title && localIsComplete(local)) {
      return foundResponse(local, { source: 'local' });
    }
    const g = await lookupGoogle(`intitle:"${title}"`);
    if (g?.title) {
      return foundResponse(merge(local ?? g, g), { source: local?.title ? 'local' : 'api' });
    }
    if (local?.title) return foundResponse(local, { source: 'local' });
    return NextResponse.json({ found: false, blocked: lastCallBlocked });
  }

  return NextResponse.json({ error: 'isbn or title required' }, { status: 400 });
}
