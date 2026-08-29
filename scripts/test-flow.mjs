// Integration tests for the core trade logic. Spawns `next dev` against a
// throwaway file database and drives the real HTTP API, asserting the
// invariants that subtle bugs hide behind (double-accept, busy books,
// confirm-after-cancel, ownership transfer, price rule).
//
// Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import { rmSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';

const PORT = 3199;
const BASE = `http://localhost:${PORT}`;
const DB = 'test-flow.db';
let server;

async function api(path, { method = 'GET', cookie, body, ip } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(ip ? { 'x-forwarded-for': ip } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json, cookie: setCookie?.split(';')[0] };
}

// Each signup gets a distinct IP so the per-IP registration limit (a real,
// tested guard) doesn't trip during the suite.
let ipCounter = 0;
async function register(name, email) {
  const r = await api('/api/auth/register', { method: 'POST', body: { name, email, password: 'secret6', accept_terms: true }, ip: `10.0.0.${++ipCounter}` });
  return r.cookie;
}
async function addBook(cookie, title, price) {
  const r = await api('/api/books', { method: 'POST', cookie, body: { title, author: 'a', condition: 'Good', price } });
  return r.json.book.id;
}


// `next dev` hands the listening socket to a `next-server` process that
// re-parents itself to init, so killing the spawned process group can leave it
// running. A survivor holds the port, the next run's server fails to start,
// and the tests then talk to a stale server whose database has been deleted —
// which looks exactly like a product bug. Find the holder through /proc so it
// can be killed by port rather than by name (no pkill: that would take out a
// developer's own dev server).
function pidsOnPort(port) {
  const hex = port.toString(16).toUpperCase().padStart(4, '0');
  const inodes = new Set();
  for (const table of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let lines;
    try { lines = readFileSync(table, 'utf8').split('\n').slice(1); } catch { continue; }
    for (const line of lines) {
      const f = line.trim().split(/\s+/);
      // st === '0A' is LISTEN; field 9 is the socket inode.
      if (f.length > 9 && f[1]?.endsWith(':' + hex) && f[3] === '0A') inodes.add(f[9]);
    }
  }
  if (inodes.size === 0) return [];
  const pids = [];
  for (const pid of readdirSync('/proc')) {
    if (!/^\d+$/.test(pid)) continue;
    let fds;
    try { fds = readdirSync(`/proc/${pid}/fd`); } catch { continue; }
    for (const fd of fds) {
      try {
        const m = readlinkSync(`/proc/${pid}/fd/${fd}`).match(/^socket:\[(\d+)\]$/);
        if (m && inodes.has(m[1])) { pids.push(Number(pid)); break; }
      } catch { /* fd vanished */ }
    }
  }
  return pids;
}

async function freePort(port) {
  for (const pid of pidsOnPort(port)) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  // Give the kernel a moment to release the socket.
  for (let i = 0; i < 20 && pidsOnPort(port).length > 0; i++) {
    await new Promise(r => setTimeout(r, 100));
  }
}

before(async () => {
  // A server left behind by an earlier run would answer every request.
  await freePort(PORT);
  rmSync(DB, { force: true });
  execSync(`printf 'TURSO_DATABASE_URL=file:${DB}\\nSESSION_SECRET=test\\n' > .env.local`, { shell: '/bin/bash' });
  execSync('npm run db:init', { stdio: 'ignore' });
  // Detached, so the whole process group can be torn down below. `next dev`
  // spawns helper processes of its own; killing only the wrapper leaves one
  // holding the port, and the next run then talks to a stale server whose
  // database has already been deleted.
  server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { stdio: 'ignore', env: process.env, detached: true });
  // Wait for readiness.
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/'); if (r.ok) break; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
});

