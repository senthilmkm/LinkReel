import fs from 'fs';
import { fetchListingPreviewUrls } from './preview-video.service';

const LISTING_CACHE_TTL_MS = 30 * 60 * 1000;
const LISTING_CACHE_MAX = 40;
const LOOKUP_TIMEOUT_MS = 10_000;
const IMAGE_TIMEOUT_MS = 15_000;
const IMAGE_MAX_BYTES = 8_000_000;
const IMAGE_MIN_BYTES = 8_000;

export interface StoreListing {
  appleId: string;
  name: string;
  description: string;
  story: string;
  storeUrl: string;
  iconUrl?: string;
  screenshotUrls: string[];
  previewVideoUrls?: string[];
  averageUserRating?: number;
  userRatingCount?: number;
  priceLabel?: string;
}

export function formatRatingCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(count));
}

/** Real App Store proof only. No stars if Apple has no rating yet. */
export function formatStoreProof(listing: {
  averageUserRating?: number;
  userRatingCount?: number;
  priceLabel?: string;
}): { ratingLine: string | null; priceLine: string | null; starCount: number } {
  const rating = Number(listing.averageUserRating);
  const count = Number(listing.userRatingCount);
  const hasRating = Number.isFinite(rating) && rating > 0 && Number.isFinite(count) && count > 0;
  const price = (listing.priceLabel || '').trim();
  return {
    ratingLine: hasRating ? `${rating.toFixed(1)} · ${formatRatingCount(count)} ratings` : null,
    priceLine: price || null,
    starCount: hasRating ? Math.max(1, Math.min(5, Math.round(rating))) : 0,
  };
}

export interface StoreSceneShot {
  sceneId: number;
  imageUrl: string;
  imageIndex: number;
}

export interface PackedSceneClip {
  sceneId: number;
  imageUrl?: string;
  objectPath?: string;
}

const IPHONE_SHOT_MAX = 10;

type ListingCacheEntry = { at: number; listing: StoreListing };
const listingCache = new Map<string, ListingCacheEntry>();

export function parseAppleId(raw: string): string | null {
  const t = (raw || '').trim();
  if (!t) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'apps.apple.com' && host !== 'itunes.apple.com') return null;

  const fromPath = url.pathname.match(/\/id(\d{8,12})(?:\/|$)/i);
  if (fromPath?.[1]) return fromPath[1];

  const fromQuery = url.searchParams.get('id');
  if (fromQuery && /^\d{8,12}$/.test(fromQuery)) return fromQuery;

  return null;
}

export function isAllowedStoreImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'mzstatic.com'
      || host.endsWith('.mzstatic.com')
      || host === 'googleusercontent.com'
      || host.endsWith('.googleusercontent.com');
  } catch {
    return false;
  }
}

/** Prefer a usable phone-frame size without pulling the largest asset. */
export function upgradeScreenshotUrl(raw: string): string {
  if (!isAllowedStoreImageUrl(raw)) return raw;
  return raw.replace(/\/\d{2,4}x\d{2,4}(bb|cc)\.(jpg|jpeg|png|webp)(\?.*)?$/i, '/1242x2688$1.$2$3');
}

/** Tiny thumb for the one vision pass — do not send 1242px assets. */
export function thumbnailScreenshotUrl(raw: string): string {
  if (!isAllowedStoreImageUrl(raw)) return raw;
  if (/googleusercontent\.com/i.test(raw)) {
    return raw.replace(/=w\d+-h\d+.*$/i, '=w320-h480');
  }
  return raw.replace(/\/\d{2,4}x\d{2,4}(bb|cc)\.(jpg|jpeg|png|webp)(\?.*)?$/i, '/320x480$1.$2$3');
}

