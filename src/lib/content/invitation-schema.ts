import { z } from 'zod';
import { findTemplate } from '../../templates/manifest.ts';

const text = z.string().trim().min(1).max(2000);
export const albumSlugSchema = z.string().regex(/^photo[a-z0-9]{12}$/, '相册 slug 必须是 photo 加 12 位小写字母或数字');
export const generatedSlugSchema = z.string().regex(/^s[a-z0-9]{12}$/)
  .refine((v) => /[a-z]/.test(v.slice(1)) && /[0-9]/.test(v.slice(1)), '随机部分须包含字母和数字');
export const templateIdSchema = z.string().regex(/^t[a-z0-9]{12}$/)
  .refine((v) => /[a-z]/.test(v.slice(1)) && /[0-9]/.test(v.slice(1)));
export const httpsUrlSchema = z.url().refine((v) => {
  const url = new URL(v);
  return url.protocol === 'https:' && !url.username && !url.password;
}, '资源必须使用绝对 HTTPS URL');
const at = z.iso.datetime({ offset: true });
const personId = z.enum(['groom', 'bride']);
const audience = z.enum(['couple', 'groom-parents', 'bride-parents']);
const host = z.object({ label: text, name: text });
export const photoSchema = z.object({
  url: httpsUrlSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: text,
});
const galleryPhotoSchema = photoSchema.partial({ width: true, height: true });
const mediaSchema = z.object({ cover: photoSchema, groomAvatarUrl: httpsUrlSchema, brideAvatarUrl: httpsUrlSchema });
const copySchema = z.object({
  envelopeRoles: text.nullable(), heroTagline: text,
  announcement: z.array(text).min(1), inviteLines: z.array(text).min(1),
  countdownPrefix: text, countdownDone: text,
  thanks: z.object({ title: text, message: text }),
});
const navigation = z.object({ provider: z.literal('amap'), keyword: text, city: text });
const personOrder = z.array(z.object({ id: personId, label: text })).length(2)
  .refine((people) => new Set(people.map((p) => p.id)).size === 2, '双方必须各出现一次');

export const storedContentSchema = z.object({
  audience,
  groom: z.object({ name: text }), bride: z.object({ name: text }),
  people: personOrder,
  hosts: z.array(host).max(10), familyLabel: text.nullable(),
  weddingAt: at, timezone: z.literal('Asia/Shanghai'), lunarText: text.nullable(),
  events: z.array(z.object({
    type: z.literal('banquet'), title: text,
    receptionAt: at, startsAt: at, venue: text, address: text, navigation,
  })).length(1),
  copy: copySchema,
  gallery: z.array(galleryPhotoSchema).max(200).default([]),
  shareImage: photoSchema.optional(),
  media: mediaSchema.optional(),
  musicUrl: httpsUrlSchema.nullable().optional(),
  legal: z.object({ icpNumber: text, owner: text, url: httpsUrlSchema }).nullable(),
}).superRefine((value, ctx) => {
  if (value.audience === 'bride-parents' && value.hosts.length) {
    ctx.addIssue({ code: 'custom', path: ['hosts'], message: '女方父母版不公开父母姓名' });
  }
  if (value.audience === 'couple' && value.hosts.length) {
    ctx.addIssue({ code: 'custom', path: ['hosts'], message: '新人版不展示父母署名' });
  }
  const expected = value.audience === 'bride-parents'
    ? [['bride', '女儿'], ['groom', '女婿']]
    : value.audience === 'groom-parents'
      ? [['groom', '儿子'], ['bride', '儿媳']]
      : [['groom', '新郎'], ['bride', '新娘']];
  if (value.people.some((p, i) => p.id !== expected[i][0] || p.label !== expected[i][1])) {
    ctx.addIssue({ code: 'custom', path: ['people'], message: '人物顺序或称呼与邀请人视角不符' });
  }
  const event = value.events[0];
  const date = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: value.timezone }).format(new Date(iso));
  if (date(event.startsAt) !== date(value.weddingAt) || date(event.receptionAt) !== date(value.weddingAt) || Date.parse(event.receptionAt) > Date.parse(event.startsAt)) {
    ctx.addIssue({ code: 'custom', path: ['events'], message: '婚宴日期或迎宾/开席顺序不正确' });
  }
});

export const templateOptionsSchema = z.object({
  opening: z.enum(['envelope', 'none']).default('envelope'),
  autoScroll: z.boolean().default(true),
  showCountdown: z.boolean().default(true),
  showCalendar: z.boolean().default(false),
}).strict();

export const invitationDataSchema = z.object({
  schemaVersion: z.literal(1), slug: generatedSlugSchema,
  albumSlug: albumSlugSchema.nullable(),
  templateId: templateIdSchema, templateVersion: z.literal(1), audience,
  people: z.array(z.object({ id: personId, name: text, label: text })).length(2),
  hosts: z.array(host), hostSignature: text.nullable(), familyLabel: text.nullable(),
  wedding: z.object({ at, timezone: z.literal('Asia/Shanghai'), dateText: text, weekdayText: text, lunarText: text.nullable() }),
  banquet: z.object({ title: text, receptionAt: at, startsAt: at, receptionText: text, startsText: text, venue: text, address: text, navigation }),
  copy: copySchema, gallery: z.array(galleryPhotoSchema), music: z.object({ url: httpsUrlSchema.nullable() }),
  media: mediaSchema.optional(),
  templateOptions: templateOptionsSchema,
  meta: z.object({ title: text, description: text, canonicalPath: text, image: photoSchema, noindex: z.boolean() }),
  legal: z.object({ icpNumber: text, owner: text, url: httpsUrlSchema }).nullable(),
});

export const importRecordSchema = z.object({
  slug: generatedSlugSchema, templateId: templateIdSchema,
  albumSlug: albumSlugSchema.nullable().optional(),
  templateVersion: z.literal(1), contentVersion: z.literal(2),
  content: storedContentSchema, templateOptions: templateOptionsSchema,
  shareTitle: text.nullable(), shareDescription: text.nullable(),
  shareImage: photoSchema, noindex: z.boolean(),
}).superRefine((value, ctx) => {
  const template = findTemplate(value.templateId);
  if (!template || !(template.audiences as readonly string[]).includes(value.content.audience)) {
    ctx.addIssue({ code: 'custom', path: ['templateId'], message: '模板与邀请人视角不匹配' });
  }
  if (value.templateOptions.showCalendar && !template?.showCalendar) {
    ctx.addIssue({ code: 'custom', path: ['templateOptions', 'showCalendar'], message: '此模板不支持日历' });
  }
});

export type InvitationData = z.infer<typeof invitationDataSchema>;
export type StoredContent = z.infer<typeof storedContentSchema>;
export type ImportRecord = z.infer<typeof importRecordSchema>;