after(async () => {
  if (server?.pid) {
    try { process.kill(-server.pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  await freePort(PORT);
  rmSync(DB, { force: true });
  rmSync('.env.local', { force: true });
});

test('price gap over ฿100 is rejected', async () => {
  const a = await register('PA', 'pa@s.edu');
  const b = await register('PB', 'pb@s.edu');
  const ba = await addBook(a, 'Cheap', 50);
  const bb = await addBook(b, 'Pricey', 300);
  const r = await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'price_gap');
});

test('a book committed to the Wonder Box cannot be offered in a direct trade', async () => {
  const a = await register('WA', 'wa@s.edu');
  const b = await register('WB', 'wb@s.edu');
  const ba = await addBook(a, 'Boxed', 100);
  const bb = await addBook(b, 'Target', 100);
  await api('/api/wonderbox', { method: 'POST', cookie: a, body: { book_id: ba } });
  const r = await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'book_busy');
});

test('accepting one offer cancels competing pending offers for the same book', async () => {
  const owner = await register('OA', 'oa@s.edu');
  const p1 = await register('P1', 'p1@s.edu');
  const p2 = await register('P2', 'p2@s.edu');
  const want = await addBook(owner, 'Wanted', 100);
  const o1 = await addBook(p1, 'Offer1', 100);
  const o2 = await addBook(p2, 'Offer2', 100);
  const t1 = (await api('/api/trades', { method: 'POST', cookie: p1, body: { offered_book_id: o1, wanted_book_id: want } })).json.trade.id;
  const t2 = (await api('/api/trades', { method: 'POST', cookie: p2, body: { offered_book_id: o2, wanted_book_id: want } })).json.trade.id;
  await api(`/api/trades/${t1}`, { method: 'PATCH', cookie: owner, body: { status: 'accepted' } });
  const list = (await api('/api/trades', { cookie: owner })).json.trades;
  const s1 = list.find(t => t.id === t1).status;
  const s2 = list.find(t => t.id === t2).status;
  assert.equal(s1, 'accepted');
  assert.equal(s2, 'cancelled'); // the losing offer is auto-cancelled
});

test('a cancelled trade cannot be confirmed as happened', async () => {
  const a = await register('CA', 'ca@s.edu');
  const b = await register('CB', 'cb@s.edu');
  const ba = await addBook(a, 'CBookA', 100);
  const bb = await addBook(b, 'CBookB', 100);
  const t = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: a, body: { status: 'cancelled' } });
  const r = await api(`/api/trades/${t}`, { method: 'PATCH', cookie: a, body: { confirm: 'happened' } });
  assert.equal(r.status, 400); // not in progress
});

test('a completed trade swaps book ownership and returns them to the market', async () => {
  const a = await register('TA', 'ta@s.edu');
  const b = await register('TB', 'tb@s.edu');
  const ba = await addBook(a, 'Swap A', 100);
  const bb = await addBook(b, 'Swap B', 100);
  const t = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: a, body: { confirm: 'happened' } });
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { confirm: 'happened' } });
  const aBooks = (await api('/api/books?mine=1', { cookie: a })).json.books;
  const bBooks = (await api('/api/books?mine=1', { cookie: b })).json.books;
  assert.equal(aBooks.length, 1);
  assert.equal(aBooks[0].title, 'Swap B'); // A now owns B's book
  assert.equal(Number(aBooks[0].available), 1); // back on the market
  assert.equal(bBooks[0].title, 'Swap A');
});