export function applyShotPicks(
  screenshotUrls: string[],
  picks: Array<{ sceneId: number; imageIndex: number }>,
  sceneCount = 4
): StoreSceneShot[] {
  const used = new Set<number>();
  const byScene = new Map<number, StoreSceneShot>();

  for (const pick of picks) {
    const { sceneId, imageIndex } = pick;
    if (sceneId < 1 || sceneId > sceneCount) continue;
    if (byScene.has(sceneId)) continue;
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= screenshotUrls.length) continue;
    if (used.has(imageIndex)) continue;
    const imageUrl = screenshotUrls[imageIndex];
    if (!isAllowedStoreImageUrl(imageUrl)) continue;
    used.add(imageIndex);
    byScene.set(sceneId, { sceneId, imageUrl, imageIndex });
  }

  let next = 0;
  for (let sceneId = 1; sceneId <= sceneCount; sceneId++) {
    if (byScene.has(sceneId)) continue;
    while (next < screenshotUrls.length && (used.has(next) || !isAllowedStoreImageUrl(screenshotUrls[next]))) {
      next += 1;
    }
    if (next >= screenshotUrls.length) break;
    used.add(next);
    byScene.set(sceneId, { sceneId, imageUrl: screenshotUrls[next], imageIndex: next });
    next += 1;
  }

  return [...byScene.values()].sort((a, b) => a.sceneId - b.sceneId);
}

export function listingStory(description: string, name: string): string {
  const cut = (description || '')
    .split(/\n?\s*(?:-{6,}|ORBIT PRO SUBSCRIPTION|SUBSCRIPTION INFORMATION|Privacy Policy:|Terms of Service:)/i)[0]
    .replace(/\s+/g, ' ')
    .trim();
  const story = cut.slice(0, 1200);
  if (story.length >= 24) return story;
  const fallback = `${name} is a hands-free app. Pocket your phone and let it handle the work.`.trim();
  return fallback.slice(0, 1200);
}

