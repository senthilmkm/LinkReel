import express, { Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { ENV, isPlayStoreEnabled, validateEnv } from '../config/env';
import { getPricingSync, refreshPricing } from '../config/pricing';
import {
  getOrCreateUser,
  createJobWithAtomicDeduction,
  redeemStorePurchase,
  listUserReels,
  firestore,
  JOBS_COLLECTION,
} from '../services/firestore.service';
import { pipelineCoordinator } from '../services/pipeline.service';
import { storyboardService } from '../services/storyboard.service';
import { isAllowedStoreImageUrl } from '../services/app-store.service';
import { lookupStoreListing } from '../services/play-store.service';
import { matchStoreShots } from '../services/store-match.service';
import { createSignedUploadUrl, uploadBufferToGcs } from '../services/storage.service';
import { VideoJobDocument } from '../types';
import { AppleIapError, verifyAppleSignedTransaction } from '../services/apple-iap';

validateEnv();
void refreshPricing();

const app = express();
app.use(cors());
app.use((req, res, next) => {
  if (req.path === '/api/v1/uploads') return next();
  return express.json({ limit: '120kb' })(req, res, next);
});

const planHits = new Map<string, number[]>();
const jobHits = new Map<string, number[]>();

function allowInWindow(store: Map<string, number[]>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (store.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
}

function allowPlanCall(userId: string): boolean {
  return allowInWindow(planHits, userId, 8, 10 * 60 * 1000);
}

function clientIp(req: Request): string {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || req.ip || 'unknown';
}

function allowJobCall(userId: string, ip: string): boolean {
  return allowInWindow(jobHits, `u:${userId}`, 6, 60 * 60 * 1000)
    && allowInWindow(jobHits, `ip:${ip}`, 8, 60 * 60 * 1000);
}

function resolveInputUrl(raw?: string): string {
  const t = (raw || '').trim();
  if (!t) return 'https://linkreel.app';
  if (!/^https?:\/\//i.test(t)) return `https://${t}`;
  return t;
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'linkreel-backend-api',
    project: ENV.GCP_PROJECT_ID,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/features', (_req: Request, res: Response) => {
  const pricing = getPricingSync();
  res.json({
    playStore: isPlayStoreEnabled(),
    purchases: pricing.flags.purchasesEnabled,
    creditPacks: pricing.flags.creditPacksEnabled,
    subscriptions: pricing.flags.subscriptionsEnabled,
  });
});

app.get('/api/v1/pricing', async (_req: Request, res: Response): Promise<void> => {
  const pricing = await refreshPricing();
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(pricing);
});

const SceneSchema = z.object({
  id: z.number(),
  durationSec: z.number(),
  caption: z.string().min(1).max(80),
  narrationText: z.string().min(1).max(500),
  assetType: z.enum(['screenshot_hero', 'screenshot_feature', 'brand_card']),
  motionEffect: z.enum(['zoom_in', 'pan_down', 'tilt_3d']),
  shotKind: z.enum(['product_shot', 'caption_card']).optional(),
  shotPrompt: z.string().max(200).optional(),
});

const StoryboardSchema = z.object({
  hook: z.string().min(1).max(200),
  fullNarration: z.string().min(1).max(1200),
  modelUsed: z.string().max(80).optional(),
  scenes: z.array(SceneSchema).min(4).max(4),
});

const PlanSchema = z.object({
  userId: z.string().min(1),
  userDescription: z.string().min(24).max(4000),
  productName: z.string().max(80).optional(),
  inputUrl: z.string().max(500).optional(),
  stylePreset: z.enum(['saas_dark', 'ecommerce_punchy', 'minimal_editorial']).default('saas_dark'),
});

const StorePlanSchema = z.object({
  userId: z.string().min(1),
  storeUrl: z.string().min(12).max(500),
  stylePreset: z.enum(['saas_dark', 'ecommerce_punchy', 'minimal_editorial']).default('saas_dark'),
});

const SceneShotInputSchema = z.object({
  sceneId: z.number().int().min(1).max(4),
  objectPath: z.string().min(8).max(200).optional(),
  imageUrl: z.string().url().max(500).optional(),
}).refine((s) => Boolean(s.objectPath || s.imageUrl), {
  message: 'Each shot needs an upload path or an App Store screenshot URL.',
});

const SignUploadSchema = z.object({
  userId: z.string().min(1),
  sceneId: z.number().int().min(1).max(4),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

const CreateJobSchema = z.object({
  userId: z.string().min(3).max(80),
  inputUrl: z.string().max(500).optional(),
  productName: z.string().max(80).optional(),
  userDescription: z.string().min(24).max(4000),
  enableWebScraping: z.boolean().default(false),
  lockedScript: StoryboardSchema.optional(),
  sceneShots: z.array(SceneShotInputSchema).max(4).optional(),
  idempotencyKey: z.string().min(8).max(80),
  aspectRatio: z.enum(['9:16', '1:1', '16:9']).default('9:16'),
  stylePreset: z.enum(['saas_dark', 'ecommerce_punchy', 'minimal_editorial']).default('saas_dark'),
  voiceId: z.enum(['en-US-Neural2-F', 'en-US-Neural2-D']).default('en-US-Neural2-F'),
  captionStyle: z.enum(['bold_center', 'bottom_bar', 'word_highlight', 'minimal']).default('bold_center'),
  musicTrack: z.enum(['none', 'pulse', 'warm', 'drive', 'lift', 'night']).default('pulse'),
  musicVolume: z.enum(['quiet', 'medium', 'loud']).default('medium'),
});

app.post('/api/v1/storyboard/plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = PlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.errors });
      return;
    }

    const { userId, userDescription, productName, inputUrl, stylePreset } = parsed.data;
    if (!allowPlanCall(userId)) {
      res.status(429).json({
        error: 'PLAN_RATE_LIMIT',
        message: 'Too many scene plans. Wait a few minutes — this protects your AI credits.',
      });
      return;
    }

    await getOrCreateUser(userId, `${userId}@linkreel.user`);
    const url = resolveInputUrl(inputUrl);
    const title = (productName || '').trim() || url.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'Your product';

    const storyboard = await storyboardService.planScenes({
      branding: {
        url,
        title,
        description: userDescription.slice(0, 280),
        primaryColor: '#3DB8A0',
        accentColor: '#C6A75E',
        heroScreenshotPath: '',
        featureScreenshotPaths: [],
      },
      stylePreset,
      userDescription,
      enableWebScraping: false,
    });

    res.json({
      storyboard,
      cached: Boolean(storyboard.modelUsed?.includes('cache')),
      creditCharged: false,
    });
  } catch (error: any) {
    console.error('[API Error /storyboard/plan]', error);
    res.status(500).json({ error: 'PLAN_FAILED', message: error.message || 'Could not write scenes.' });
  }
});

app.post('/api/v1/store/plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = StorePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.errors });
      return;
    }

    const { userId, storeUrl, stylePreset } = parsed.data;
    if (!allowPlanCall(userId)) {
      res.status(429).json({
        error: 'PLAN_RATE_LIMIT',
        message: 'Too many scene plans. Wait a few minutes — this protects your AI credits.',
      });
      return;
    }

    await getOrCreateUser(userId, `${userId}@linkreel.user`);
    const listing = await lookupStoreListing(storeUrl);
    if (listing.screenshotUrls.length === 0) {
      res.status(422).json({
        error: 'NO_STORE_SCREENSHOTS',
        message: 'That listing has no screenshots. Use “Write the story yourself” and upload shots.',
      });
      return;
    }

    const storyboard = await storyboardService.planScenes({
      branding: {
        url: listing.storeUrl,
        title: listing.name,
        description: listing.story.slice(0, 280),
        primaryColor: '#3DB8A0',
        accentColor: '#C6A75E',
        heroScreenshotPath: '',
        featureScreenshotPaths: [],
      },
      stylePreset,
      userDescription: listing.story,
      enableWebScraping: false,
    });

    const match = await matchStoreShots({
      appleId: listing.appleId,
      storyboard,
      screenshotUrls: listing.screenshotUrls,
    });

    res.json({
      storyboard,
      listing: {
        appleId: listing.appleId,
        name: listing.name,
        storeUrl: listing.storeUrl,
        iconUrl: listing.iconUrl,
        screenshotUrls: listing.screenshotUrls,
        previewVideoUrls: listing.previewVideoUrls || [],
        story: listing.story,
      },
      assignedShots: match.assignedShots,
      matchedBy: match.matchedBy,
      cached: Boolean(storyboard.modelUsed?.includes('cache') || match.matchedBy === 'vision_cache'),
      creditCharged: false,
    });
  } catch (error: any) {
    const message = String(error.message || '');
    console.error('[API Error /store/plan]', error);
    if (message.startsWith('PLAY_STORE_DISABLED')) {
      res.status(403).json({
        error: 'PLAY_STORE_DISABLED',
        message: message.replace(/^PLAY_STORE_DISABLED:\s*/, ''),
      });
      return;
    }
    if (message.startsWith('NOT_APP_STORE') || message.startsWith('NOT_PLAY_STORE')) {
      res.status(400).json({ error: 'NOT_APP_STORE', message: message.replace(/^(NOT_APP_STORE|NOT_PLAY_STORE):\s*/, '') });
      return;
    }
    if (message.startsWith('STORE_NOT_FOUND')) {
      res.status(404).json({ error: 'STORE_NOT_FOUND', message: message.replace(/^STORE_NOT_FOUND:\s*/, '') });
      return;
    }
    res.status(502).json({
      error: 'STORE_PLAN_FAILED',
      message: 'Could not read that store listing. Check the link and try again.',
    });
  }
});

