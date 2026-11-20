import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { albumSlugSchema } from '../src/lib/content/invitation-schema';
import { fixture, fixtureTable } from './fixtures';

test('album migration backs up once and assignment shares stable photo slugs without changing content', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shining-star-albums-'));
  const path = join(directory, 'test.db');
  const db = new Database(path);
  db.exec(fixtureTable.replace('album_slug TEXT, ', ''));
  const rows = [fixture('groom-parents'), fixture('bride-parents')];
  const insert = db.prepare('INSERT INTO invitations (slug,template_key,content,wedding_date,created_at,updated_at) VALUES (?,?,?,?,?,?)');
  for (const row of rows) insert.run(row.slug, row.templateKey, row.content, '2027-01-01', 1, 1);
  const run = (...args: string[]) => spawnSync(process.execPath, ['--experimental-strip-types', resolve('scripts/albums.ts'), ...args], {
    cwd: directory, env: { ...process.env, DATABASE_PATH: path }, encoding: 'utf8',
  });
  const hasColumn = () => (db.pragma('table_info(invitations)') as Array<{ name: string }>).some((column) => column.name === 'album_slug');
  const albums = () => (db.prepare('SELECT album_slug FROM invitations ORDER BY id').all() as Array<{ album_slug: string | null }>).map((row) => row.album_slug);
  try {
    assert.equal(run('migrate').status, 0); assert.equal(hasColumn(), false);
    const migration = run('migrate', '--apply'); assert.equal(migration.status, 0, migration.stderr);
    assert.equal(hasColumn(), true); assert.deepEqual(albums(), [null, null]);
    const backup = readdirSync(join(directory, 'backups'))[0];
    const snapshot = new Database(join(directory, 'backups', backup), { readonly: true });
    assert.equal((snapshot.pragma('table_info(invitations)') as Array<{ name: string }>).some((column) => column.name === 'album_slug'), false);
    assert.equal((snapshot.prepare('SELECT count(*) AS n FROM invitations').get() as { n: number }).n, 2); snapshot.close();
    assert.equal(run('migrate', '--apply').status, 0); assert.equal(readdirSync(join(directory, 'backups')).length, 1);
    const slugs = rows.map((row) => row.slug);
    assert.equal(run('assign', ...slugs).status, 0); assert.deepEqual(albums(), [null, null]);
    assert.notEqual(run('assign', slugs[0], 'sunknown12345', '--apply').status, 0); assert.deepEqual(albums(), [null, null]);
    const assignment = run('assign', ...slugs, '--apply'); assert.equal(assignment.status, 0, assignment.stderr);
    const album = albums()[0]; assert.ok(albumSlugSchema.safeParse(album).success);
    assert.deepEqual(albums(), [album, album]);
    const backupCount = readdirSync(join(directory, 'backups')).length;
    assert.equal(run('assign', ...slugs, '--apply').status, 0); assert.deepEqual(albums(), [album, album]);
    assert.equal(readdirSync(join(directory, 'backups')).length, backupCount);
    assert.equal(run('assign', slugs[1], '--album', 'photoabc123def456', '--apply').status, 0);
    assert.deepEqual(albums(), [album, 'photoabc123def456']);
    assert.notEqual(run('assign', ...slugs, '--apply').status, 0);
    assert.notEqual(run('assign', slugs[0], '--album', '../private', '--apply').status, 0);
    assert.deepEqual(albums(), [album, 'photoabc123def456']);
    const stored = db.prepare('SELECT content FROM invitations ORDER BY id').all() as Array<{ content: string }>;
    assert.deepEqual(stored.map((row) => row.content), rows.map((row) => row.content));
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
