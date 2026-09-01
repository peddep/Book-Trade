import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getDb, ensureBookColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isBanned } from '@/lib/hub';

export const runtime = 'nodejs';

// How wide a small copy is. Every place the app shows a cover shows it small:
// the widest is a book card on a big screen, around 260 CSS pixels, so 400
// still looks sharp on a phone's 2x screen and weighs a fraction of the photo.
const THUMB_WIDTH = 400;

// One book's cover, as an image rather than a chunk of a JSON list.
//
// Serving covers separately is what makes them cacheable: the browser keeps
// each one and asks only for books it has not seen. The lists used to carry
// every picture inline, so a shelf of 180 books was a 6MB download — every
// visit, however little had changed.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Listings are for students at the school, and so are their covers.
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  if (await isBanned(user.id)) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const bookId = Number(id);
  const small = new URL(req.url).searchParams.get('s') === 'thumb';
  await ensureBookColumns();
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT cover_url, thumb_url FROM books WHERE id = ? AND deleted_at IS NULL',
    args: [bookId],
  });
  const row = res.rows[0];
  const url = row?.cover_url as string | undefined;
  if (!url) return new NextResponse('Not found', { status: 404 });

  const send = (bytes: Buffer, type: string) =>
    new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': type,
        'Content-Length': String(bytes.length),
        // The ?v= in the URL changes whenever the picture does, so this copy is
        // good until then. Private: a cover belongs to the school, not a CDN.
        'Cache-Control': 'private, max-age=604800, immutable',
      },
    });

  const asData = (s: string) => /^data:([^;,]+);base64,([\s\S]*)$/.exec(s);

  // A small copy already made: send it and do no work.
  if (small && typeof row?.thumb_url === 'string' && row.thumb_url) {
    const m = asData(row.thumb_url);
    if (m) return send(Buffer.from(m[2], 'base64'), m[1]);
  }

  // Stored as a data URL: data:image/jpeg;base64,....
  const match = asData(url);
  if (!match) {
    // Someone stored a plain URL; send them there rather than pretending.
    return NextResponse.redirect(url);
  }
  const [, type, b64] = match;
  const bytes = Buffer.from(b64, 'base64');
  if (!small) return send(bytes, type);

  // First time anybody has asked for this one small: shrink it, keep it, and
  // send it. Kept in the row rather than made again per request, since it is
  // the same picture for every student who scrolls past it.
  try {
    const thumb = await sharp(bytes)
      .rotate()                                        // honour the phone's orientation tag
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })   // the source is already a compressed photo; leave
                                 // headroom so the title on the cover stays legible
      .toBuffer();
    await db.execute({
      sql: 'UPDATE books SET thumb_url = ? WHERE id = ?',
      args: [`data:image/webp;base64,${thumb.toString('base64')}`, bookId],
    });
    return send(thumb, 'image/webp');
  } catch {
    // An image sharp cannot read (or a missing binary on some host): the full
    // picture is still a correct answer, just a heavier one.
    return send(bytes, type);
  }
}