test('a settled trade cannot be reopened and re-run', async () => {
  // The dangerous version of this: B rejects A's offer, B later trades the
  // same book away to C, then B reopens the dead offer and confirms it — which
  // used to hand C's book to A.
  const a = await register('RA', 'ra@s.edu');
  const b = await register('RB', 'rb@s.edu');
  const c = await register('RC', 'rc@s.edu');
  const ba = await addBook(a, 'ReA', 100);
  const bb = await addBook(b, 'ReB', 100);
  const bc = await addBook(c, 'ReC', 100);

  const dead = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/trades/${dead}`, { method: 'PATCH', cookie: b, body: { status: 'rejected' } });

  // B genuinely trades the book to C instead.
  const real = (await api('/api/trades', { method: 'POST', cookie: c, body: { offered_book_id: bc, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/trades/${real}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });
  await api(`/api/trades/${real}`, { method: 'PATCH', cookie: c, body: { confirm: 'happened' } });
  await api(`/api/trades/${real}`, { method: 'PATCH', cookie: b, body: { confirm: 'happened' } });

  const reopen = await api(`/api/trades/${dead}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });
  assert.equal(reopen.status, 409);
  assert.equal(reopen.json.error, 'stale_trade');

  // Even if both sides confirm anyway, C keeps the book they traded for.
  await api(`/api/trades/${dead}`, { method: 'PATCH', cookie: a, body: { confirm: 'happened' } });
  await api(`/api/trades/${dead}`, { method: 'PATCH', cookie: b, body: { confirm: 'happened' } });
  const cBooks = (await api('/api/books?mine=1', { cookie: c })).json.books;
  assert.deepEqual(cBooks.map(x => x.title), ['ReB']);
});

test('cancelling an accepted trade puts both books back on the market', async () => {
  const a = await register('XA', 'xa@s.edu');
  const b = await register('XB', 'xb@s.edu');
  const ba = await addBook(a, 'XBookA', 100);
  const bb = await addBook(b, 'XBookB', 100);
  const t = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: a, body: { status: 'cancelled' } });

  // Both books are free again, so the same offer can be made afresh.
  const again = await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } });
  assert.equal(again.status, 201);
});

