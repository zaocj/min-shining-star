import { GALLERY_SOURCE, COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION, COS_PUBLIC_BASE_URL } from 'astro:env/server';
import { createCosGallery } from '../repositories/cos-gallery';
import type { InvitationData } from '../content/invitation-schema';

let gallery: ReturnType<typeof createCosGallery> | undefined;

export async function resolveGallery(data: InvitationData): Promise<InvitationData> {
  if (GALLERY_SOURCE !== 'cos') return data;
  if (!data.albumSlug) return { ...data, gallery: [] };
  gallery ??= createCosGallery({
    secretId: COS_SECRET_ID ?? '', secretKey: COS_SECRET_KEY ?? '',
    bucket: COS_BUCKET ?? '', region: COS_REGION ?? '', publicBaseUrl: COS_PUBLIC_BASE_URL,
  });
  return { ...data, gallery: await gallery(data.albumSlug) };
}
