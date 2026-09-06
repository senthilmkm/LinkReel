import { createHash } from 'crypto';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { ENV } from '../config/env';
import { FLASH_JSON_CONFIG, parseJsonObject } from './json-parse';
import { Storyboard } from '../types';
import {
  StoreSceneShot,
  applyShotPicks,
  assignStoreShots,
  isAllowedStoreImageUrl,
  thumbnailScreenshotUrl,
} from './app-store.service';

const VISION_MODEL = 'gemini-2.5-flash';
const VISION_CACHE_TTL_MS = 30 * 60 * 1000;
const VISION_CACHE_MAX = 40;
const MAX_VISION_IMAGES = 8;
const THUMB_TIMEOUT_MS = 8_000;
const THUMB_MAX_BYTES = 400_000;

type VisionCacheEntry = { at: number; shots: StoreSceneShot[] };
const visionCache = new Map<string, VisionCacheEntry>();

const pickSchema = {
  type: SchemaType.OBJECT,
  properties: {
    picks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sceneId: { type: SchemaType.INTEGER },
          imageIndex: { type: SchemaType.INTEGER },
        },
        required: ['sceneId', 'imageIndex'],
      },
    },
  },
  required: ['picks'],
};

export function visionMatchKey(appleId: string, storyboard: Storyboard, screenshotUrls: string[]): string {
  const captions = (storyboard.scenes || []).map((s) => `${s.id}:${s.caption}`).join('|');
  return createHash('sha256').update(`${appleId}|${captions}|${screenshotUrls.join(',')}`).digest('hex');
}

function cacheGet(key: string): StoreSceneShot[] | null {
  const hit = visionCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > VISION_CACHE_TTL_MS) {
    visionCache.delete(key);
    return null;
  }
  return structuredClone(hit.shots);
}

function cacheSet(key: string, shots: StoreSceneShot[]) {
  if (visionCache.size >= VISION_CACHE_MAX) {
    const oldest = [...visionCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) visionCache.delete(oldest[0]);
  }
  visionCache.set(key, { at: Date.now(), shots: structuredClone(shots) });
}

export function _clearVisionCacheForTests() {
  visionCache.clear();
}

async function downloadThumb(url: string): Promise<{ mimeType: string; data: string } | null> {
  const thumb = thumbnailScreenshotUrl(url);
  if (!isAllowedStoreImageUrl(thumb)) return null;
  try {
    const res = await fetch(thumb, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(THUMB_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    if (res.url && !isAllowedStoreImageUrl(res.url)) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 2_000 || buffer.length > THUMB_MAX_BYTES) return null;
    const type = (res.headers.get('content-type') || '').toLowerCase();
    const mimeType = type.startsWith('image/') ? type.split(';')[0] : 'image/jpeg';
    return { mimeType, data: buffer.toString('base64') };
  } catch {
    return null;
  }
}

export async function matchStoreShots(options: {
  appleId: string;
  storyboard: Storyboard;
  screenshotUrls: string[];
}): Promise<{ assignedShots: StoreSceneShot[]; matchedBy: 'vision' | 'vision_cache' | 'order' }> {
  const urls = options.screenshotUrls.filter(isAllowedStoreImageUrl).slice(0, MAX_VISION_IMAGES);
  if (urls.length === 0) {
    return { assignedShots: [], matchedBy: 'order' };
  }

  const key = visionMatchKey(options.appleId, options.storyboard, urls);
  const cached = cacheGet(key);
  if (cached) {
    return { assignedShots: cached, matchedBy: 'vision_cache' };
  }

  if (!ENV.GEMINI_API_KEY) {
    const assignedShots = assignStoreShots(urls);
    cacheSet(key, assignedShots);
    return { assignedShots, matchedBy: 'order' };
  }

  const thumbs = await Promise.all(urls.map(downloadThumb));
  const available = thumbs
    .map((thumb, imageIndex) => (thumb ? { imageIndex, thumb } : null))
    .filter((row): row is { imageIndex: number; thumb: { mimeType: string; data: string } } => Boolean(row));

  if (available.length < 2) {
    const assignedShots = assignStoreShots(urls);
    return { assignedShots, matchedBy: 'order' };
  }

  const scenes = (options.storyboard.scenes || []).slice(0, 4);
  const sceneLines = scenes.map((s) =>
    `${s.id}. caption="${s.caption}" voice="${(s.narrationText || '').slice(0, 90)}" kind=${s.shotKind || 'product_shot'}`
  ).join('\n');

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: `Match App Store screenshots to a 4-scene promo. JSON only.
Scenes:
${sceneLines}
Images are labeled imageIndex ${available.map((a) => a.imageIndex).join(', ')}.
Pick one imageIndex per scene. Prefer a real app UI that sells that beat. Do not reuse an image. Use imageIndex -1 if none fit.
Return only JSON. No intro, no markdown.`,
    },
  ];
  for (const row of available) {
    parts.push({ text: `imageIndex ${row.imageIndex}` });
    parts.push({ inlineData: row.thumb });
  }

  try {
    const genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: VISION_MODEL,
      generationConfig: {
        ...FLASH_JSON_CONFIG,
        responseSchema: pickSchema as any,
        maxOutputTokens: 400,
        temperature: 0.1,
      } as any,
    });
    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const parsed = parseJsonObject(result.response.text()) as { picks?: Array<{ sceneId: number; imageIndex: number }> };
    const assignedShots = applyShotPicks(urls, parsed.picks || [], 4);
    if (assignedShots.length === 0) {
      return { assignedShots: assignStoreShots(urls), matchedBy: 'order' };
    }
    cacheSet(key, assignedShots);
    console.log(`[StoreMatch] Vision assigned ${assignedShots.length} shots with ${VISION_MODEL}`);
    return { assignedShots, matchedBy: 'vision' };
  } catch (err: any) {
    console.warn(`[StoreMatch] Vision match skipped: ${err.message}`);
    const assignedShots = assignStoreShots(urls);
    return { assignedShots, matchedBy: 'order' };
  }
}
