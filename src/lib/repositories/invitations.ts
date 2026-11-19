import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { invitations } from '../db/schema';
import { coupleSchema } from '../content/schema';

const reservedSlugs = new Set([
  'api', 'admin', 'assets', 'static', '_astro', 'health', 'robots.txt',
  'favicon.ico', 'sitemap.xml', 'login', 'preview', 'templates',
]);

export function findCoupleBySlug(slug: string) {
  const row = findPublishedInvitationBySlug(slug);
  return row ? coupleSchema.parse(JSON.parse(row.content)) : null;
}

export function findPublishedInvitationBySlug(slug: string) {
  if (slug.length < 4 || slug.length > 48 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || reservedSlugs.has(slug)) {
    return null;
  }

  return getDb().select()
    .from(invitations)
    .where(and(eq(invitations.slug, slug), eq(invitations.status, 'published')))
    .get();

}