export function assignStoreShots(screenshotUrls: string[], sceneCount = 4): StoreSceneShot[] {
  const sequential = screenshotUrls
    .map((_, imageIndex) => ({ sceneId: imageIndex + 1, imageIndex }))
    .filter((p) => p.sceneId <= sceneCount);
  return applyShotPicks(screenshotUrls, sequential, sceneCount);
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Keep the 4 scene picks, then fold leftover iPhone shots into those scenes
 * so the reel uses as many listing screens as we have (max 10).
 * A skipped scene stays a caption card — extras go to scenes that already have a shot.
 */
export function packListingClips(
  screenshotUrls: string[],
  scenePicks: Array<{ sceneId: number; imageUrl?: string; objectPath?: string }>,
  sceneCount = 4
): PackedSceneClip[] {
  const byScene: PackedSceneClip[][] = Array.from({ length: sceneCount }, () => []);
  const used = new Set<string>();

  for (const pick of scenePicks) {
    if (pick.sceneId < 1 || pick.sceneId > sceneCount) continue;
    const key = pick.imageUrl || pick.objectPath;
    if (!key || used.has(key)) continue;
    if (pick.imageUrl && !isAllowedStoreImageUrl(pick.imageUrl)) continue;
    used.add(key);
    byScene[pick.sceneId - 1].push({
      sceneId: pick.sceneId,
      ...(pick.imageUrl ? { imageUrl: pick.imageUrl } : {}),
      ...(pick.objectPath ? { objectPath: pick.objectPath } : {}),
    });
  }

  const extras = uniqueUrls(screenshotUrls).filter(
    (url) => isAllowedStoreImageUrl(url) && !used.has(url)
  );
  const productScenes = byScene
    .map((clips, i) => ({ clips, sceneId: i + 1 }))
    .filter((row) => row.clips.length > 0);
  const targets = productScenes.length > 0
    ? productScenes
    : byScene.map((clips, i) => ({ clips, sceneId: i + 1 }));

  for (const url of extras) {
    used.add(url);
    let min = 0;
    for (let i = 1; i < targets.length; i++) {
      if (targets[i].clips.length < targets[min].clips.length) min = i;
    }
    targets[min].clips.push({ sceneId: targets[min].sceneId, imageUrl: url });
  }

  const packed: PackedSceneClip[] = [];
  for (let i = 0; i < sceneCount; i++) {
    if (byScene[i].length === 0) {
      packed.push({ sceneId: i + 1 });
    } else {
      packed.push(...byScene[i]);
    }
  }
  return packed.slice(0, IPHONE_SHOT_MAX);
}

function cacheGetListing(appleId: string): StoreListing | null {
  const hit = listingCache.get(appleId);
  if (!hit) return null;
  if (Date.now() - hit.at > LISTING_CACHE_TTL_MS) {
    listingCache.delete(appleId);
    return null;
  }
  return structuredClone(hit.listing);
}

function cacheSetListing(listing: StoreListing) {
  if (listingCache.size >= LISTING_CACHE_MAX) {
    const oldest = [...listingCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) listingCache.delete(oldest[0]);
  }
  listingCache.set(listing.appleId, { at: Date.now(), listing: structuredClone(listing) });
}

export function _clearListingCacheForTests() {
  listingCache.clear();
}

export async function lookupAppStoreListing(storeUrl: string): Promise<StoreListing> {
  const appleId = parseAppleId(storeUrl);
  if (!appleId) {
    throw new Error('NOT_APP_STORE: Paste a public App Store link, like apps.apple.com/app/id…');
  }

  const cached = cacheGetListing(appleId);
  if (cached) return cached;

  const endpoint = `https://itunes.apple.com/lookup?id=${encodeURIComponent(appleId)}&entity=software`;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error('STORE_LOOKUP_FAILED: Apple listing is unavailable. Try again in a minute.');
  }

  const body = await res.json() as {
    resultCount?: number;
    results?: Array<{
      trackId?: number;
      trackName?: string;
      description?: string;
      trackViewUrl?: string;
      artworkUrl512?: string;
      artworkUrl100?: string;
      screenshotUrls?: string[];
      ipadScreenshotUrls?: string[];
      averageUserRating?: number;
      userRatingCount?: number;
      formattedPrice?: string;
      kind?: string;
      wrapperType?: string;
    }>;
  };

  const app = (body.results || []).find((r) =>
    String(r.trackId) === appleId && (r.kind === 'software' || r.wrapperType === 'software' || Boolean(r.trackName))
  ) || (body.results || [])[0];

  if (!app?.trackName) {
    throw new Error('STORE_NOT_FOUND: That App Store listing was not found.');
  }

  const rawShots = (app.screenshotUrls?.length ? app.screenshotUrls : app.ipadScreenshotUrls) || [];
  const screenshotUrls = uniqueUrls(
    rawShots.map(upgradeScreenshotUrl).filter(isAllowedStoreImageUrl)
  ).slice(0, IPHONE_SHOT_MAX);

  const listing: StoreListing = {
    appleId,
    name: String(app.trackName).slice(0, 80),
    description: String(app.description || '').slice(0, 4000),
    story: listingStory(String(app.description || ''), String(app.trackName)),
    storeUrl: app.trackViewUrl || `https://apps.apple.com/app/id${appleId}`,
    iconUrl: app.artworkUrl512 || app.artworkUrl100,
    screenshotUrls,
    averageUserRating: Number(app.averageUserRating) || undefined,
    userRatingCount: Number(app.userRatingCount) || undefined,
    priceLabel: String(app.formattedPrice || '').trim() || undefined,
    previewVideoUrls: await fetchListingPreviewUrls(
      app.trackViewUrl || storeUrl,
      appleId
    ),
  };

  cacheSetListing(listing);
  return listing;
}

export async function downloadAllowedImage(imageUrl: string, destPath: string): Promise<void> {
  if (!isAllowedStoreImageUrl(imageUrl)) {
    throw new Error('INVALID_STORE_IMAGE: Only App Store or Play Store screenshot URLs are allowed.');
  }

  const res = await fetch(imageUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`STORE_IMAGE_FAILED: HTTP ${res.status}`);
  }
  if (res.url && !isAllowedStoreImageUrl(res.url)) {
    throw new Error('INVALID_STORE_IMAGE: Redirect left the store CDN.');
  }

  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type && !type.startsWith('image/')) {
    throw new Error('INVALID_STORE_IMAGE: Response was not an image.');
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < IMAGE_MIN_BYTES || buffer.length > IMAGE_MAX_BYTES) {
    throw new Error(`STORE_IMAGE_SIZE: Rejected size=${buffer.length}`);
  }

  fs.writeFileSync(destPath, buffer);
}

