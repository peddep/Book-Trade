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
import { createClient } from '@libsql/client';
import crypto from 'node:crypto';

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
// Every box on the signup form is required, so a test account fills them all
// in — the same as a student would.
const SIGNUP = {
  password: 'secret6', accept_terms: true, real_name: 'Test Student',
  grade: '5', class_no: '3', contact: '@tester', availability: ['p4-0', 'p5-2'],
};
async function register(name, email) {
  const r = await api('/api/auth/register', { method: 'POST', body: { ...SIGNUP, name, email }, ip: `10.0.0.${++ipCounter}` });
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
  // Name the admin accounts explicitly. The admin tests used to rely on "the
  // first account in a fresh database is the admin", which stopped being true
  // the moment an earlier test registered somebody — so those tests quietly
  // skipped their own assertions instead of failing. Anything admin-only is
  // now checked against a real admin, or not claimed at all.
  execSync(`printf 'TURSO_DATABASE_URL=file:${DB}\\nSESSION_SECRET=test\\nADMIN_EMAIL=admin-one@s.edu,banadmin@s.edu,banadmin2@s.edu,banadmin3@s.edu\\n' > .env.local`, { shell: '/bin/bash' });
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
  const first = await api('/api/auth/register', { method: 'POST', ip: `10.0.9.${++ipCounter}`, body: { ...SIGNUP, name: 'Uniq', email } });
  assert.equal(first.status, 200);

  // The same address in different capitals, or with stray spaces, is the same
  // address — it used to make a second account.
  for (const variant of [email, email.toUpperCase(), `  ${email}  `]) {
    const r = await api('/api/auth/register', { method: 'POST', ip: `10.0.9.${++ipCounter}`, body: { ...SIGNUP, name: 'Someone' + Math.random(), email: variant } });
    assert.equal(r.status, 409, `expected ${variant} to be refused`);
    assert.equal(r.json.error, 'email_taken');
  }

  // And one student per username, whatever the capitals.
  for (const variant of ['Uniq', 'UNIQ', 'uniq']) {
    const r = await api('/api/auth/register', { method: 'POST', ip: `10.0.9.${++ipCounter}`, body: { ...SIGNUP, name: variant, email: `x${Math.random()}@s.edu` } });
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
  const admin = await register('AdminOne', 'admin-one@s.edu');   // named in ADMIN_EMAIL above
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
  assert.equal(dash.status, 200, 'the admin dashboard must open, or this test proves nothing');

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

test('a ban signs the student out and shuts the door behind them', async () => {
  const admin = await register('BanAdmin', 'banadmin@s.edu');   // named in ADMIN_EMAIL above
  const reg = await api('/api/auth/register', { method: 'POST', ip: `10.0.8.${++ipCounter}`, body: { ...SIGNUP, name: 'ToBan', email: 'toban@s.edu' } });
  const cookie = reg.cookie;
  const id = reg.json.user.id;

  // signed in and reading normally
  assert.equal((await api('/api/auth/me', { cookie })).json.user.id, id);
  assert.equal((await api('/api/books', { cookie })).status, 200);

  const banned = await api('/api/admin', { method: 'POST', cookie: admin, body: { action: 'ban_user', user_id: id } });
  assert.equal(banned.status, 200, 'the ban must actually be applied, or this test proves nothing');

  // The session cookie is signed, not stored, so it is still cryptographically
  // valid — the account behind it is what has changed.
  const me = await api('/api/auth/me', { cookie });
  assert.equal(me.json.user, null, 'the session must report nobody');
  assert.equal(me.json.banned, true, 'and say why, so the page can explain it');

  // Reading is closed too, not only writing.
  for (const path of ['/api/books', '/api/trades', '/api/chat']) {
    assert.equal((await api(path, { cookie })).status, 403, `${path} should refuse a banned account`);
  }
  // And they cannot simply sign in again.
  assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: 'toban@s.edu', password: 'secret6' } })).status, 403);

  // Lifting the ban puts everything back.
  await api('/api/admin', { method: 'POST', cookie: admin, body: { action: 'unban_user', user_id: id } });
  assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: 'toban@s.edu', password: 'secret6' } })).status, 200);
});

