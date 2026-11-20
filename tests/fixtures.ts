import type { InvitationRow } from '../src/lib/content/view-model';
import { COUPLE_TEMPLATE, PARENTS_TEMPLATE } from '../src/templates/manifest';
export function fixture(audience: 'couple' | 'groom-parents' | 'bride-parents' = 'couple'): InvitationRow {
  const bride = audience === 'bride-parents';
  const parent = audience !== 'couple';
  const date = bride ? '2027-01-02' : '2027-01-01';
  return {
    slug: bride ? 's6jtlzuaybjru' : parent ? 's10nxtffcpevs' : 'sddlh4zxebmfx',
    albumSlug: parent ? 'photoabc123def456' : 'photoerr123abc456',
    templateKey: parent ? PARENTS_TEMPLATE : COUPLE_TEMPLATE, templateVersion: 1, contentVersion: 2,
    content: JSON.stringify({
      audience, groom: { name: '测试新郎' }, bride: { name: '测试新娘' },
      people: bride ? [{ id: 'bride', label: '女儿' }, { id: 'groom', label: '女婿' }]
        : [{ id: 'groom', label: parent ? '儿子' : '新郎' }, { id: 'bride', label: parent ? '儿媳' : '新娘' }],
      hosts: audience === 'groom-parents' ? [{ label: '父亲', name: '测试父亲' }, { label: '母亲', name: '测试母亲' }] : [],
      familyLabel: parent ? '测试府' : null,
      weddingAt: `${date}T10:00:00+08:00`, timezone: 'Asia/Shanghai', lunarText: bride ? '农历十一月廿五' : '农历十一月廿四',
      events: [{ type: 'banquet', title: '喜宴', receptionAt: `${date}T09:30:00+08:00`, startsAt: `${date}T12:00:00+08:00`, venue: bride ? '女方测试场地' : '男方测试场地', address: '测试地址', navigation: { provider: 'amap', keyword: '测试场地', city: '太原' } }],
      copy: { envelopeRoles: parent ? '测试称呼' : null, heroTagline: '我们结婚啦', announcement: ['喜结良缘'], inviteLines: ['诚邀您来'], countdownPrefix: '静候佳期', countdownDone: '良缘已缔', thanks: { title: '感谢见证', message: '期待相聚' } },
      gallery: [{ url: 'https://image.minvitation.site/myphotos/section_1.webp', width: 1599, height: 2133, alt: '测试照片' }],
      legal: { icpNumber: '测试备案号', owner: '测试主办者', url: 'https://beian.miit.gov.cn/' },
    }),
    templateOptions: JSON.stringify({ opening: 'envelope', autoScroll: true, showCountdown: true, showCalendar: !parent }),
    shareTitle: null, shareDescription: null, shareImageUrl: null, noindex: true,
  };
}
export const fixtureTable = `CREATE TABLE invitations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, album_slug TEXT, status TEXT NOT NULL DEFAULT 'draft',
 template_key TEXT NOT NULL, template_version INTEGER NOT NULL DEFAULT 1, content_version INTEGER NOT NULL DEFAULT 1,
 content TEXT NOT NULL, template_options TEXT, share_title TEXT, share_description TEXT, share_image_url TEXT,
 noindex INTEGER NOT NULL DEFAULT 1, preview_token TEXT, wedding_date TEXT NOT NULL,
 published_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
)`;
