import { Config } from '../config/config';

export interface StoryboardScene {
  id: number;
  durationSec: number;
  caption: string;
  narrationText: string;
  assetType: 'screenshot_hero' | 'screenshot_feature' | 'brand_card';
  motionEffect: 'zoom_in' | 'pan_down' | 'tilt_3d';
  shotKind?: 'product_shot' | 'caption_card';
  shotPrompt?: string;
}

export interface Storyboard {
  hook: string;
  fullNarration: string;
  modelUsed?: string;
  scenes: StoryboardScene[];
}

export interface SceneShotRef {
  sceneId: number;
  objectPath?: string;
  imageUrl?: string;
}

export interface StoreListing {
  appleId: string;
  name: string;
  storeUrl: string;
  iconUrl?: string;
  screenshotUrls: string[];
  previewVideoUrls?: string[];
  story: string;
}

export interface StoreSceneShot {
  sceneId: number;
  imageUrl: string;
  imageIndex: number;
}

export interface CreateJobParams {
  userId: string;
  inputUrl?: string;
  productName?: string;
  userDescription: string;
  enableWebScraping?: boolean;
  lockedScript?: Storyboard;
  sceneShots?: SceneShotRef[];
  idempotencyKey: string;
  aspectRatio: '9:16' | '1:1' | '16:9';
  stylePreset: 'saas_dark' | 'ecommerce_punchy' | 'minimal_editorial';
  voiceId: 'en-US-Neural2-F' | 'en-US-Neural2-D';
  captionStyle?: 'bold_center' | 'bottom_bar' | 'word_highlight' | 'minimal';
  musicTrack?: 'none' | 'pulse' | 'warm' | 'drive' | 'lift' | 'night';
  musicVolume?: 'quiet' | 'medium' | 'loud';
}

export interface ReelSummary {
  id: string;
  title: string;
  outputVideoUrl: string;
  durationSeconds?: number;
  aspectRatio?: string;
  voiceId?: string;
  createdAt: number;
  expiresAt: number;
  expired: boolean;
}

export interface JobResponse {
  id: string;
  userId: string;
  inputUrl: string;
  userDescription?: string;
  enableWebScraping?: boolean;
  aspectRatio: string;
  stylePreset: string;
  voiceId: string;
  status: 'queued' | 'scraping' | 'scripting' | 'generating_audio' | 'rendering' | 'completed' | 'failed';
  progress: number;
  outputVideoUrl?: string;
  audioUrl?: string;
  durationSeconds?: number;
  branding?: {
    title: string;
    description: string;
    primaryColor?: string;
    accentColor?: string;
    heroScreenshotUrl?: string;
  };
  script?: {
    hook: string;
    fullNarration: string;
    scenes?: any[];
  };
  error?: {
    code: string;
    title: string;
    message: string;
    canRetry: boolean;
  };
}

async function readError(res: Response): Promise<string> {
  if (res.status === 413) {
    return 'That photo is too large. Use a screenshot, not a full camera roll image.';
  }
  const errJson = await res.json().catch(() => ({} as any));
  return errJson.message || errJson.error || `API error: ${res.status}`;
}

async function apiFetch(path: string, init?: RequestInit, timeoutMs = Config.api.timeoutMs): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${Config.api.baseUrl}${path}`, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('That took too long. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const ApiService = {
  async getFeatures(): Promise<{ playStore: boolean }> {
    try {
      const res = await apiFetch('/api/v1/features', undefined, 8000);
      if (!res.ok) return { playStore: false };
      const data = await res.json();
      return { playStore: Boolean(data.playStore) };
    } catch {
      return { playStore: false };
    }
  },

  async planStoryboard(params: {
    userId: string;
    userDescription: string;
    productName?: string;
    inputUrl?: string;
    stylePreset: CreateJobParams['stylePreset'];
  }): Promise<{ storyboard: Storyboard; cached: boolean }> {
    const res = await apiFetch('/api/v1/storyboard/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }, 90000);
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
  },

  async planFromStore(params: {
    userId: string;
    storeUrl: string;
    stylePreset: CreateJobParams['stylePreset'];
  }): Promise<{
    storyboard: Storyboard;
    listing: StoreListing;
    assignedShots: StoreSceneShot[];
    cached: boolean;
  }> {
    const res = await apiFetch('/api/v1/store/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }, 90000);
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
  },

  async signUpload(params: {
    userId: string;
    sceneId: number;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  }): Promise<{ uploadUrl: string; objectPath: string; headers: Record<string, string> }> {
    const res = await apiFetch('/api/v1/uploads/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
  },

  async uploadShot(params: {
    userId: string;
    sceneId: number;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
    imageBase64: string;
  }): Promise<{ objectPath: string }> {
    const res = await apiFetch('/api/v1/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }, 60000);
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
  },

  async createJob(params: CreateJobParams): Promise<{ jobId: string }> {
    const res = await apiFetch('/api/v1/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
  },

  async getJob(jobId: string, userId?: string): Promise<JobResponse> {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await apiFetch(`/api/v1/jobs/${jobId}${q}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch job ${jobId}`);
    }
    return await res.json();
  },

  async listReels(userId: string): Promise<ReelSummary[]> {
    const res = await apiFetch(`/api/v1/users/${encodeURIComponent(userId)}/reels`);
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return Array.isArray(data.reels) ? data.reels : [];
  },

  async getUser(userId: string): Promise<{ creditsRemaining: number; plan: string }> {
    const res = await apiFetch(`/api/v1/users/${userId}`);
    if (!res.ok) throw new Error('USER_FETCH_FAILED');
    return await res.json();
  },

  async confirmPurchase(params: {
    userId: string;
    productId: 'com.linkreel.credits.10' | 'com.linkreel.credits.25';
    signedTransaction: string;
  }): Promise<{ creditsRemaining: number; creditsAdded: number; duplicate?: boolean }> {
    const res = await apiFetch('/api/v1/purchases/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
  },
};