test('a banned student cannot go on trading', async () => {
  const admin = await register('BanAdmin2', 'banadmin2@s.edu');
  const reg = await api('/api/auth/register', { method: 'POST', ip: `10.0.9.${++ipCounter}`, body: { ...SIGNUP, name: 'Trader', email: 'bantrader@s.edu' } });
  const cookie = reg.cookie;
  const id = reg.json.user.id;
  const other = await register('Partner', 'banpartner@s.edu');

  // A trade agreed while the account is in good standing, then the ban lands
  // part-way through — the point at which books are about to change hands.
  const mine = await addBook(cookie, 'Theirs', 100);
  const theirs = await addBook(other, 'Ours', 100);
  const spare = await addBook(cookie, 'Untouched', 100);   // free, so nothing else can explain a refusal
  const trade = (await api('/api/trades', { method: 'POST', cookie, body: { offered_book_id: mine, wanted_book_id: theirs } })).json.trade.id;
  assert.equal((await api(`/api/trades/${trade}`, { method: 'PATCH', cookie: other, body: { status: 'accepted' } })).status, 200);

  const banned = await api('/api/admin', { method: 'POST', cookie: admin, body: { action: 'ban_user', user_id: id } });
  assert.equal(banned.status, 200, 'the ban must actually be applied, or this test proves nothing');

  // Accepting, cancelling and confirming all live on one endpoint, and a ban
  // has to reach every one of them: confirming is what moves a book from one
  // student to another.
  for (const body of [{ confirm: 'happened' }, { status: 'cancelled' }]) {
    assert.equal((await api(`/api/trades/${trade}`, { method: 'PATCH', cookie, body })).status, 403,
      `a banned student must not be able to send ${JSON.stringify(body)}`);
  }
  // Nor quietly rewrite or delete the listings behind a trade.
  assert.equal((await api(`/api/books/${mine}`, { method: 'PATCH', cookie, body: { title: 'renamed' } })).status, 403);
  assert.equal((await api(`/api/books/${mine}`, { method: 'DELETE', cookie })).status, 403);

  // Their books leave circulation, and a stale page cannot offer for one.
  const browse = (await api('/api/books', { cookie: other })).json.books ?? [];
  assert.equal(browse.filter(b => Number(b.owner_id) === id).length, 0, 'a banned student\'s books must not be browsable');
  const theirSpare = await addBook(other, 'Spare', 100);
  const late = await api('/api/trades', { method: 'POST', cookie: other, body: { offered_book_id: theirSpare, wanted_book_id: spare } });
  assert.equal(late.json.error, 'owner_unavailable', 'a free book of a banned student must still be off limits');

  // The other student is not trapped: they can still call the meet-up off and
  // get their own book back.
  assert.equal((await api(`/api/trades/${trade}`, { method: 'PATCH', cookie: other, body: { confirm: 'not' } })).status, 200);
});

test('signing up requires every box, not only the ones the form marks', async () => {
  const base = { ...SIGNUP, name: 'Partial', email: `partial${Math.random()}@s.edu` };
  for (const missing of ['real_name', 'grade', 'class_no', 'contact', 'availability']) {
    const body = { ...base, name: `Partial${Math.random()}`, email: `p${Math.random()}@s.edu` };
    delete body[missing];
    const r = await api('/api/auth/register', { method: 'POST', ip: `10.0.7.${++ipCounter}`, body });
    assert.equal(r.status, 400, `an account with no ${missing} must be refused`);
    assert.equal(r.json.error, 'missing_fields');
  }
  // An empty timetable is the same as none: nobody could arrange a meet-up.
  const empty = await api('/api/auth/register', { method: 'POST', ip: `10.0.7.${++ipCounter}`,
    body: { ...base, name: `Empty${Math.random()}`, email: `e${Math.random()}@s.edu`, availability: [] } });
  assert.equal(empty.json.error, 'missing_fields');

  // Filled in properly, it still works.
  const ok = await api('/api/auth/register', { method: 'POST', ip: `10.0.7.${++ipCounter}`,
    body: { ...base, name: `Full${Math.random()}`, email: `f${Math.random()}@s.edu` } });
  assert.equal(ok.status, 200);
});

