// Metadata stays independent of React so API/import tools never load UI bundles.
export const COUPLE_TEMPLATE = 'tc00ufeo7r67y';
export const PARENTS_TEMPLATE = 'th0sxg4o5vj81';
export const DEFAULT_MUSIC = 'https://image.minvitation.site/auido/jintianwoyaojiageini-96k.mp3';
export const SHARE_IMAGE = {
  url: 'https://image.minvitation.site/myphotos/share-cover.jpg',
  width: 600,
  height: 600,
};
export const templates = {
  [COUPLE_TEMPLATE]: { version: 1, audiences: ['couple'], themeColor: '#931434', showCalendar: true },
  [PARENTS_TEMPLATE]: { version: 1, audiences: ['groom-parents', 'bride-parents'], themeColor: '#a51020', showCalendar: false },
} as const;

export function findTemplate(id: string) {
  return Object.hasOwn(templates, id) ? templates[id as keyof typeof templates] : null;
}