app.post('/api/v1/uploads/sign', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = SignUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.errors });
      return;
    }

    const { userId, sceneId, contentType } = parsed.data;
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const safeUser = userId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || 'user';
    const objectPath = `uploads/${safeUser}/${sceneId}-${randomUUID()}.${ext}`;
    const signed = await createSignedUploadUrl(objectPath, contentType);
    res.json({
      uploadUrl: signed.uploadUrl,
      objectPath: signed.objectPath,
      headers: { 'Content-Type': contentType },
      expiresInSec: 900,
    });
  } catch (error: any) {
    console.error('[API Error /uploads/sign]', error);
    res.status(500).json({ error: 'SIGN_FAILED', message: 'Could not start signed upload. Use direct upload.' });
  }
});

const DirectUploadSchema = z.object({
  userId: z.string().min(1),
  sceneId: z.number().int().min(1).max(4),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  imageBase64: z.string().min(100).max(14_000_000),
});

app.post('/api/v1/uploads', express.json({ limit: '16mb' }), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = DirectUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.errors });
      return;
    }

    const { userId, sceneId, contentType, imageBase64 } = parsed.data;
    const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    if (buffer.length < 8_000) {
      res.status(400).json({ error: 'IMAGE_TOO_SMALL', message: 'That image is too small. Use a screenshot.' });
      return;
    }
    if (buffer.length > 8_000_000) {
      res.status(400).json({ error: 'IMAGE_TOO_LARGE', message: 'Use a screenshot under 8 MB.' });
      return;
    }

    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const safeUser = userId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || 'user';
    const objectPath = `uploads/${safeUser}/${sceneId}-${randomUUID()}.${ext}`;
    await uploadBufferToGcs(buffer, objectPath, contentType, false);
    res.json({ objectPath });
  } catch (error: any) {
    console.error('[API Error /uploads]', error);
    res.status(500).json({ error: 'UPLOAD_FAILED', message: 'Could not save that photo. Try again.' });
  }
});

