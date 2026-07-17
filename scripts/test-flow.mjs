// Integration tests for the core trade logic. Spawns `next dev` against a
// throwaway file database and drives the real HTTP API, asserting the
// invariants that subtle bugs hide behind (double-accept, busy books,
// confirm-after-cancel, ownership transfer, price rule).
//
// Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

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
  const r = await api('/api/auth/register', { method: 'POST', body: { name, email, password: 'secret6' }, ip: `10.0.0.${++ipCounter}` });
  return r.cookie;
}
async function addBook(cookie, title, price) {
  const r = await api('/api/books', { method: 'POST', cookie, body: { title, author: 'a', condition: 'Good', price } });
  return r.json.book.id;
}

before(async () => {
  rmSync(DB, { force: true });
  execSync(`printf 'TURSO_DATABASE_URL=file:${DB}\\nSESSION_SECRET=test\\n' > .env.local`, { shell: '/bin/bash' });
  execSync('npm run db:init', { stdio: 'ignore' });
  server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { stdio: 'ignore', env: process.env });
  // Wait for readiness.
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/'); if (r.ok) break; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
});

after(() => {
  server?.kill('SIGKILL');
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