test('editing a profile cannot empty what signing up insisted on', async () => {
  const cookie = await register('Editor', `editor${Math.random()}@s.edu`);
  const patch = body => api('/api/auth/me', { method: 'PATCH', cookie, body });

  for (const [field, empty] of [['grade', ''], ['class_no', ''], ['contact', ''], ['availability', []]]) {
    const r = await patch({ name: 'Editor', [field]: empty });
    assert.equal(r.json?.error, 'missing_fields', `clearing ${field} must be refused`);
  }

  // Real edits still go through, and a partial update leaves the rest alone.
  const ok = await patch({ name: 'Editor', grade: '4', class_no: '7', contact: '@moved', availability: ['after-4'] });
  assert.equal(ok.status, 200);
  const me = await api('/api/auth/me', { cookie: ok.cookie ?? cookie });
  assert.equal(me.json.user.grade, '4');
  assert.equal(me.json.user.class_no, '7');
  assert.equal(me.json.user.contact, '@moved');
  assert.deepEqual(me.json.user.availability, ['after-4']);

  // Changing only the name does not require sending everything again.
  const rename = await api('/api/auth/me', { method: 'PATCH', cookie: ok.cookie ?? cookie, body: { name: 'Editor2' } });
  assert.equal(rename.status, 200);
  const after = await api('/api/auth/me', { cookie: rename.cookie ?? cookie });
  assert.equal(after.json.user.name, 'Editor2');
  assert.equal(after.json.user.grade, '4', 'a partial update must not wipe the year');
  assert.equal(after.json.user.class_no, '7', 'a partial update must not wipe the room');
  assert.equal(after.json.user.contact, '@moved', 'a partial update must not wipe the rest');
  assert.deepEqual(after.json.user.availability, ['after-4']);
});

test('saving a profile twice in a row works', async () => {
  // The reply to a save is what the page keeps as its copy of the student, so
  // if it leaves out the contact or the timetable they look empty on screen and
  // the next save is refused for fields nobody touched.
  const cookie = await register('Twice', `twice${Math.random()}@s.edu`);
  const first = await api('/api/auth/me', { method: 'PATCH', cookie,
    body: { name: 'Twice', grade: '5', class_no: '3', contact: '@twice', availability: ['p4-0'] } });
  assert.equal(first.status, 200);
  assert.equal(first.json.user.contact, '@twice', 'the reply must carry the contact back');
  assert.deepEqual(first.json.user.availability, ['p4-0'], 'and the timetable');

  // Exactly what the dialog sends the second time, from the values it was given.
  const second = await api('/api/auth/me', { method: 'PATCH', cookie: first.cookie ?? cookie,
    body: {
      name: 'Twice', grade: first.json.user.grade, class_no: first.json.user.class_no,
      contact: first.json.user.contact, availability: first.json.user.availability,
    } });
  assert.equal(second.status, 200, 'a second save must not be refused');
});

test('a suspended student\'s profile cannot be opened by anyone but the admin', async () => {
  const admin = await register('BanAdmin3', 'banadmin3@s.edu');
  const reg = await api('/api/auth/register', { method: 'POST', ip: `10.0.6.${++ipCounter}`,
    body: { ...SIGNUP, name: 'Hidden', email: 'hidden@s.edu' } });
  const id = reg.json.user.id;
  const nosy = await register('Nosy', 'nosy@s.edu');
  await addBook(reg.cookie, 'HiddenBook', 100);

  // Visible while the account is in good standing.
  const before = await api(`/api/users/${id}`, { cookie: nosy });
  assert.equal(before.status, 200);
  assert.equal(before.json.books.length, 1);
  assert.equal(before.json.user.banned, undefined, 'the profile must not report whether somebody is suspended');

  const banned = await api('/api/admin', { method: 'POST', cookie: admin, body: { action: 'ban_user', user_id: id } });
  assert.equal(banned.status, 200, 'the ban must actually be applied, or this test proves nothing');

  const after = await api(`/api/users/${id}`, { cookie: nosy });
  assert.equal(after.status, 404, 'a suspended profile must not open for a classmate');
  assert.equal(after.json.books, undefined, 'and it must not carry their books');

  // The admin still needs to look at it.
  const asAdmin = await api(`/api/users/${id}`, { cookie: admin });
  assert.equal(asAdmin.status, 200);
  assert.equal(asAdmin.json.books.length, 1);

  // Their books also leave the front page, which anyone can see without an account.
  const showcase = await api('/api/showcase');
  assert.equal((showcase.json.books ?? []).some(b => b.title === 'HiddenBook'), false);

  // Lifting the suspension puts the profile back.
  await api('/api/admin', { method: 'POST', cookie: admin, body: { action: 'unban_user', user_id: id } });
  assert.equal((await api(`/api/users/${id}`, { cookie: nosy })).status, 200);
});

