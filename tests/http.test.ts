import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import Database from 'better-sqlite3';
import { fixture, fixtureTable } from './fixtures';

const dir = mkdtempSync(join(tmpdir(), 'shining-star-http-'));
let server: ChildProcess; let base: string; let output = '';
before(async () => {
  const db = new Database(join(dir, 'test.db')); db.exec(fixtureTable);
  const insert = db.prepare('INSERT INTO invitations (slug,status,template_key,template_version,content_version,content,template_options,noindex,wedding_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  for (const audience of ['couple', 'groom-parents', 'bride-parents'] as const) {
    const row = fixture(audience); insert.run(row.slug, 'published', row.templateKey, 1, 2, row.content, row.templateOptions, 1, '2027-01-01', 1, 1);
  }
  const row = fixture();
  insert.run('sdraftabc1234', 'draft', row.templateKey, 1, 2, row.content, row.templateOptions, 1, '2027-01-01', 1, 1);
  insert.run('sbrokenab1234', 'published', row.templateKey, 1, 2, '{broken', row.templateOptions, 1, '2027-01-01', 1, 1);
  insert.run('legacy-4abc', 'published', 'classic-red', 1, 1, row.content, null, 1, '2027-01-01', 1, 1); db.close();
  const probe = createServer(); await new Promise<void>((done) => probe.listen(0, '127.0.0.1', done));
  const port = (probe.address() as { port: number }).port; await new Promise<void>((done) => probe.close(() => done())); base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [resolve('dist/server/entry.mjs')], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(port), DATABASE_PATH: join(dir, 'test.db'), SITE_URL: 'https://test.example' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout?.on('data', (chunk) => { output += chunk; }); server.stderr?.on('data', (chunk) => { output += chunk; });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { await fetch(base); return; } catch { if (server.exitCode !== null) throw new Error(output); await new Promise((done) => setTimeout(done, 50)); }
  }
  throw new Error('Standalone server did not start: ' + output);
});
after(async () => { if (server && server.exitCode === null) { server.kill(); await new Promise((done) => server.once('exit', done)); } rmSync(dir, { recursive: true, force: true }); });

test('API returns full data for all three independent slugs and keeps media URLs', async () => {
  const results = await Promise.all(['sddlh4zxebmfx', 's10nxtffcpevs', 's6jtlzuaybjru'].map(async (slug) => {
    const response = await fetch(`${base}/api/v1/invitations/${slug}`); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const { data } = await response.json(); assert.equal(data.slug, slug); assert.equal(data.gallery.length, 1); assert.ok(data.meta); return data;
  }));
  assert.equal(results[1].templateId, results[2].templateId); assert.equal(results[2].people[0].label, '女儿');
  assert.doesNotMatch(JSON.stringify(results[2]), /测试父亲|测试母亲|previewToken|DATABASE_PATH/);
});

test('SSR serves meaningful static HTML and metadata, with legacy pages intact', async () => {
  const response = await fetch(`${base}/s6jtlzuaybjru`); const html = await response.text();
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /s-maxage=60/);
  assert.match(html, /女方测试场地/); assert.match(html, /2027年1月2日/); assert.match(html, /<title>[^<]*测试新娘/);
  assert.match(html, /https:\/\/test.example\/s6jtlzuaybjru/); assert.match(html, /og:image/);
  assert.doesNotMatch(html, /测试父亲|测试母亲/); assert.match(html, /<main[^>]*invitation-content/);
  const legacy = await fetch(`${base}/legacy-4abc`); assert.equal(legacy.status, 200); assert.match(await legacy.text(), /测试新郎/);
});

test('queries cannot switch audience; API and error states retain proper methods and caching', async () => {
  const response = await fetch(`${base}/api/v1/invitations/s6jtlzuaybjru?from=groom-parents`);
  assert.equal((await response.json()).data.audience, 'bride-parents');
  for (const slug of ['unknown', 'sdraftabc1234', 'legacy-4abc']) {
    const missing = await fetch(`${base}/api/v1/invitations/${slug}`); assert.equal(missing.status, 404); assert.equal(missing.headers.get('cache-control'), 'no-store');
  }
  const broken = await fetch(`${base}/api/v1/invitations/sbrokenab1234`); assert.equal(broken.status, 500); assert.equal((await broken.json()).error.code, 'INVITATION_UNAVAILABLE');
  const post = await fetch(`${base}/api/v1/invitations/sddlh4zxebmfx`, { method: 'POST' }); assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD');
  const head = await fetch(`${base}/api/v1/invitations/sddlh4zxebmfx`, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  for (const suffix of ['?x=1', '']) {
    const page = await fetch(`${base}/sddlh4zxebmfx${suffix}`, { headers: { Cookie: 'test=1' } }); assert.equal(page.headers.get('cache-control'), 'no-store');
  }
});
