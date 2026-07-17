import { getDb } from './db';

// Queries are grouped by category and ordered so that NOVELS and ACADEMIC /
// TEXTBOOK books are harvested first each cycle (the cron walks the list from
// the top and resets when it reaches the end). Everything else follows.

// ── Novels & literature ──
const NOVEL_PUBLISHERS = [
  // Amarin group's fiction imprints (อรุณ = novels, แพรว = literature,
  // แพรวเยาวชน = youth fiction) plus the main อมรินทร์ brand
  'อมรินทร์', 'อรุณ', 'แพรวสำนักพิมพ์', 'แพรว', 'แพรวเยาวชน', 'Arun', 'Praew',
  'แจ่มใส', 'แจ่มใสพับลิชชิ่ง', 'สถาพรบุ๊คส์',
  'ผีเสื้อ', 'ประพันธ์สาส์น', 'กะรัต', 'everY', 'โรส พับลิชชิ่ง',
  'ภูตะวัน', 'บลิส พับลิชชิ่ง', 'เดอะเลตเตอร์', 'สยามอินเตอร์บุ๊คส์',
  // More Thai fiction / novel houses
  'อรุณ', 'พิมพ์คำ', 'ณ บ้านวรรณกรรม', 'นานมีบุ๊คส์ทีน', 'ดีพ',
  'เฮอร์มิท', 'เซนส์บุ๊ค', 'เอนเทอร์บุ๊ค', 'บันบุ๊คส์', 'ชิฟฟอนเค้ก',
  'ดีมีมี', 'มากมาย', 'กรู๊ฟ พับลิชชิ่ง', 'เพิร์ล พับลิชชิ่ง',
  'สื่อวรรณกรรม', 'นาคร', 'แซทเทิลไลท์',
  'Words พับลิชชิ่ง', 'เวิร์ดส', 'Words', 'พริซึ่ม', 'Prizm',
  'Rose', 'Deep', 'Hermit',
];
const NOVEL_TOPICS = [
  'นิยาย', 'วรรณกรรม', 'เรื่องสั้น', 'วรรณคดีไทย', 'นิยายรัก',
  'นิยายสืบสวน', 'นิยายจีน', 'นิยายเกาหลี', 'นิยายกำลังภายใน',
  'นิยายแฟนตาซี', 'นิยายวาย', 'ไลท์โนเวล', 'บทกวี',
];

// ── Academic & textbooks ──
const ACADEMIC_PUBLISHERS = [
  'ซีเอ็ดยูเคชั่น', 'อักษรเจริญทัศน์', 'วัฒนาพานิช', 'แม็คเอ็ดดูเคชั่น',
  'สสวท', 'พ.ศ.พัฒนา', 'ฟิสิกส์เซ็นเตอร์', 'ห้องเรียน', 'เนชั่นเอ็ดดูเทนเมนท์',
  'สำนักพิมพ์จุฬาลงกรณ์มหาวิทยาลัย', 'สำนักพิมพ์มหาวิทยาลัยธรรมศาสตร์',
  'สำนักพิมพ์มหาวิทยาลัยเกษตรศาสตร์', 'มติชนวิชาการ',
];
const ACADEMIC_TOPICS = [
  'หนังสือเรียน', 'แบบเรียน', 'มัธยมศึกษา', 'คู่มือเรียน', 'สอบเข้า',
  'เตรียมอุดม', 'gat pat', 'โอเน็ต', 'ฟิสิกส์', 'เคมี', 'ชีววิทยา',
  'คณิตศาสตร์', 'วิทยาศาสตร์', 'ภาษาอังกฤษ', 'ภาษาไทย', 'สังคมศึกษา',
  'ภูมิศาสตร์', 'เศรษฐศาสตร์', 'ปรัชญา',
];

// ── Everything else ──
const OTHER_PUBLISHERS = [
  'มติชน', 'นานมีบุ๊คส์', 'ศิลปวัฒนธรรม', 'สารคดี', 'a book',
  'Salmon Books', 'แซลมอน', 'Springbooks', 'สปริงบุ๊กส์', 'Biblio',
  'เนชั่นบุ๊คส์', 'openbooks', 'บุ๊คสเคป', 'เอ็มไอเอส', 'ไอดีซี', 'ยิปซี',
  'แสงดาว', 'ดอกหญ้า', 'ฟรีมายด์', 'เวิร์คพอยท์', 'ทัช พับลิเคชั่นส์',
  'แซนด์คล็อค', 'อินสปายร์', 'สปริงเกอร์',
  'บันลือบุ๊คส์', 'ขายหัวเราะ',
  // Manga / comic licensors
  'Siam Inter Comics', 'วิบูลย์กิจ', 'บงกช', 'NED Comics', 'Luckpim', 'ฟีนิกซ์',
];
const OTHER_TOPICS = [
  'จิตวิทยา', 'พัฒนาตนเอง', 'ธุรกิจ', 'การเงิน', 'ประวัติศาสตร์ไทย',
  'ชีวประวัติ', 'การเมือง', 'ศาสนา', 'สารคดี', 'ท่องเที่ยว', 'ทำอาหาร',
  'สุขภาพ', 'นิทาน', 'เยาวชน', 'การ์ตูนความรู้', 'มังงะ', 'การ์ตูนญี่ปุ่น',
  'การ์ตูน', 'หนังสือภาพ',
];

const pub = (p: string) => `inpublisher:"${p}"`;

// Novels and academic first, then the rest.
export const HARVEST_QUERIES: string[] = [
  ...NOVEL_PUBLISHERS.map(pub),
  ...NOVEL_TOPICS,
  ...ACADEMIC_PUBLISHERS.map(pub),
  ...ACADEMIC_TOPICS,
  ...OTHER_PUBLISHERS.map(pub),
  ...OTHER_TOPICS,
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
    // Google Books returns up to 40 per page; walk deeper to pull more titles.
    for (const pageStart of [0, 40, 80, 120, 160, 200, 240, 280]) {
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
