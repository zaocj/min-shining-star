import COS from 'cos-nodejs-sdk-v5';
import { generatedSlugSchema, httpsUrlSchema, type InvitationData } from '../content/invitation-schema';

type Photo = InvitationData['gallery'][number];
type ObjectEntry = { Key: string; Size: string };
export interface GalleryStorage {
  list(prefix: string, marker?: string): Promise<{
    Contents: ObjectEntry[]; IsTruncated: 'true' | 'false'; NextMarker?: string;
  }>;
}
interface Config {
  secretId: string; secretKey: string; bucket: string; region: string; publicBaseUrl: string;
}

function createStorage(config: Config): GalleryStorage {
  const client = new COS({ SecretId: config.secretId, SecretKey: config.secretKey, Timeout: 10000 });
  const location = { Bucket: config.bucket, Region: config.region };
  return {
    list: (Prefix, Marker) => client.getBucket({ ...location, Prefix, Marker, MaxKeys: 1000 }),
  };
}

const imageExtension = /\.(?:jpe?g|png|webp|gif|avif)$/i;
const filenameOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const cacheTtl = 60_000;

export function createCosGallery(config: Config, storage?: GalleryStorage, now = Date.now) {
  for (const field of ['secretId', 'secretKey', 'bucket', 'region'] as const) {
    if (!config[field]?.trim()) throw new Error(`COS gallery configuration missing: ${field}`);
  }
  const base = new URL(httpsUrlSchema.parse(config.publicBaseUrl));
  if (base.pathname !== '/' || base.search || base.hash) throw new Error('COS_PUBLIC_BASE_URL must be an HTTPS origin');
  const backend = storage ?? createStorage(config);
  const cache = new Map<string, { photos: Photo[]; expires: number }>();
  const pending = new Map<string, Promise<Photo[]>>();

  async function load(slug: string) {
    const prefix = `usersphotos/${slug}/`;
    const objects = new Map<string, ObjectEntry>();
    const seenMarkers = new Set<string>();
    let marker: string | undefined;
    do {
      const page = await backend.list(prefix, marker);
      for (const object of page.Contents) {
        if (object.Key.startsWith(prefix) && imageExtension.test(object.Key) && Number(object.Size) > 0 &&
          !object.Key.split('/').some((part) => part === '.' || part === '..')) objects.set(object.Key, object);
      }
      if (page.IsTruncated !== 'true') break;
      if (!page.NextMarker || seenMarkers.has(page.NextMarker)) throw new Error('Invalid COS pagination marker');
      marker = page.NextMarker; seenMarkers.add(marker);
    } while (true);

    const entries = [...objects.values()].sort((a, b) => filenameOrder.compare(a.Key, b.Key) || (a.Key < b.Key ? -1 : a.Key > b.Key ? 1 : 0));
    return entries.map((object): Photo => ({
      url: `${base.origin}/${object.Key.split('/').map(encodeURIComponent).join('/')}`,
      alt: `婚纱照：${object.Key.slice(prefix.length)}`,
    }));
  }

  return async (slug: string): Promise<Photo[]> => {
    generatedSlugSchema.parse(slug);
    const cached = cache.get(slug);
    if (cached && cached.expires > now()) return cached.photos;
    const inFlight = pending.get(slug);
    if (inFlight) return inFlight;
    const request = load(slug).then((photos) => {
      cache.delete(slug);
      cache.set(slug, { photos, expires: now() + cacheTtl });
      if (cache.size > 100) cache.delete(cache.keys().next().value!);
      return photos;
    }).finally(() => { pending.delete(slug); });
    pending.set(slug, request);
    return request;
  };
}
