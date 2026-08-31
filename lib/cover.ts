// Where to fetch a book's cover from.
//
// Covers are stored as data URLs on the row, which made the book lists enormous
// — every listing carried its whole picture inline, so browsing meant
// downloading every cover again on every visit, uncacheable. The lists now send
// the length of the cover instead, and the picture comes from its own URL that
// the browser can keep.
//
// `cover_url` is still honoured when it is there: a photo just taken, or a book
// that came back from an endpoint which still sends the image inline.
export interface HasCover {
  id: number;
  cover_url?: string | null;
  cover_len?: number | null;
}

export function coverSrc(book: HasCover): string | null {
  if (book.cover_url) return book.cover_url;
  // The length doubles as a version: change the picture and it changes too, so
  // a cached cover is replaced rather than kept.
  if (book.cover_len) return `/api/books/${book.id}/cover?v=${book.cover_len}`;
  return null;
}
