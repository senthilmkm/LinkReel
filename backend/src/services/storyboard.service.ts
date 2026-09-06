import { createHash } from 'crypto';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { ENV } from '../config/env';
import { FLASH_JSON_CONFIG, parseJsonObject } from './json-parse';
import { ScrapedBranding, Storyboard, StoryboardScene, StylePreset } from '../types';

/**
 * Flash-only. Pro models are 5–10× the cost for a 30s caption script.
 * If Flash is down we use the local template — never spend Pro credits.
 * 2.5 first: 3.7 often burns tokens on thinking and returns truncated JSON.
 */
const PLAN_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

const PLAN_CACHE_TTL_MS = 30 * 60 * 1000;
const PLAN_CACHE_MAX = 40;

type CacheEntry = { at: number; board: Storyboard };

const planCache = new Map<string, CacheEntry>();

function cacheGet(key: string): Storyboard | null {
  const hit = planCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > PLAN_CACHE_TTL_MS) {
    planCache.delete(key);
    return null;
  }
  return structuredClone(hit.board);
}

function cacheSet(key: string, board: Storyboard) {
  if (planCache.size >= PLAN_CACHE_MAX) {
    const oldest = [...planCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) planCache.delete(oldest[0]);
  }
  planCache.set(key, { at: Date.now(), board: structuredClone(board) });
}

function clipNarration(text: string, max = 160): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
  const clipped = (at > 40 ? cut.slice(0, at) : cut).replace(/[.,;:]+$/, '');
  return `${clipped}.`;
}

export function planCacheKey(input: {
  story: string;
  productName: string;
  url: string;
  stylePreset: string;
}): string {
  return createHash('sha256')
    .update(`${input.story.trim()}|${input.productName}|${input.url}|${input.stylePreset}`)
    .digest('hex');
}

const DEFAULT_SHOTS: Array<Pick<StoryboardScene, 'shotKind' | 'shotPrompt'>> = [
  {
    shotKind: 'caption_card',
    shotPrompt: 'Optional: the old / painful screen. Skip if you do not have one — we will use a bold caption.',
  },
  {
    shotKind: 'caption_card',
    shotPrompt: 'Optional: the messy workflow you are replacing. Skip is fine.',
  },
  {
    shotKind: 'product_shot',
    shotPrompt: 'Upload the screen this story is about — Home, dashboard, or the feature they set.',
  },
  {
    shotKind: 'caption_card',
    shotPrompt: 'Optional: a result or success screen. Skip and we will use the trial CTA.',
  },
];

const SCENE_FALLBACKS = (
  title: string
): Array<Pick<StoryboardScene, 'caption' | 'narrationText' | 'assetType' | 'motionEffect'>> => {
  const t = title.toUpperCase();
  return [
    { caption: `MEET ${t}`, narrationText: `Still doing this the hard way? Meet ${title}.`, assetType: 'screenshot_hero', motionEffect: 'tilt_3d' },
    { caption: 'THE OLD WAY IS BROKEN', narrationText: 'You waste time on the old workflow and miss the moment that matters.', assetType: 'screenshot_feature', motionEffect: 'zoom_in' },
    { caption: 'SET IT. WALK AWAY.', narrationText: `${title} handles the work so you can step away.`, assetType: 'screenshot_hero', motionEffect: 'pan_down' },
    { caption: `TRY ${t} TODAY`, narrationText: `Try ${title} today.`, assetType: 'brand_card', motionEffect: 'zoom_in' },
  ];
};

export function normalizeStoryboard(board: Storyboard, branding: ScrapedBranding): Storyboard {
  const cleanTitle = (branding.title.split(/[-|]/)[0] || 'this product').trim();
  const pads = SCENE_FALLBACKS(cleanTitle);
  const incoming = Array.isArray(board.scenes) ? board.scenes : [];
  const scenes: StoryboardScene[] = [0, 1, 2, 3].map((i) => {
    const src = incoming[i] || ({} as StoryboardScene);
    const pad = pads[i];
    const defaults = DEFAULT_SHOTS[i];
    const shotKind = src.shotKind === 'product_shot' || src.shotKind === 'caption_card'
      ? src.shotKind
      : defaults.shotKind;
    return {
      id: i + 1,
      durationSec: clampDuration(src.durationSec, i),
      caption: String(src.caption || pad.caption).slice(0, 48),
      narrationText: String(src.narrationText || pad.narrationText).slice(0, 400),
      assetType: src.assetType === 'screenshot_feature' || src.assetType === 'brand_card'
        ? src.assetType
        : pad.assetType,
      motionEffect: src.motionEffect === 'pan_down' || src.motionEffect === 'tilt_3d'
        ? src.motionEffect
        : pad.motionEffect,
      shotKind,
      shotPrompt: String(src.shotPrompt || defaults.shotPrompt).slice(0, 160),
    };
  });

  const total = scenes.reduce((sum, s) => sum + s.durationSec, 0);
  if (total < 24 || total > 32) {
    scenes[0].durationSec = 4;
    scenes[1].durationSec = 8;
    scenes[2].durationSec = 12;
    scenes[3].durationSec = 6;
  }

  return {
    hook: String(board.hook || `Still doing this the hard way? Meet ${cleanTitle}.`).slice(0, 140),
    fullNarration: String(board.fullNarration || `${cleanTitle} turns the old loop into a 30-second fix.`).slice(0, 900),
    modelUsed: board.modelUsed || 'fallback',
    scenes,
  };
}