test('agreeing to a trade cannot be done twice, or to a book already taken', async () => {
  const owner = await register('RaceO', `raceo${Math.random()}@s.edu`);
  const a = await register('RaceA', `racea${Math.random()}@s.edu`);
  const b = await register('RaceB', `raceb${Math.random()}@s.edu`);
  const prize = await addBook(owner, 'Prize', 100);
  const oa = await addBook(a, 'OfferA', 100);
  const ob = await addBook(b, 'OfferB', 100);
  const ta = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: oa, wanted_book_id: prize } })).json.trade.id;
  const tb = (await api('/api/trades', { method: 'POST', cookie: b, body: { offered_book_id: ob, wanted_book_id: prize } })).json.trade.id;

  // Both students' offers, accepted at the same moment.
  const [ra, rb] = await Promise.all([
    api(`/api/trades/${ta}`, { method: 'PATCH', cookie: owner, body: { status: 'accepted' } }),
    api(`/api/trades/${tb}`, { method: 'PATCH', cookie: owner, body: { status: 'accepted' } }),
  ]);
  const wins = [ra, rb].filter(r => r.status === 200).length;
  assert.equal(wins, 1, 'one book cannot be promised to two people');

  const list = (await api('/api/trades', { cookie: owner })).json.trades;
  const accepted = list.filter(t => (t.id === ta || t.id === tb) && t.status === 'accepted');
  assert.equal(accepted.length, 1);

  // The same offer twice over is refused the second time.
  const again = await api(`/api/trades/${accepted[0].id}`, { method: 'PATCH', cookie: owner, body: { status: 'accepted' } });
  assert.equal(again.status, 409);
  assert.equal(again.json.error, 'stale_trade');
});

test('the guard the accept relies on actually reports when it changed nothing', async () => {
  // Accepting is safe because the database is asked to move a trade only from
  // the status it was read at, and to take a book only while it is still free —
  // and because an update that matches nothing says so. If that ever stopped
  // being true, the guards would read like a fix while doing nothing, and only
  // a race on the real server would show it. So it is checked here.
  const db = createClient({ url: `file:${DB}` });
  const trade = (await db.execute("SELECT id FROM trades WHERE status = 'cancelled' LIMIT 1")).rows[0];
  await db.execute({ sql: "UPDATE trades SET status = 'pending' WHERE id = ?", args: [trade.id] });
  const first = await db.execute({ sql: "UPDATE trades SET status = 'accepted' WHERE id = ? AND status = 'pending'", args: [trade.id] });
  const second = await db.execute({ sql: "UPDATE trades SET status = 'accepted' WHERE id = ? AND status = 'pending'", args: [trade.id] });
  assert.equal(Number(first.rowsAffected), 1);
  assert.equal(Number(second.rowsAffected), 0, 'a trade must only be movable once from the status it was read at');

  const book = (await db.execute('SELECT id FROM books LIMIT 1')).rows[0];
  await db.execute({ sql: 'UPDATE books SET available = 1 WHERE id = ?', args: [book.id] });
  const take = await db.execute({ sql: 'UPDATE books SET available = 0 WHERE id = ? AND available = 1', args: [book.id] });
  const takeAgain = await db.execute({ sql: 'UPDATE books SET available = 0 WHERE id = ? AND available = 1', args: [book.id] });
  assert.equal(Number(take.rowsAffected), 1);
  assert.equal(Number(takeAgain.rowsAffected), 0, 'a book must only be reservable once');
});

