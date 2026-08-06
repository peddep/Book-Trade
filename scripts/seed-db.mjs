// Fills a TEST database with believable sample data, so a preview deployment
// is something you can actually click around in rather than an empty shell.
//
//   npm run db:seed
//
// Refuses to touch a database that already has students in it, because the
// whole point of a preview environment is that it is not the students' one.
// Pass --force only if you are certain (it wipes everything first).
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const force = process.argv.includes('--force');

if (!url) {
  console.error('\n❌ TURSO_DATABASE_URL is not set. Put it in .env.local first.\n');
  process.exit(1);
}

const db = createClient({ url, authToken });

// Show which database is about to be written to — the most common way to do
// damage here is not realising it is the live one.
console.log(`\nTarget database: ${url.replace(/\?.*$/, '')}`);

const existing = await db.execute('SELECT COUNT(*) AS n FROM users').catch(() => null);
if (!existing) {
  console.error('\n❌ No tables found. Run `npm run db:init` first.\n');
  process.exit(1);
}
const userCount = Number(existing.rows[0].n);

if (userCount > 0 && !force) {
  console.error(
    `\n❌ This database already has ${userCount} account(s) in it.\n` +
    `   Refusing to seed, in case this is the live database.\n\n` +
    `   If it really is a throwaway test database, re-run with:\n` +
    `     npm run db:seed -- --force     (this DELETES everything first)\n`,
  );
  process.exit(1);
}

if (force && userCount > 0) {
  console.log(`⚠️  --force: deleting ${userCount} existing account(s) and all their data…`);
  for (const t of ['notifications', 'feedback', 'donations', 'reports', 'messages', 'wonder_box', 'rooms', 'room_members', 'trades', 'books', 'users']) {
    await db.execute(`DELETE FROM ${t}`).catch(() => {});
  }
}

const PASSWORD = 'test1234';
const hash = await bcrypt.hash(PASSWORD, 10);

const STUDENTS = [
  { name: 'somchai',  real: 'สมชาย ใจดี',      grade: '4', cls: '1', avail: ['p4-0', 'p4-2', 'after-4'], colour: '#6366f1', contact: '@somchai_ig' },
  { name: 'malee',    real: 'มาลี สดใส',        grade: '4', cls: '1', avail: ['p4-0', 'p4-1'],           colour: '#ec4899', contact: '@malee.reads' },
  { name: 'nid',      real: 'นิด มานะ',         grade: '2', cls: '5', avail: ['p5-1', 'p5-3'],           colour: '#10b981', contact: '@nidnoi' },
  { name: 'pond',     real: 'ปอนด์ รักเรียน',    grade: '6', cls: '9', avail: ['any'],                    colour: '#f59e0b', contact: '@pond6' },
  { name: 'fahsai',   real: 'ฟ้าใส งามพร',      grade: '5', cls: '2', avail: ['after-0', 'after-2'],     colour: '#3b82f6', contact: '' },
];

const BOOKS = [
  ['แฮร์รี่ พอตเตอร์กับศิลาอาถรรพ์', 'เจ. เค. โรว์ลิ่ง', 'นานมีบุ๊คส์',      'Novel,Fantasy',     280, '', 'Good'],
  ['ดาบพิฆาตอสูร',                  'โคโยฮารุ โกโตเกะ', 'สยามอินเตอร์คอมิกส์', 'Comics',            65,  '3', 'Like New'],
  ['หนังสือเรียนคณิตศาสตร์ ม.4',     'สสวท',            'สสวท',              'Math,Textbook',     120, '', 'Fair'],
  ['ฟิสิกส์ ม.5 เล่ม 1',            'สสวท',            'สสวท',              'Science,Textbook',  135, '1', 'Good'],
  ['แนวข้อสอบ TCAS ภาษาอังกฤษ',      'ทีมติวเตอร์',      'ซีเอ็ดยูเคชั่น',      'English,Exam Prep', 190, '', 'Good'],
  ['ชีวิตติดปีก',                   'สมชาย นักเขียน',   'อมรินทร์',           'Self-Improvement',  150, '', 'Like New'],
  ['วันพีซ',                        'เออิจิโร โอดะ',    'สยามอินเตอร์คอมิกส์', 'Comics,Adventure',  70,  '99', 'Poor'],
  ['เจ้าชายน้อย',                   'อ็องตวน',          'แพรวสำนักพิมพ์',      'Novel',             160, '', 'Good'],
  ['ประวัติศาสตร์ไทยฉบับย่อ',        'นักประวัติศาสตร์',  'มติชน',              'History',           210, '', 'Fair'],
  ['พจนานุกรมอังกฤษ-ไทย',           'บรรณาธิการ',       'ซีเอ็ดยูเคชั่น',      'English',           250, '', 'Good'],
  ['นิยายสืบสวนคดีปริศนา',           'นักเขียนไทย',      'สถาพรบุ๊คส์',        'Novel,Mystery',     185, '', 'Good'],
  ['การ์ตูนความรู้วิทยาศาสตร์',       'ทีมงาน',           'นานมีบุ๊คส์',        'Science,Comics',    95,  '', 'Like New'],
];

