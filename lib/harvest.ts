import { getDb } from './db';

// Major Thai publishers — harvested with Google Books `inpublisher:` search —
// plus broad Thai topics to catch books with missing publisher metadata.
const PUBLISHERS = [
  'อมรินทร์',
  'มติชน',
  'นานมีบุ๊คส์',
  'แจ่มใส',
  'สถาพรบุ๊คส์',
  'ซีเอ็ดยูเคชั่น',
  'ประพันธ์สาส์น',
  'แพรวสำนักพิมพ์',
  'ศิลปวัฒนธรรม',
  'สารคดี',
  'a book',
  'Salmon Books',
  'Springbooks',
  'Biblio',
  'เนชั่นบุ๊คส์',
  'ผีเสื้อ',
  'กะรัต',
  'สยามอินเตอร์บุ๊คส์',
];

const TOPICS = [
  'นิยาย', 'วรรณกรรม', 'เรื่องสั้น', 'วรรณคดีไทย', 'ประวัติศาสตร์ไทย',
  'การ์ตูนความรู้', 'จิตวิทยา', 'พัฒนาตนเอง', 'ธุรกิจ', 'การเงิน',
  'วิทยาศาสตร์', 'คณิตศาสตร์', 'ภาษาอังกฤษ', 'สอบเข้า', 'คู่มือเรียน',
  'นิทาน', 'เยาวชน', 'ท่องเที่ยว', 'ทำอาหาร', 'สุขภาพ',
];

export const HARVEST_QUERIES: string[] = [
  ...PUBLISHERS.map(p => `inpublisher:"${p}"`),
  ...TOPICS,
];

export interface HarvestBatchResult {
  nextIndex: number;
  totalQueries: number;
  done: boolean;
  rateLimited: boolean;
  inserted: number;
  catalogCount: number;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function ensureTables() {
  const db = getDb();
  await db.execute(`CREATE TABLE IF NOT EXISTS catalog_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL UNIQUE,
    author TEXT,
    publisher TEXT,
    source TEXT DEFAULT 'harvest',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
}

export async function getHarvestState(): Promise<{ nextIndex: number; totalQueries: number; catalogCount: number }> {
  await ensureTables();
  const db = getDb();
  const [state, count] = await Promise.all([
    db.execute({ sql: "SELECT value FROM app_state WHERE key = 'harvest_next'", args: [] }),
    db.execute('SELECT COUNT(*) AS n FROM catalog_books'),
  ]);
  const nextIndex = state.rows.length ? Number(state.rows[0].value) : 0;
  return { nextIndex, totalQueries: HARVEST_QUERIES.length, catalogCount: Number(count.rows[0].n) };
}

export async function resetHarvestState() {
  await ensureTables();
  await getDb().execute({ sql: "INSERT OR REPLACE INTO app_state (key, value) VALUES ('harvest_next', '0')", args: [] });
}

async function fetchPage(query: string, startIndex: number): Promise<{ rateLimited: boolean; items: any[] }> {
  const params = new URLSearchParams({
    q: query,
    langRestrict: 'th',
    maxResults: '40',
    startIndex: String(startIndex),
    printType: 'books',
    fields: 'items(volumeInfo(title,authors,publisher))',
  });
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) params.set('key', key);
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) return { rateLimited: true, items: [] };
    if (!res.ok) return { rateLimited: false, items: [] };
    const data = await res.json();
    return { rateLimited: false, items: data.items ?? [] };
  } catch {
    return { rateLimited: false, items: [] };
  }
}

// Processes `batchSize` queries starting at `startIndex`, saving progress so
// the caller can invoke repeatedly until done (keeps each serverless
// invocation short).
export async function harvestBatch(startIndex: number, batchSize = 2): Promise<HarvestBatchResult> {
  await ensureTables();
  const db = getDb();
  let inserted = 0;
  let rateLimited = false;
  let index = startIndex;

  for (; index < Math.min(startIndex + batchSize, HARVEST_QUERIES.length); index++) {
    const query = HARVEST_QUERIES[index];
    for (const pageStart of [0, 40, 80, 120]) {
      const page = await fetchPage(query, pageStart);
      if (page.rateLimited) {
        rateLimited = true;
        break;
      }
      for (const item of page.items) {
        const info = item.volumeInfo ?? {};
        const title = typeof info.title === 'string' ? info.title.trim() : '';
        if (!title || title.length < 2) continue;
        const author = Array.isArray(info.authors) && info.authors.length ? info.authors[0] : null;
        const publisher = typeof info.publisher === 'string' ? info.publisher : null;
        const result = await db.execute({
          sql: 'INSERT OR IGNORE INTO catalog_books (title, author, publisher) VALUES (?, ?, ?)',
          args: [title, author, publisher],
        });
        if (Number(result.rowsAffected) > 0) inserted++;
      }
      if (page.items.length < 40) break;
      await sleep(250);
    }
    if (rateLimited) break;
    await sleep(250);
  }

  const nextIndex = rateLimited ? index : index; // rate-limited query is retried next run
  await db.execute({
    sql: "INSERT OR REPLACE INTO app_state (key, value) VALUES ('harvest_next', ?)",
    args: [String(nextIndex)],
  });

  const count = await db.execute('SELECT COUNT(*) AS n FROM catalog_books');
  return {
    nextIndex,
    totalQueries: HARVEST_QUERIES.length,
    done: nextIndex >= HARVEST_QUERIES.length,
    rateLimited,
    inserted,
    catalogCount: Number(count.rows[0].n),
  };
}
