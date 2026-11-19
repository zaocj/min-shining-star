import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { fixture, fixtureTable } from './fixtures';
import { buildInvitationData } from '../src/lib/content/view-model';

test('import dry-run, transaction update, idempotence, backup and collision guard', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shining-star-import-'));
  const databasePath = join(dir, 'test.db'); const jsonFile = join(dir, 'invitations.json');
  const db = new Database(databasePath); db.exec(fixtureTable);
  const row = fixture(); const data = buildInvitationData(row);
  const record = { slug: row.slug, templateId: row.templateKey, templateVersion: 1, contentVersion: 2,
    content: JSON.parse(row.content), templateOptions: data.templateOptions, shareTitle: null, shareDescription: null,
    shareImage: { ...data.meta.image, url: 'https://image.minvitation.site/custom-cover.jpg', width: 1200, height: 630 }, noindex: true };
  const run = (...flags: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', resolve('scripts/invitation-import.ts'), jsonFile, ...flags], {
    cwd: dir, env: { ...process.env, DATABASE_PATH: databasePath }, encoding: 'utf8',
  });
  const count = () => (db.prepare('SELECT count(*) as n FROM invitations').get() as { n: number }).n;
  try {
    writeFileSync(jsonFile, JSON.stringify([record]));
    assert.equal(run().status, 0); assert.equal(count(), 0);
    const imported = run('--apply', '--publish'); assert.equal(imported.status, 0, imported.stderr); assert.match(imported.stdout, /备份/); assert.equal(count(), 1);
    assert.equal(run('--apply', '--publish').status, 0); assert.equal(count(), 1);
    const stored = db.prepare('SELECT status,content FROM invitations').get() as { status: string; content: string };
    assert.equal(stored.status, 'published'); assert.equal(JSON.parse(stored.content).shareImage.width, 1200);
    record.content.groom.name = '另一个新人'; writeFileSync(jsonFile, JSON.stringify([record]));
    assert.notEqual(run('--apply').status, 0); assert.equal(count(), 1);
    assert.equal(JSON.parse((db.prepare('SELECT content FROM invitations').get() as { content: string }).content).groom.name, '测试新郎');
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});
