export interface UserDocument {
  uid: string;
  email: string;
  plan: 'free' | 'starter' | 'pro';
  creditsRemaining: number;
  totalVideosCreated: number;
  /** Credits granted only after a verified Apple IAP. 0 means free-tier lifetime cap applies. */
  paidCreditsGranted?: number;
  createdAt: any;
  updatedAt: any;
}

export type AspectRatio = '9:16' | '1:1' | '16:9';
export type StylePreset = 'saas_dark' | 'ecommerce_punchy' | 'minimal_editorial';
export type VoiceId = 'en-US-Neural2-F' | 'en-US-Neural2-D';

export type JobStatus = 
  | 'queued' 
  | 'scraping' 
  | 'scripting' 
  | 'generating_audio' 
  | 'rendering' 
  | 'completed' 
  | 'failed';

export interface ScrapedBranding {
  url: string;
  title: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  features?: string[];
  heroScreenshotPath: string;
  heroScreenshotUrl?: string;
  featureScreenshotPaths: string[];
  featureScreenshotUrls?: string[];
  iconUrl?: string;
  iconPath?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  priceLabel?: string;
}

export type SceneShotKind = 'product_shot' | 'caption_card';

export interface StoryboardScene {
  id: number;
  durationSec: number;
  caption: string;
  narrationText: string;
  assetType: 'screenshot_hero' | 'screenshot_feature' | 'brand_card';
  motionEffect: 'zoom_in' | 'pan_down' | 'tilt_3d';
  /** product_shot = ask for a real screen; caption_card = skip is fine */
  shotKind?: SceneShotKind;
  /** One line telling the user what photo to attach */
  shotPrompt?: string;
}

export interface SceneShotRef {
  sceneId: number;
  objectPath?: string;
  /** Store CDN screenshot — pipeline downloads only mzstatic / googleusercontent hosts */
  imageUrl?: string;
}

export interface Storyboard {
  hook: string;
  fullNarration: string;
  scenes: StoryboardScene[];
  /** Gemini model that produced the script, or `fallback` when offline. */
  modelUsed?: string;
}

export interface WordTimecode {
  word: string;
  startSec: number;
  endSec: number;
}

export interface AudioSynthesisResult {
  audioBuffer: Buffer;
  audioUrl?: string;
  durationSeconds: number;
  timecodes: WordTimecode[];
}

export type JobErrorCode =
  | 'INVALID_URL'
  | 'PAYWALL_DETECTED'
  | 'SCRAPE_TIMEOUT'
  | 'TTS_FAILURE'
  | 'RENDER_FAILURE'
  | 'INSUFFICIENT_CREDITS';

export interface VideoJobDocument {
  id: string;
  userId: string;
  idempotencyKey: string;
  inputUrl: string;
  productName?: string;
  userDescription?: string;
  enableWebScraping?: boolean;
  /** Locked in the plan step — pipeline must not call Gemini again */
  lockedScript?: Storyboard;
  sceneShots?: SceneShotRef[];
  aspectRatio: AspectRatio;
  stylePreset: StylePreset;
  voiceId: VoiceId;
  status: JobStatus;
  progress: number;
  branding?: ScrapedBranding;
  script?: Storyboard;
  audioUrl?: string;
  outputVideoUrl?: string;
  durationSeconds?: number;
  error?: {
    code: JobErrorCode;
    title: string;
    message: string;
    canRetry: boolean;
  };
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
}