test('every status a trade can end in has a label of its own', async () => {
  // A finished trade had no entry in the badge table on My Trades, and the
  // fallback dressed anything unknown as "cancelled" — so a student who had
  // just swapped a book was told the trade was called off.
  const page = readFileSync('app/trades/page.tsx', 'utf8');
  const labelled = [...page.matchAll(/^\s{2}(\w+):\s*\{ bg:/gm)].map(m => m[1]);
  for (const status of ['pending', 'accepted', 'rejected', 'cancelled', 'completed']) {
    assert.ok(labelled.includes(status), `My Trades has no badge for a "${status}" trade`);
  }
  // And an unrecognised one must not borrow another status's words.
  assert.match(page, /STATUS_STYLES\[trade\.status\] \?\? UNKNOWN_STATUS/);

  const i18n = readFileSync('lib/i18n.tsx', 'utf8');
  for (const key of ['trades.pending', 'trades.accepted', 'trades.rejected', 'trades.cancelled', 'trades.completed']) {
    assert.ok(i18n.includes(`'${key}':`), `no wording for ${key}`);
  }
});

test('a student who cannot make the meet-up can move it on, and the other is told', async () => {
  const a = await register('SkipA', `skipa${Math.random()}@s.edu`);
  const b = await register('SkipB', `skipb${Math.random()}@s.edu`);
  const ba = await addBook(a, 'SkipBookA', 100);
  const bb = await addBook(b, 'SkipBookB', 100);
  const t = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });

  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const moved = await api(`/api/trades/${t}`, { method: 'PATCH', cookie: a, body: { skip_meeting: soon } });
  assert.equal(moved.status, 200);

  // Both sides read the same "not before" mark, which is what each browser
  // works the next period out from.
  for (const cookie of [a, b]) {
    const row = (await api('/api/trades', { cookie })).json.trades.find(x => x.id === t);
    assert.equal(new Date(row.meet_after).toISOString(), soon, 'both students must work from the same mark');
  }

  // The other student hears about it; the one who moved it does not need to.
  const theirs = (await api('/api/notifications', { cookie: b })).json.notifications ?? [];
  assert.ok(theirs.some(n => n.kind === 'trade_postponed'), 'the other student must be told');
  assert.equal(theirs.find(n => n.kind === 'trade_postponed').actor, 'SkipA');

  // It only ever moves forwards, whoever presses it.
  const earlier = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { skip_meeting: earlier } });
  const after = (await api('/api/trades', { cookie: a })).json.trades.find(x => x.id === t);
  assert.equal(new Date(after.meet_after).toISOString(), soon, 'a later mark must not be pulled back earlier');

  // Nonsense is refused, and so is anybody who is not in the trade.
  const c = await register('SkipC', `skipc${Math.random()}@s.edu`);
  assert.equal((await api(`/api/trades/${t}`, { method: 'PATCH', cookie: c, body: { skip_meeting: soon } })).status, 403);
  for (const bad of ['whenever', new Date(Date.now() - 9 * 86400000).toISOString(), new Date(Date.now() + 200 * 86400000).toISOString()]) {
    const r = await api(`/api/trades/${t}`, { method: 'PATCH', cookie: a, body: { skip_meeting: bad } });
    assert.equal(r.json.error, 'bad_time', `"${bad}" should not be accepted as a time`);
  }
});

