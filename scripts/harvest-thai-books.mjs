// Harvests Thai-language books from major Thai publishers via the Google
// Books API into the catalog_books table, so the Add Book title field can
// suggest them instantly with no external quota.
//
// Run with:  npm run harvest:thai
// Needs .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
// Optional: GOOGLE_BOOKS_API_KEY (recommended — the anonymous quota is small).
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

if (!url) {
  console.error('\n❌ TURSO_DATABASE_URL is not set. Put it in .env.local first.\n');
  process.exit(1);
}

const db = createClient({ url, authToken });

// Major Thai publishers — harvested with Google Books `inpublisher:` search.
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

// Broad Thai topics to catch books whose publisher metadata is missing.
const TOPICS = [
  'นิยาย', 'วรรณกรรม', 'เรื่องสั้น', 'วรรณคดีไทย', 'ประวัติศาสตร์ไทย',
  'การ์ตูนความรู้', 'จิตวิทยา', 'พัฒนาตนเอง', 'ธุรกิจ', 'การเงิน',
  'วิทยาศาสตร์', 'คณิตศาสตร์', 'ภาษาอังกฤษ', 'สอบเข้า', 'คู่มือเรียน',
  'นิทาน', 'เยาวชน', 'ท่องเที่ยว', 'ทำอาหาร', 'สุขภาพ',
];

const QUERIES = [
  ...PUBLISHERS.map(p => `inpublisher:"${p}"`),
  ...TOPICS,
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ensureTable() {
  await db.execute(`CREATE TABLE IF NOT EXISTS catalog_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL UNIQUE,
    author TEXT,
    publisher TEXT,
    source TEXT DEFAULT 'harvest',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
}

async function fetchPage(query, startIndex) {
  const params = new URLSearchParams({
    q: query,
    langRestrict: 'th',
    maxResults: '40',
    startIndex: String(startIndex),
    printType: 'books',
    fields: 'items(volumeInfo(title,authors,publisher))',
  });
  if (apiKey) params.set('key', apiKey);
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
  if (res.status === 429) return { rateLimited: true, items: [] };
  if (!res.ok) return { rateLimited: false, items: [] };
  const data = await res.json();
  return { rateLimited: false, items: data.items ?? [] };
}

let inserted = 0;
let scanned = 0;

async function saveItems(items) {
  for (const item of items) {
    const info = item.volumeInfo ?? {};
    const title = typeof info.title === 'string' ? info.title.trim() : '';
    if (!title || title.length < 2) continue;
    scanned++;
    const author = Array.isArray(info.authors) && info.authors.length ? info.authors[0] : null;
    const publisher = typeof info.publisher === 'string' ? info.publisher : null;
    const result = await db.execute({
      sql: 'INSERT OR IGNORE INTO catalog_books (title, author, publisher) VALUES (?, ?, ?)',
      args: [title, author, publisher],
    });
    if (Number(result.rowsAffected) > 0) inserted++;
  }
}

console.log(`Harvesting Thai books from ${QUERIES.length} queries${apiKey ? ' (with API key)' : ' (no API key — small quota)'}...`);
await ensureTable();

outer: for (const query of QUERIES) {
  process.stdout.write(`  ${query} `);
  let got = 0;
  for (const startIndex of [0, 40, 80, 120]) {
    const { rateLimited, items } = await fetchPage(query, startIndex);
    if (rateLimited) {
      console.log('\n\n⚠️  Google Books rate limit hit. Re-run later (or add GOOGLE_BOOKS_API_KEY) to continue — progress so far is saved.');
      break outer;
    }
    await saveItems(items);
    got += items.length;
    if (items.length < 40) break; // no more pages
    await sleep(400);
  }
  console.log(`→ ${got} results`);
  await sleep(400);
}

const total = await db.execute('SELECT COUNT(*) AS n FROM catalog_books');
console.log(`\n✅ Done. Scanned ${scanned} results, added ${inserted} new books.`);
console.log(`📚 catalog_books now holds ${total.rows[0].n} titles.`);
process.exit(0);