app.post('/api/v1/jobs', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = CreateJobSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parseResult.error.errors,
      });
      return;
    }

    const data = parseResult.data;
    if (!allowJobCall(data.userId, clientIp(req))) {
      res.status(429).json({
        error: 'JOB_RATE_LIMIT',
        message: 'Too many generates from this device. Wait and try again.',
      });
      return;
    }
    const inputUrl = resolveInputUrl(data.inputUrl);
    const sceneShots = (data.sceneShots || []).filter((s, i, arr) => {
      const unique = arr.findIndex((x) => x.sceneId === s.sceneId) === i;
      const uploadOk = Boolean(s.objectPath?.startsWith('uploads/'));
      const storeOk = Boolean(s.imageUrl && isAllowedStoreImageUrl(s.imageUrl));
      return unique && (uploadOk || storeOk);
    }).map((s) => ({
      sceneId: s.sceneId,
      ...(s.objectPath?.startsWith('uploads/') ? { objectPath: s.objectPath } : {}),
      ...(s.imageUrl && isAllowedStoreImageUrl(s.imageUrl) ? { imageUrl: s.imageUrl } : {}),
    }));

    await getOrCreateUser(data.userId, `${data.userId}@linkreel.user`);

    const { jobId, isDuplicate } = await createJobWithAtomicDeduction(data.userId, {
      userId: data.userId,
      inputUrl,
      productName: data.productName,
      userDescription: data.userDescription,
      enableWebScraping: data.enableWebScraping,
      lockedScript: data.lockedScript,
      sceneShots,
      idempotencyKey: data.idempotencyKey,
      aspectRatio: data.aspectRatio,
      stylePreset: data.stylePreset,
      voiceId: data.voiceId,
      captionStyle: data.captionStyle,
      musicTrack: data.musicTrack,
      musicVolume: data.musicVolume,
    });

    if (isDuplicate) {
      res.status(200).json({
        jobId,
        status: 'queued',
        isDuplicate: true,
        message: 'Returning existing in-flight job for idempotency key.',
      });
      return;
    }

    const jobDoc: VideoJobDocument = {
      id: jobId,
      userId: data.userId,
      inputUrl,
      productName: data.productName,
      userDescription: data.userDescription,
      enableWebScraping: data.enableWebScraping,
      lockedScript: data.lockedScript,
      sceneShots,
      idempotencyKey: data.idempotencyKey,
      aspectRatio: data.aspectRatio,
      stylePreset: data.stylePreset,
      voiceId: data.voiceId,
      captionStyle: data.captionStyle,
      musicTrack: data.musicTrack,
      musicVolume: data.musicVolume,
      status: 'queued',
      progress: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setImmediate(() => {
      pipelineCoordinator.executeJob(jobDoc).catch((err) => {
        console.error(`[Fatal Pipeline Error for ${jobId}]`, err);
      });
    });

    res.status(201).json({
      jobId,
      status: 'queued',
      progress: 5,
      message: 'Video generation job successfully queued.',
    });
  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_CREDITS') {
      res.status(402).json({
        error: 'INSUFFICIENT_CREDITS',
        message: `INSUFFICIENT_CREDITS: ${getPricingSync().messages.insufficientCredits}`,
      });
      return;
    }

    console.error('[API Error /jobs]', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred.',
    });
  }
});