test('times the database wrote are read back as the moment they happened', async () => {
  // datetime('now') writes UTC with nothing in the string to say so, and a
  // browser handed it reads it as local time — which is how a notification
  // made at 07:51 in Bangkok was shown as 00:51, and a trade agreed after 7pm
  // UTC was dated the day before.
  const db = createClient({ url: `file:${DB}` });
  const stamp = String((await db.execute("SELECT datetime('now') AS t")).rows[0].t);
  assert.match(stamp, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'the shape parseDbTime is written for');

  // Read as UTC, it is the moment it was written.
  const asUtc = new Date(stamp.replace(' ', 'T') + 'Z');
  const outBy = Math.abs(Date.now() - asUtc.getTime()) / 60000;
  assert.ok(outBy < 5, `reading the stamp as UTC must land on now, was ${outBy.toFixed(1)} minutes out`);

  // Nothing shows a student one of these strings as it stands, nor reads one
  // with a bare new Date(), which is what put the times out.
  const bell = readFileSync('components/NotificationBell.tsx', 'utf8');
  assert.match(bell, /timeAgo\(n\.created_at/, 'the notification list must put its stamps through timeAgo');
  assert.doesNotMatch(bell, /\{n\.created_at\}/, 'a raw database stamp must not be printed');

  const trades = readFileSync('app/trades/page.tsx', 'utf8');
  assert.match(trades, /parseDbTime\(trade\.created_at\)/, 'My Trades must read its dates as UTC');
  assert.doesNotMatch(trades, /new Date\(trade\.created_at\)/, 'a bare new Date() reads the stamp as local time');
});

test('the two ways a meet-up can fail are not the same thing', async () => {
  const a = await register('MissA', `missa${Math.random()}@s.edu`);
  const b = await register('MissB', `missb${Math.random()}@s.edu`);
  const setUp = async (n) => {
    const ba = await addBook(a, `MissBookA${n}`, 100);
    const bb = await addBook(b, `MissBookB${n}`, 100);
    const t = (await api('/api/trades', { method: 'POST', cookie: a, body: { offered_book_id: ba, wanted_book_id: bb } })).json.trade.id;
    await api(`/api/trades/${t}`, { method: 'PATCH', cookie: b, body: { status: 'accepted' } });
    return { t, ba, bb };
  };

  // "I could not be there" moves the meet-up on and leaves the trade standing.
  const mine = await setUp(1);
  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal((await api(`/api/trades/${mine.t}`, { method: 'PATCH', cookie: a, body: { skip_meeting: soon } })).status, 200);
  const stillOn = (await api('/api/trades?status=accepted', { cookie: a })).json.trades.find(x => x.id === mine.t);
  assert.ok(stillOn, 'being the one who could not come must not end the trade');
  assert.equal(new Date(stillOn.meet_after).toISOString(), soon);

  // "They did not come" ends it, hands the books back, and says who reported it.
  const theirs = await setUp(2);
  assert.equal((await api(`/api/trades/${theirs.t}`, { method: 'PATCH', cookie: a, body: { confirm: 'not', reason: 'no_show' } })).status, 200);
  const list = (await api('/api/trades', { cookie: a })).json.trades;
  assert.equal(list.find(x => x.id === theirs.t).status, 'cancelled');
  const books = (await api('/api/books?mine=1', { cookie: a })).json.books;
  assert.equal(books.find(x => x.id === theirs.ba).available, 1, 'the books must go back on the shelves');

  const notes = (await api('/api/notifications', { cookie: b })).json.notifications ?? [];
  assert.equal(notes[0].kind, 'trade_no_show', 'the other student must be told, and told which it was');
  assert.equal(notes[0].actor, 'MissA');
  assert.ok(notes.some(n => n.kind === 'trade_postponed'), 'and told separately when a meet-up only moved');
});

// ── "Sign in with Google" ───────────────────────────────────────────────
//
// The harness's env has no GOOGLE_CLIENT_ID, so the parts of the flow that
// talk to Google (the redirect to its consent screen, the code exchange) are
// not reachable from here — there is no server to fake being Google without
// real credentials. That half was checked by hand against Google's real
// endpoints during development: a fake client id produces a genuine 401 from
// Google's token endpoint, and the callback route turns that into a clean
// redirect rather than a crash. What is tested here is the half that can be:
// the signed "you just verified this email with Google" cookie the callback
// hands to the registration form, and what /api/auth/register does with one —
// since that is where an account actually gets made or not.

// Mirrors lib/googleAuth.ts's signPending() exactly (same secret, same
// namespaced HMAC), so a cookie built here is one the server will accept as
// genuine — there is no other way to get one without a real Google login.
function signGooglePending({ email, name = 'Google Student', sub = 'sub-' + Math.random(), exp }) {
  const body = Buffer.from(JSON.stringify({ email, name, sub, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'test').update('google_pending:' + body).digest('base64url');
  return `${body}.${sig}`;
}
const freshPending = email => signGooglePending({ email, exp: Date.now() + 15 * 60 * 1000 });

test('Google sign-in is invisible until it is configured', async () => {
  // No GOOGLE_CLIENT_ID in this environment: both entry points must say so
  // plainly rather than sending a student into a flow that cannot finish.
  for (const path of ['/api/auth/google', '/api/auth/google/callback?code=x&state=x']) {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    assert.ok(res.status === 302 || res.status === 307, `${path} must redirect, got ${res.status}`);
    assert.match(res.headers.get('location') ?? '', /error=google_not_configured/);
  }
});

test('a verified Google identity creates an account with no password', async () => {
  const email = `googler${Math.random()}@s.edu`;
  const cookie = `google_pending=${freshPending(email)}`;

  // The register page's own prefill call reads the same identity back.
  const peek = await fetch(`${BASE}/api/auth/google/pending`, { headers: { Cookie: cookie } });
  assert.equal(peek.status, 200);
  const peekBody = await peek.json();
  assert.equal(peekBody.email, email);

  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.5.${++ipCounter}`, Cookie: cookie },
    // No password at all — the thing this whole feature is for.
    body: JSON.stringify({ ...SIGNUP, password: undefined, name: `googler${Math.random()}`, email: 'ignored@should-not-be-used.edu' }),
  });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  // The pending cookie's email wins, never whatever the request body claimed —
  // a client cannot be trusted to say which address it owns, only Google
  // having answered can.
  assert.equal(body.user.email, email);

  const db = createClient({ url: `file:${DB}` });
  const row = (await db.execute({ sql: 'SELECT google_sub, password_hash FROM users WHERE lower(email) = ?', args: [email] })).rows[0];
  assert.ok(row.google_sub, 'the account must record which Google identity created it');
  assert.ok(row.password_hash, 'the NOT NULL column must still hold something');

  // The cookie itself is a stateless proof of "this email was verified", good
  // until it expires — it is not a one-time-use token. Replaying it cannot
  // make a second account or take over the first: the email is already taken.
  const replay = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.5.${++ipCounter}`, Cookie: cookie },
    body: JSON.stringify({ ...SIGNUP, password: undefined, name: `googler2${Math.random()}` }),
  });
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).error, 'email_taken');
});

