import type { InvitationData } from './invitation-schema';

// Server-only presentation adapter: no global mutable invitation state and no hydration.
export function templateView(data: InvitationData) {
  const people = data.people.map((p) => ({ ...p, role: p.label, fullName: p.name }));
  return {
    data, people,
    groom: { ...people.find((p) => p.id === 'groom')!, avatar: 'https://image.minvitation.site/myphotos/groom_avatar.webp' },
    bride: { ...people.find((p) => p.id === 'bride')!, avatar: 'https://image.minvitation.site/myphotos/bride_avatar.webp' },
    hosts: data.hosts, hostLine: data.hostSignature,
    date: data.wedding.at, dateText: data.wedding.dateText, weekdayText: data.wedding.weekdayText, lunarText: data.wedding.lunarText,
    banquet: { ...data.banquet, reception: data.banquet.receptionText, time: data.banquet.startsText },
    amap: data.banquet.navigation, gallery: data.gallery,
    announcement: data.copy.announcement, heroTagline: data.copy.heroTagline, inviteLines: data.copy.inviteLines,
    countdownPrefix: data.copy.countdownPrefix, countdownDone: data.copy.countdownDone, thanks: data.copy.thanks,
    icp: { number: data.legal.icpNumber, owner: data.legal.owner, href: data.legal.url },
  };
}
export type TemplateView = ReturnType<typeof templateView>;