function clampDuration(value: number, index: number): number {
  const fallbacks = [4, 8, 12, 6];
  const n = Number(value);
  if (!Number.isFinite(n) || n < 3 || n > 16) return fallbacks[index];
  return Math.round(n);
}

const sceneSchema = {
  type: SchemaType.OBJECT,
  properties: {
    hook: { type: SchemaType.STRING },
    fullNarration: { type: SchemaType.STRING },
    scenes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.NUMBER },
          durationSec: { type: SchemaType.NUMBER },
          caption: { type: SchemaType.STRING },
          narrationText: { type: SchemaType.STRING },
          assetType: { type: SchemaType.STRING },
          motionEffect: { type: SchemaType.STRING },
          shotKind: { type: SchemaType.STRING },
          shotPrompt: { type: SchemaType.STRING },
        },
        required: ['id', 'durationSec', 'caption', 'narrationText', 'assetType', 'motionEffect'],
      },
    },
  },
  required: ['hook', 'fullNarration', 'scenes'],
};

export class StoryboardService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    if (ENV.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY);
    }
  }

  async generateStoryboard(
    branding: ScrapedBranding,
    stylePreset: StylePreset,
    userDescription?: string,
    enableWebScraping: boolean = true
  ): Promise<Storyboard> {
    return this.planScenes({ branding, stylePreset, userDescription, enableWebScraping });
  }

  async planScenes(params: {
    branding: ScrapedBranding;
    stylePreset: StylePreset;
    userDescription?: string;
    enableWebScraping?: boolean;
  }): Promise<Storyboard> {
    const { branding, stylePreset, userDescription, enableWebScraping = true } = params;
    const key = planCacheKey({
      story: userDescription || '',
      productName: branding.title,
      url: branding.url,
      stylePreset,
    });
    const cached = cacheGet(key);
    if (cached) {
      cached.modelUsed = `${cached.modelUsed || 'cache'}+cache`;
      return normalizeStoryboard(cached, branding);
    }

    if (!this.genAI || !ENV.GEMINI_API_KEY) {
      const fallback = this.generateFallbackStoryboard(branding, stylePreset, userDescription);
      cacheSet(key, fallback);
      return fallback;
    }

    const story = (userDescription || '').trim();
    const prompt = `Write a 30-second promo script. JSON only. No camera directions.
Product: ${(branding.title || 'Product').slice(0, 80)}
URL: ${branding.url}
Style: ${stylePreset}
Story:
"""
${story.slice(0, 1200)}
"""
${!enableWebScraping ? 'Do not invent website UI. Script from the story + product name only.' : ''}

Exactly 4 scenes, 28-30s total (4 / 8 / 12 / 6).
1 hook (before), 2 problem, 3 product as the fix, 4 CTA.
Captions: 3-6 words. Voice: second person.
shotKind is "product_shot" ONLY if a real app/web screenshot sells that beat; else "caption_card".
shotPrompt: one sentence telling the user what photo to attach. If caption_card, say they can skip.`;

    let lastError: Error | null = null;
    for (const modelName of PLAN_MODELS) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            ...FLASH_JSON_CONFIG,
            responseSchema: sceneSchema as any,
            maxOutputTokens: 1200,
          } as any,
        });
        const result = await model.generateContent(prompt);
        const parsed = parseJsonObject(result.response.text()) as Storyboard;
        parsed.modelUsed = modelName;
        const normalized = normalizeStoryboard(parsed, branding);
        cacheSet(key, normalized);
        console.log(`[AI Service] Scene plan with ${modelName}`);
        return normalized;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Service] ${modelName} failed: ${err.message}`);
      }
    }

    console.warn('[AI Service] Flash unavailable — local template (no Pro spend):', lastError?.message);
    return this.generateFallbackStoryboard(branding, stylePreset, userDescription);
  }

  generateFallbackStoryboard(branding: ScrapedBranding, stylePreset: StylePreset, userDescription?: string): Storyboard {
    void stylePreset;
    const cleanTitle = branding.title.split(/[-|]/)[0].trim() || 'this product';
    const cleanUrl = branding.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const features = (branding.features || []).filter((f) => f.trim().length >= 8);
    const story = this.parseUserStory(userDescription);

    const hookText = story.hook || `Still doing this the hard way? Meet ${cleanTitle}.`;
    const problemNarration = story.problem || 'You waste time on the old workflow and miss the moment that matters.';
    const solutionNarration = story.solution
      || (features.length > 0 ? features.slice(0, 3).join('. ') : `${cleanTitle} handles the work so you can step away.`);
    const fullNarration = (story.fullNarration
      || `${hookText} ${problemNarration} ${solutionNarration} Try ${cleanTitle} today at ${cleanUrl}.`)
      .replace(/\s+/g, ' ')
      .trim();

    return normalizeStoryboard({
      hook: hookText,
      fullNarration,
      modelUsed: 'fallback',
      scenes: [
        {
          id: 1,
          durationSec: 4,
          caption: story.hookCaption || `MEET ${cleanTitle.toUpperCase()}`,
          narrationText: hookText,
          assetType: 'screenshot_hero',
          motionEffect: 'tilt_3d',
        },
        {
          id: 2,
          durationSec: 8,
          caption: story.problemCaption || 'THE OLD WAY IS BROKEN',
          narrationText: problemNarration,
          assetType: 'screenshot_feature',
          motionEffect: 'zoom_in',
        },
        {
          id: 3,
          durationSec: 12,
          caption: story.solutionCaption || 'SET IT. WALK AWAY.',
          narrationText: solutionNarration,
          assetType: 'screenshot_hero',
          motionEffect: 'pan_down',
        },
        {
          id: 4,
          durationSec: 6,
          caption: `TRY ${cleanTitle.toUpperCase()} TODAY`,
          narrationText: `Try ${cleanTitle} today at ${cleanUrl}.`,
          assetType: 'brand_card',
          motionEffect: 'zoom_in',
        },
      ],
    }, branding);
  }

  private parseUserStory(userDescription?: string): {
    hook?: string;
    problem?: string;
    solution?: string;
    fullNarration?: string;
    hookCaption?: string;
    problemCaption?: string;
    solutionCaption?: string;
  } {
    if (!userDescription || !userDescription.trim()) return {};

    const bulletLines = userDescription
      .split('\n')
      .map((line) => line.replace(/^[\s•\-\*]+/, '').trim())
      .filter((line) => line.length >= 8 && !line.startsWith('http') && !line.includes('Privacy') && !line.includes('Terms'));

    const looksLikeBullets = userDescription.split('\n').filter((line) => /^\s*[-•*]/.test(line)).length >= 2;
    if (looksLikeBullets) {
      return {
        hook: `Still doing this the hard way?`,
        problem: bulletLines[0],
        solution: bulletLines.slice(1).join('. '),
        hookCaption: 'STOP DOING IT THE HARD WAY',
        problemCaption: 'THIS IS THE OLD LOOP',
        solutionCaption: 'HERE IS THE FIX',
      };
    }

    const sentences = userDescription
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8);

    const problem = clipNarration(sentences[0] || userDescription.trim(), 140);
    const solution = clipNarration(sentences.slice(1, 3).join(' '), 180);
    const watchingPrice = /watch|sit|glued|stare|constant|candle|15-minute|15 minute/i.test(userDescription);
    const walkAway = /cushion|risk|automatic|walk away|set aside|stay cool|hands.?free|phone (face )?down/i.test(userDescription);

    if (watchingPrice) {
      return {
        hook: 'Still babysitting a 15-minute candle?',
        problem: 'Phone an inch from your face. You don’t cook. You don’t text. You watch the lean, slam the order, miss it anyway. Sit, stare, tap, miss.',
        solution: walkAway
          ? 'Predict flips it. Set your cushion, risk gates, Protect-Sell. Put the phone down. If the book hits your rules, Predict takes the fill.'
          : solution,
        fullNarration: 'Still babysitting a 15-minute candle? Phone an inch from your face. You don’t cook. You don’t text. You watch the lean, slam the order, miss it anyway. That’s the old job. Sit, stare, tap, miss. Predict flips it. Set your cushion, risk gates, Protect-Sell. Put the phone down. If the book hits, Predict takes the fill. You don’t have to live inside a 15-minute clock.',
        hookCaption: 'BABYSIT A 15-MINUTE CANDLE?',
        problemCaption: 'SIT. STARE. TAP. MISS.',
        solutionCaption: 'PHONE FACE DOWN.',
      };
    }

    return {
      hook: `Still stuck in that loop?`,
      problem,
      solution: solution || (walkAway ? 'Set your rules once and step away.' : undefined),
      hookCaption: 'STILL STUCK IN THE LOOP?',
      problemCaption: 'THE OLD WAY EATS TIME',
      solutionCaption: walkAway ? 'SET IT. STAY COOL.' : 'HERE IS THE FIX',
    };
  }
}

export const storyboardService = new StoryboardService();
