import { invitationDataSchema, storedContentSchema, templateOptionsSchema } from './invitation-schema.ts';
import { DEFAULT_MUSIC, findTemplate, SHARE_IMAGE } from '../../templates/manifest.ts';

export interface InvitationRow {
  slug: string; albumSlug: string | null; templateKey: string; templateVersion: number; contentVersion: number;
  content: string; templateOptions: string | null;
  shareTitle: string | null; shareDescription: string | null; shareImageUrl: string | null; noindex: boolean;
}

export function buildInvitationData(row: InvitationRow) {
  const template = findTemplate(row.templateKey);
  if (!template || row.templateVersion !== template.version || row.contentVersion !== 2) {
    throw new Error('Unsupported invitation template or content version');
  }
  const content = storedContentSchema.parse(JSON.parse(row.content));
  if (!(template.audiences as readonly string[]).includes(content.audience)) throw new Error('Template/audience mismatch');
  const options = templateOptionsSchema.parse({ showCalendar: template.showCalendar, ...JSON.parse(row.templateOptions ?? '{}') });
  if (options.showCalendar && !template.showCalendar) throw new Error('Calendar not supported by this template');
  const date = new Date(content.weddingAt);
  const dateText = new Intl.DateTimeFormat('zh-CN', { timeZone: content.timezone, year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  const weekdayText = new Intl.DateTimeFormat('zh-CN', { timeZone: content.timezone, weekday: 'long' }).format(date);
  const clock = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: content.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  const people = content.people.map((p) => ({ ...p, name: content[p.id].name }));
  const hostSignature = content.hosts.length ? `${content.hosts.map((host) => host.name).join(' · ')} 敬邀` : null;
  const event = content.events[0];
  const shareUrl = row.shareImageUrl ?? SHARE_IMAGE.url;
  const shareImage = content.shareImage?.url === shareUrl ? content.shareImage
    : shareUrl === SHARE_IMAGE.url ? { ...SHARE_IMAGE, alt: `${content.groom.name}与${content.bride.name}的婚纱合照` } : null;
  if (!shareImage) throw new Error('Share image metadata is missing');
  const title = row.shareTitle ?? `${people.map((p) => p.name).join(' & ')} · 婚礼请柬`;
  const description = row.shareDescription ?? `${people.map((p) => `${p.label}${p.name}`).join('与')}诚邀您于${dateText}莅临${event.venue}，${clock(event.receptionAt)}迎宾，${clock(event.startsAt)}开席。`;
  return invitationDataSchema.parse({
    schemaVersion: 1, slug: row.slug, albumSlug: row.albumSlug, templateId: row.templateKey, templateVersion: row.templateVersion,
    audience: content.audience, people, hosts: content.hosts, hostSignature, familyLabel: content.familyLabel,
    wedding: { at: content.weddingAt, timezone: content.timezone, dateText, weekdayText, lunarText: content.lunarText },
    banquet: { ...event, receptionText: clock(event.receptionAt), startsText: clock(event.startsAt) },
    copy: content.copy, gallery: content.gallery, media: content.media,
    music: { url: content.musicUrl === undefined ? DEFAULT_MUSIC : content.musicUrl },
    templateOptions: options,
    meta: {
      title, description, canonicalPath: `/${row.slug}`, noindex: row.noindex,
      image: shareImage,
    },
    legal: content.legal,
  });
}
