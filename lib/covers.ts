// Best-effort book cover lookup from public APIs. Both sources are queried in
// parallel with short timeouts; Google Books wins (better Thai coverage),
// falling back to Open Library covers, then null (UI shows a colored
// placeholder).
const TIMEOUT_MS = 4000;

async function fromGoogleBooks(title: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      q: `intitle:${title}`,
      maxResults: '1',
      printType: 'books',
      fields: 'items(volumeInfo(imageLinks))',
    });
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    if (key) params.set('key', key);
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const url = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
    return url ? String(url).replace('http://', 'https://') : null;
  } catch {
    return null;
  }
}

async function fromOpenLibrary(title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1&fields=cover_i`,
      { headers: { 'User-Agent': 'BookTrade/1.0 (student book trading app)' }, signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const id = data.docs?.[0]?.cover_i;
    return id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : null;
  } catch {
    return null;
  }
}

export async function findCoverUrl(title: string): Promise<string | null> {
  if (!title?.trim()) return null;
  const [google, openLib] = await Promise.all([fromGoogleBooks(title), fromOpenLibrary(title)]);
  return google ?? openLib ?? null;
}