test('a Google identity that has expired or been tampered with is not trusted', async () => {
  const email = `expired${Math.random()}@s.edu`;
  const expired = `google_pending=${signGooglePending({ email, exp: Date.now() - 1000 })}`;
  assert.equal((await fetch(`${BASE}/api/auth/google/pending`, { headers: { Cookie: expired } })).status, 404);

  const fresh = signGooglePending({ email, exp: Date.now() + 15 * 60 * 1000 });
  const tampered = `google_pending=${fresh.slice(0, -1)}${fresh.slice(-1) === 'a' ? 'b' : 'a'}`;
  assert.equal((await fetch(`${BASE}/api/auth/google/pending`, { headers: { Cookie: tampered } })).status, 404);

  // Falls all the way back to the ordinary rule: no valid identity, no
  // password, no account — not a silent bypass.
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.5.${++ipCounter}`, Cookie: expired },
    body: JSON.stringify({ ...SIGNUP, password: undefined, name: `expired${Math.random()}`, email }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /required/i);
});

// ── Push notifications ──────────────────────────────────────────────────
//
// The harness's env has no VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY (deliberately —
// same reasoning as Google above), so the endpoint should say so rather than
// pretend to save a subscription it can never use. Sending a real push and
// having a dead one cleaned up was checked by hand: a well-formed subscription
// against a bogus endpoint gets a genuine 410 back from Google's push
// service, which the app catches and deletes the row for.

test('push subscribing requires a session and a real subscription shape', async () => {
  const cookie = await register(`pushuser${Math.random()}`, `pushuser${Math.random()}@s.edu`);
  const validSub = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'p', auth: 'a' } };

  const noAuth = await api('/api/push/subscribe', { method: 'POST', body: validSub });
  assert.equal(noAuth.status, 401);

  // Not configured in this harness, so even a signed-in, well-formed request
  // is turned away rather than silently accepted and never delivered.
  const notConfigured = await api('/api/push/subscribe', { method: 'POST', cookie, body: validSub });
  assert.equal(notConfigured.status, 400);
  assert.equal(notConfigured.json.error, 'not_configured');
});
