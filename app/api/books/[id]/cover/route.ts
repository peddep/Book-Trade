import { NextRequest, NextResponse } from 'next/server';
import { getDb, ensureBookColumns } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isBanned } from '@/lib/hub';

export const runtime = 'nodejs';

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
  await ensureBookColumns();
  const res = await getDb().execute({
    sql: 'SELECT cover_url FROM books WHERE id = ? AND deleted_at IS NULL',
    args: [Number(id)],
  });
  const url = res.rows[0]?.cover_url as string | undefined;
  if (!url) return new NextResponse('Not found', { status: 404 });

  // Stored as a data URL: data:image/jpeg;base64,....
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(url);
  if (!match) {
    // Someone stored a plain URL; send them there rather than pretending.
    return NextResponse.redirect(url);
  }
  const [, type, b64] = match;
  const bytes = Buffer.from(b64, 'base64');

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(bytes.length),
      // The ?v= in the URL changes whenever the picture does, so this copy is
      // good until then. Private: a cover belongs to the school, not a CDN.
      'Cache-Control': 'private, max-age=604800, immutable',
    },
  });
}