const COLOURS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

console.log('Seeding…');

const userIds = [];
for (const s of STUDENTS) {
  const r = await db.execute({
    sql: `INSERT INTO users (name, real_name, email, password_hash, grade, class_no, contact, availability, avatar_color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [s.name, s.real, `${s.name}@student.nssc.ac.th`, hash, s.grade, s.cls, s.contact || null, JSON.stringify(s.avail), s.colour],
  });
  userIds.push(Number(r.lastInsertRowid));
}

const bookIds = [];
for (let i = 0; i < BOOKS.length; i++) {
  const [title, author, publisher, subject, price, volume, condition] = BOOKS[i];
  const owner = userIds[i % userIds.length];
  const r = await db.execute({
    sql: `INSERT INTO books (owner_id, title, author, publisher, subject, price, volume, condition, cover_color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [owner, title, author, publisher, subject, price, volume || null, condition, COLOURS[i % COLOURS.length]],
  });
  bookIds.push({ id: Number(r.lastInsertRowid), owner, price });
}

// A few trades in different states, so every tab on the site has something in it.
async function trade(requesterIdx, ownerIdx, status) {
  const offered = bookIds.find(b => b.owner === userIds[requesterIdx]);
  const wanted = bookIds.find(b => b.owner === userIds[ownerIdx]);
  if (!offered || !wanted) return;
  await db.execute({
    sql: `INSERT INTO trades (requester_id, owner_id, offered_book_id, wanted_book_id, status, message)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userIds[requesterIdx], userIds[ownerIdx], offered.id, wanted.id, status, 'สนใจแลกเล่มนี้ครับ'],
  });
}
await trade(1, 0, 'pending');    // waiting on somchai to answer
await trade(2, 0, 'accepted');   // arranged, awaiting the meet-up
await trade(3, 1, 'completed');  // done

// Community chat, so the trade page is not blank.
await db.execute(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, kind TEXT NOT NULL DEFAULT 'chat',
  body TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`).catch(() => {});
for (const [uid, kind, body] of [
  [userIds[0], 'chat', 'มีใครมีหนังสือฟิสิกส์ ม.5 บ้างครับ'],
  [userIds[2], 'chat', 'เรามีนะ เดี๋ยวลงให้'],
  [null, 'announcement', 'pond ⇄ malee · เจ้าชายน้อย ⇄ ดาบพิฆาตอสูร'],
  [null, 'donation', 'somchai · ฿50'],
]) {
  await db.execute({ sql: 'INSERT INTO messages (user_id, kind, body) VALUES (?, ?, ?)', args: [uid, kind, body] }).catch(() => {});
}

console.log(`
✅ Seeded ${STUDENTS.length} students, ${BOOKS.length} books, 3 trades and some chat.

   Sign in with any of these:
${STUDENTS.map(s => `     ${s.name}@student.nssc.ac.th`).join('\n')}
   Password for all of them:  ${PASSWORD}

   ${STUDENTS[0].name} is account #1, so it is the admin unless ADMIN_EMAIL says otherwise.
`);
process.exit(0);