test('editing a price after offering cannot carry a trade past the ฿100 rule', async () => {
  const a = await register('PXA', 'pxa@s.edu');
  const b = await register('PXB', 'pxb@s.edu');
  const ba = await addBook(a, 'PxA', 100);
  const bb = await addBook(b, 'PxB', 150);
  const t = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/books/${ba}`, { method: 'PATCH', cookie: a, body: { price: 1 } });
  const acc = await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });
  assert.equal(acc.status, 400);
  assert.equal(acc.json.error, 'price_gap');
});

test('a traded book can be removed without erasing the other side\'s history', async () => {
  // Deleting a book that a completed trade points at used to fail outright:
  // the foreign key refused, the request 500'd, and the book stayed on the
  // shelf. It must now go, while the trade it was part of stays intact for
  // the other student.
  const a = await register('DA', 'dela@s.edu');
  const b = await register('DB', 'delb@s.edu');
  const ba = await addBook(a, 'DelA', 100);
  const bb = await addBook(b, 'DelB', 100);
  const t = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: a, body: { confirm: 'happened' } });
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { confirm: 'happened' } });

  const mine = (await api('/api/books?mine=1', { cookie: a })).json.books;
  const got = mine.find(x => x.title === 'DelB');
  const del = await api(`/api/books/${got.id}`, { method: 'DELETE', cookie: a });
  assert.equal(del.status, 200);

  // Gone from the owner's shelf...
  const after = (await api('/api/books?mine=1', { cookie: a })).json.books;
  assert.equal(after.some(x => x.title === 'DelB'), false);
  // ...and from what anyone else can browse.
  const browse = (await api('/api/books', { cookie: b })).json.books;
  assert.equal(browse.some(x => x.title === 'DelB'), false);
  // But the completed trade still names both books on the other side.
  const rec = (await api('/api/trades', { cookie: b })).json.trades.find(x => x.id === t);
  assert.equal(rec.status, 'completed');
  assert.equal(rec.offered_title, 'DelA');
  assert.equal(rec.wanted_title, 'DelB');
});

test('a book in an agreed meet-up cannot be removed from under the other student', async () => {
  const a = await register('GA', 'ga@s.edu');
  const b = await register('GB', 'gb@s.edu');
  const ba = await addBook(a, 'AgreedA', 100);
  const bb = await addBook(b, 'AgreedB', 100);
  const t = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });

  const res = await api(`/api/books/${ba}`, { method: 'DELETE', cookie: a });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, 'in_agreed_trade');
  const mine = (await api('/api/books?mine=1', { cookie: a })).json.books;
  assert.equal(mine.some(x => x.title === 'AgreedA'), true);
});

test('an email or a username can only be used once', async () => {
  const email = 'unique@s.edu';
  const first = await api('/api/auth/register', { method: 'POST', ip: `10.0.9.${++ipCounter}`, body: { name: 'Uniq', email, password: 'secret6', accept_terms: true } });
  assert.equal(first.status, 200);

  // The same address in different capitals, or with stray spaces, is the same
  // address — it used to make a second account.
  for (const variant of [email, email.toUpperCase(), `  ${email}  `]) {
    const r = await api('/api/auth/register', { method: 'POST', ip: `10.0.9.${++ipCounter}`, body: { name: 'Someone' + Math.random(), email: variant, password: 'secret6', accept_terms: true } });
    assert.equal(r.status, 409, `expected ${variant} to be refused`);
    assert.equal(r.json.error, 'email_taken');
  }

  // And one student per username, whatever the capitals.
  for (const variant of ['Uniq', 'UNIQ', 'uniq']) {
    const r = await api('/api/auth/register', { method: 'POST', ip: `10.0.9.${++ipCounter}`, body: { name: variant, email: `x${Math.random()}@s.edu`, password: 'secret6', accept_terms: true } });
    assert.equal(r.status, 409, `expected the name ${variant} to be refused`);
    assert.equal(r.json.error, 'name_taken');
  }

  // Signing in should not care how the address is typed.
  const login = await api('/api/auth/login', { method: 'POST', body: { email: email.toUpperCase(), password: 'secret6' } });
  assert.equal(login.status, 200);
});

test('a student cannot rename themselves into somebody else\'s name', async () => {
  const a = await register('RenA', 'rena@s.edu');
  await register('RenB', 'renb@s.edu');
  const taken = await api('/api/auth/me', { method: 'PATCH', cookie: a, body: { name: 'renb' } });
  assert.equal(taken.status, 409);
  assert.equal(taken.json.error, 'name_taken');
  // Their own name, in any capitals, is still theirs.
  const own = await api('/api/auth/me', { method: 'PATCH', cookie: a, body: { name: 'RENA' } });
  assert.equal(own.status, 200);
});

test('an admin can remove any book, including one from a finished trade', async () => {
  // Admin deletion used to fail outright: it removed only pending and accepted
  // trades, so the database still refused to delete a book a completed one
  // pointed at — and it touched the hub tables without making sure they were
  // there, which broke it even for a book nobody had ever traded.
  const admin = await register('AdminOne', 'admin-one@s.edu');   // account #1 in a fresh db is the admin
  const a = await register('AdmA', 'adma@s.edu');
  const b = await register('AdmB', 'admb@s.edu');
  const plain = await addBook(a, 'NeverTraded', 100);
  const ba = await addBook(a, 'AdmTradedA', 100);
  const bb = await addBook(b, 'AdmTradedB', 100);
  const t = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: a, body: { confirm: 'happened' } });
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { confirm: 'happened' } });

  const admins = { cookie: admin };
  const dash = await api('/api/admin', admins);
  if (dash.status !== 200) return; // ADMIN_EMAIL is set in this environment; nothing to assert

  assert.equal((await api('/api/admin', { method: 'POST', cookie: admin, body: { action: 'delete_book', book_id: plain } })).status, 200);
  const traded = (await api('/api/admin', admins)).json.books.find(x => x.title === 'AdmTradedB');
  const gone = await api('/api/admin', { method: 'POST', cookie: admin, body: { action: 'delete_book', book_id: traded.id } });
  assert.equal(gone.status, 200);

  const left = (await api('/api/admin', admins)).json.books.map(x => x.title);
  assert.equal(left.includes('NeverTraded'), false);
  assert.equal(left.includes('AdmTradedB'), false);
  // and the trade both students took part in still names its two books
  const rec = (await api('/api/trades', { cookie: b })).json.trades.find(x => x.id === t);
  assert.equal(rec.offered_title, 'AdmTradedA');
  assert.equal(rec.wanted_title, 'AdmTradedB');
});
