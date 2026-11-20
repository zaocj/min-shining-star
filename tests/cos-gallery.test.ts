import test from 'node:test';
import assert from 'node:assert/strict';
import { createCosGallery, type GalleryStorage } from '../src/lib/repositories/cos-gallery';

const config = { secretId: 'test-id', secretKey: 'test-key', bucket: 'photos-1250000000', region: 'ap-guangzhou', publicBaseUrl: 'https://images.example.com/' };
const slug = 'photoabc123def456';
const prefix = `usersphotos/${slug}/`;
const object = (name: string) => ({ Key: prefix + name, Size: '100' });

test('COS paginates an exact slug prefix, filters files, sorts numerically and encodes URLs', async () => {
  const calls: Array<[string, string | undefined]> = [];
  const storage: GalleryStorage = {
    async list(key, marker) {
      calls.push([key, marker]);
      return marker ? { Contents: [object('2.png'), object('照片 #3.PNG'), object('nested/4.webp')], IsTruncated: 'false' }
        : { Contents: [object('10.jpg'), object('1.png'), object(''), object('note.txt'), object('bad.svg'),
          { ...object('empty.png'), Size: '0' }, { ...object('outside.png'), Key: `usersphotos/${slug}other/1.png` },
          object('../escape.png')], IsTruncated: 'true', NextMarker: 'page-2' };
    },
  };
  const photos = await createCosGallery(config, storage)(slug);
  assert.deepEqual(calls, [[prefix, undefined], [prefix, 'page-2']]);
  assert.deepEqual(photos.slice(0, 3).map((photo) => photo.url.split('/').pop()), ['1.png', '2.png', '10.jpg']);
  assert.equal(photos.length, 5);
  assert.ok(photos.some((photo) => photo.url.endsWith('/%E7%85%A7%E7%89%87%20%233.PNG')));
  assert.ok(photos.some((photo) => photo.url.endsWith('/nested/4.webp')));
  assert.deepEqual(Object.keys(photos[0]).sort(), ['alt', 'url']);
});

test('cache deduplicates concurrent loads and refreshes the gallery after expiry', async () => {
  let time = 0; let listings = 0; let name = '1.png';
  const gallery = createCosGallery(config, {
    async list() { listings++; return { Contents: [object(name)], IsTruncated: 'false' }; },
  }, () => time);
  const [a, b] = await Promise.all([gallery(slug), gallery(slug)]);
  assert.deepEqual(a, b); assert.equal(listings, 1);
  await gallery(slug); assert.equal(listings, 1);
  time = 60_001; await gallery(slug); assert.equal(listings, 2);
  name = '2.png'; time += 60_001;
  assert.ok((await gallery(slug))[0].url.endsWith('/2.png'));
  await gallery('photodef456abc123'); assert.equal(listings, 4);
});

test('empty folders stay empty; invalid slugs never reach COS', async () => {
  let calls = 0;
  const gallery = createCosGallery(config, {
    async list() { calls++; return { Contents: [], IsTruncated: 'false' }; },
  });
  assert.deepEqual(await gallery(slug), []);
  for (const invalid of ['../secret', 's6jtlzuaybjru', `${slug}/other`, 'unknown', 'phoptabc123def456']) await assert.rejects(gallery(invalid));
  assert.equal(calls, 1);
});

test('COS errors are not cached or replaced with old photos; malformed pagination fails', async () => {
  let calls = 0;
  const gallery = createCosGallery(config, {
    async list() { if (calls++ === 0) throw new Error('AccessDenied'); return { Contents: [], IsTruncated: 'false' }; },
  });
  await assert.rejects(gallery(slug), /AccessDenied/);
  assert.deepEqual(await gallery(slug), []); assert.equal(calls, 2);
  for (const NextMarker of [undefined, 'same']) {
    const broken = createCosGallery(config, {
      async list() { return { Contents: [], IsTruncated: 'true', NextMarker }; },
    });
    await assert.rejects(broken(slug), /pagination marker/);
  }
});

test('COS configuration requires credentials and a public HTTPS origin', () => {
  for (const field of ['secretId', 'secretKey', 'bucket', 'region'] as const) {
    assert.throws(() => createCosGallery({ ...config, [field]: '' }), /configuration missing/);
  }
  for (const publicBaseUrl of ['http://images.example.com', 'https://images.example.com/path', 'https://images.example.com/?token=x', 'https://user:pass@images.example.com']) {
    assert.throws(() => createCosGallery({ ...config, publicBaseUrl }));
  }
});
