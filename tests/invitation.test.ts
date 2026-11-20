import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvitationData } from '../src/lib/content/view-model';
import { albumSlugSchema, generatedSlugSchema, importRecordSchema } from '../src/lib/content/invitation-schema';
import { DEFAULT_MUSIC } from '../src/templates/manifest';
import { templateView } from '../src/lib/content/template-view';
import { fixture } from './fixtures';

test('three slugs share two templates with independent dates, order and signatures', () => {
  const [couple, groom, bride] = ['couple', 'groom-parents', 'bride-parents'].map((audience) => buildInvitationData(fixture(audience as 'couple' | 'groom-parents' | 'bride-parents')));
  assert.notEqual(couple.templateId, groom.templateId);
  assert.equal(groom.templateId, bride.templateId);
  assert.equal(groom.albumSlug, bride.albumSlug);
  assert.notEqual(groom.slug, bride.slug);
  assert.equal(bride.people[0].label, '女儿');
  assert.equal(bride.people[1].label, '女婿');
  assert.equal(bride.wedding.dateText, '2027年1月2日');
  assert.equal(bride.wedding.weekdayText, '星期六');
  assert.equal(groom.wedding.dateText, '2027年1月1日');
  assert.equal(groom.hostSignature, '测试父亲 · 测试母亲 敬邀');
  assert.deepEqual(bride.hosts, []); assert.equal(bride.hostSignature, null);
  assert.doesNotMatch(JSON.stringify(bride), /测试父亲|测试母亲/);
  assert.equal(bride.banquet.receptionText, '09:30'); assert.equal(bride.banquet.startsText, '12:00');
  assert.match(bride.wedding.at, /T10:00/);
  assert.equal(bride.meta.canonicalPath, `/${bride.slug}`);
});

test('gallery is backend data: changing order, empty gallery and music off preserve meaning', () => {
  const row = fixture(); const content = JSON.parse(row.content);
  const second = { ...content.gallery[0], url: 'https://image.minvitation.site/myphotos/section_2.webp' };
  content.gallery = [second, content.gallery[0]]; content.musicUrl = null;
  row.content = JSON.stringify(content);
  const data = buildInvitationData(row);
  assert.equal(data.gallery[0].url, second.url); assert.equal(data.music.url, null);
  content.gallery = [{ url: second.url, alt: '不含宽高的相册照片' }]; row.content = JSON.stringify(content);
  assert.deepEqual(buildInvitationData(row).gallery, content.gallery);
  content.gallery = []; delete content.musicUrl; row.content = JSON.stringify(content);
  assert.deepEqual(buildInvitationData(row).gallery, []);
  assert.equal(buildInvitationData(row).music.url, DEFAULT_MUSIC);
  delete content.gallery; row.content = JSON.stringify(content);
  assert.deepEqual(buildInvitationData(row).gallery, []);
});

test('unsafe data, invalid versions and accidental cross-family signatures fail closed', () => {
  for (const change of [
    (row: ReturnType<typeof fixture>) => { row.templateVersion = 99; },
    (row: ReturnType<typeof fixture>) => { row.contentVersion = 99; },
    (row: ReturnType<typeof fixture>) => { row.albumSlug = '../other-album'; },
    (row: ReturnType<typeof fixture>) => { row.templateKey = 'tabc123def456'; },
    (row: ReturnType<typeof fixture>) => { const c = JSON.parse(row.content); c.gallery[0].url = 'javascript:alert(1)'; row.content = JSON.stringify(c); },
    (row: ReturnType<typeof fixture>) => { const c = JSON.parse(row.content); c.gallery[0].width = 0; row.content = JSON.stringify(c); },
    (row: ReturnType<typeof fixture>) => { const c = JSON.parse(row.content); c.hosts = [{ label: '父亲', name: '错误父亲' }]; row.content = JSON.stringify(c); },
    (row: ReturnType<typeof fixture>) => { row.templateOptions = '{"showCalendar":true}'; },
  ]) {
    const row = fixture('bride-parents'); change(row); assert.throws(() => buildInvitationData(row));
  }
});

test('new slugs require opaque alphanumeric identifiers', () => {
  for (const value of ['groom-parents', 'zj-lzy-1234', 'S123abc456def', 'sabcdefghijkl', 's123456789012']) assert.equal(generatedSlugSchema.safeParse(value).success, false);
  assert.equal(generatedSlugSchema.safeParse('sddlh4zxebmfx').success, true);
  assert.equal(albumSlugSchema.safeParse('photoabc123def456').success, true);
  for (const value of ['phoptabc123def456', 's6jtlzuaybjru', 'photo../secret', 'photoABC123def456']) assert.equal(albumSlugSchema.safeParse(value).success, false);
});

test('import contract matches the runtime DTO validation', () => {
  const row = fixture(); const data = buildInvitationData(row);
  const record = { slug: row.slug, templateId: row.templateKey, templateVersion: 1, contentVersion: 2,
    content: JSON.parse(row.content), templateOptions: data.templateOptions, shareTitle: null, shareDescription: null, shareImage: data.meta.image, noindex: true };
  assert.equal(importRecordSchema.parse(record).slug, row.slug);
  assert.equal(importRecordSchema.safeParse({ ...record, templateId: 'th0sxg4o5vj81' }).success, false);
  assert.equal(importRecordSchema.safeParse({ ...record, shareImage: { url: data.meta.image.url, alt: '分享封面' } }).success, false);
});

test('custom cover and avatars survive data validation without inheriting personal media or legal details', () => {
  const row = fixture(); const content = JSON.parse(row.content);
  const cover = { url: 'https://images.example.com/demo-cover.jpg', width: 900, height: 1200, alt: '演示封面' };
  content.media = { cover, groomAvatarUrl: 'https://images.example.com/groom.jpg', brideAvatarUrl: 'https://images.example.com/bride.jpg' };
  content.shareImage = cover; content.legal = null; content.gallery = [];
  row.shareImageUrl = cover.url; row.content = JSON.stringify(content);
  const data = buildInvitationData(row); const view = templateView(data);
  assert.deepEqual(view.cover, cover); assert.equal(view.groom.avatar, content.media.groomAvatarUrl);
  assert.equal(view.bride.avatar, content.media.brideAvatarUrl); assert.equal(view.icp, null);
  assert.equal(data.meta.image.url, cover.url); assert.equal(data.legal, null);
  assert.doesNotMatch(JSON.stringify(data), /myphotos/);
  const original = templateView(buildInvitationData(fixture()));
  assert.match(original.cover.url, /myphotos\/header.webp/); assert.ok(original.icp);
});
