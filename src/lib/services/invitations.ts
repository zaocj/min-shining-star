import { generatedSlugSchema } from '../content/invitation-schema';
import { coupleSchema } from '../content/schema';
import { buildInvitationData } from '../content/view-model';
import { findPublishedInvitationBySlug } from '../repositories/invitations';

export function getPageInvitation(slug: string) {
  const row = findPublishedInvitationBySlug(slug);
  if (!row) return null;
  if (row.templateKey === 'classic-red') {
    return { kind: 'legacy' as const, couple: coupleSchema.parse(JSON.parse(row.content)) };
  }
  return { kind: 'invitation' as const, data: buildInvitationData(row) };
}

export function getInvitationBySlug(slug: string) {
  if (!generatedSlugSchema.safeParse(slug).success) return null;
  const result = getPageInvitation(slug);
  return result?.kind === 'invitation' ? result.data : null;
}