app.get('/api/v1/jobs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.id);
    const userId = String(req.query.userId || '');
    const jobDoc = await firestore.collection(JOBS_COLLECTION).doc(jobId).get();
    if (!jobDoc.exists) {
      res.status(404).json({ error: 'JOB_NOT_FOUND', message: 'The requested job does not exist.' });
      return;
    }
    const data = jobDoc.data();
    if (userId && data?.userId && data.userId !== userId) {
      res.status(404).json({ error: 'JOB_NOT_FOUND', message: 'The requested job does not exist.' });
      return;
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: error.message });
  }
});

app.get('/api/v1/users/:uid/reels', async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = String(req.params.uid || '').trim();
    if (uid.length < 3 || uid.length > 80) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid user.' });
      return;
    }
    const reels = await listUserReels(uid);
    res.json({ reels });
  } catch (error: any) {
    console.error('[API Error /users/:uid/reels]', error);
    res.status(500).json({ error: 'DATABASE_ERROR', message: 'Could not load your reels.' });
  }
});

app.get('/api/v1/users/:uid', async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = String(req.params.uid);
    const user = await getOrCreateUser(uid, `${uid}@linkreel.user`);
    res.json({
      uid: user.uid,
      plan: user.plan,
      creditsRemaining: user.creditsRemaining,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: error.message });
  }
});

app.post('/api/v1/users/:uid/credits', (_req: Request, res: Response): void => {
  res.status(403).json({
    error: 'CREDIT_GRANT_DISABLED',
    message: 'Credits can only be added through an Apple In-App Purchase.',
  });
});

const ConfirmPurchaseSchema = z.object({
  userId: z.string().min(3).max(80),
  productId: z.enum(['com.linkreel.credits.10', 'com.linkreel.credits.25']),
  signedTransaction: z.string().min(80).max(20000),
});

app.post('/api/v1/purchases/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = ConfirmPurchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', details: parsed.error.errors });
      return;
    }
    const { userId, productId, signedTransaction } = parsed.data;
    const apple = verifyAppleSignedTransaction(signedTransaction, productId);
    await getOrCreateUser(userId, `${userId}@linkreel.user`);
    const result = await redeemStorePurchase({
      userId,
      productId: apple.productId,
      transactionId: apple.transactionId,
    });
    res.json({
      creditsRemaining: result.creditsRemaining,
      creditsAdded: result.creditsAdded,
      duplicate: result.duplicate,
      environment: apple.environment,
    });
  } catch (error: any) {
    const msg = String(error.message || '');
    if (error instanceof AppleIapError || msg === 'UNKNOWN_PRODUCT' || msg === 'INVALID_TRANSACTION') {
      res.status(400).json({
        error: 'APPLE_IAP_INVALID',
        message: msg === 'UNKNOWN_PRODUCT' ? 'That product is not a LinkReel credit pack.' : error.message,
      });
      return;
    }
    console.error('[API Error /purchases/confirm]', error);
    res.status(500).json({ error: 'PURCHASE_CONFIRM_FAILED', message: 'Could not add those credits. Try Restore Purchases.' });
  }
});

app.use((err: any, _req: Request, res: Response, next: any) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    res.status(413).json({
      error: 'IMAGE_TOO_LARGE',
      message: 'That photo is too large. Use a screenshot, not a full camera roll image.',
    });
    return;
  }
  next(err);
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(ENV.PORT, () => {
    console.log(`[LinkReel Backend API] Running on port ${ENV.PORT} (Project: ${ENV.GCP_PROJECT_ID})`);
  });
}
