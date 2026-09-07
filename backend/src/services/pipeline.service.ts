import fs from 'fs';
import path from 'path';
import os from 'os';
import { scraperService } from './scraper.service';
import { storyboardService, normalizeStoryboard } from './storyboard.service';
import { ttsService } from './tts.service';
import { videoRendererService } from './renderer.service';
import { uploadLocalFileToGcs, uploadBufferToGcs, downloadGcsObjectToFile } from './storage.service';
import {
  downloadAllowedImage,
  lookupAppStoreListing,
  packListingClips,
  parseAppleId,
  PackedSceneClip,
} from './app-store.service';
import { downloadPreviewVideo, previewSliceTimes } from './preview-video.service';
import { updateJobProgress, failJob } from './firestore.service';
import { VideoJobDocument, JobErrorCode, ScrapedBranding } from '../types';

export class VideoPipelineCoordinator {
  async executeJob(job: VideoJobDocument): Promise<void> {
    const { id: jobId, inputUrl, stylePreset, voiceId, aspectRatio, captionStyle, musicTrack, musicVolume } = job;
    const hasShots = Boolean(job.sceneShots && job.sceneShots.length > 0);
    const shouldScrape = job.enableWebScraping === true && !hasShots && !isPlaceholderUrl(inputUrl);
    let scrapedBranding: ScrapedBranding;

    try {
      await updateJobProgress(jobId, 'scraping', 15);

      if (shouldScrape) {
        console.log(`[Pipeline ${jobId}] Stage 1: Scraping website ${inputUrl}...`);
        scrapedBranding = await scraperService.scrapeWebsite(inputUrl);
        try {
          scrapedBranding.heroScreenshotUrl = await uploadLocalFileToGcs(
            scrapedBranding.heroScreenshotPath,
            `jobs/${jobId}/hero.png`,
            false
          );
        } catch (err: any) {
          console.warn(`[Pipeline ${jobId}] GCS upload hero warning:`, err.message);
        }
      } else {
        console.log(`[Pipeline ${jobId}] Stage 1: Skip scrape (shots or scrape off).`);
        const title = (job.productName || '').trim()
          || inputUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
          || 'Your product';
        scrapedBranding = {
          url: inputUrl,
          title,
          description: job.userDescription || title,
          primaryColor: '#3DB8A0',
          accentColor: '#C6A75E',
          heroScreenshotPath: '',
          featureScreenshotPaths: [],
        };
      }

      if (/predict|kalshi/i.test(`${scrapedBranding.url} ${scrapedBranding.title}`)) {
        scrapedBranding.primaryColor = '#3DB8A0';
        scrapedBranding.accentColor = '#C6A75E';
      }

      await updateJobProgress(jobId, 'scripting', 35, {
        branding: scrapedBranding,
      });

      let storyboard;
      if (job.lockedScript && job.lockedScript.scenes?.length === 4) {
        console.log(`[Pipeline ${jobId}] Stage 2: Reusing locked storyboard (no Gemini).`);
        storyboard = normalizeStoryboard(job.lockedScript, scrapedBranding);
      } else {
        console.log(`[Pipeline ${jobId}] Stage 2: Planning scenes (Flash only).`);
        storyboard = await storyboardService.planScenes({
          branding: scrapedBranding,
          stylePreset,
          userDescription: job.userDescription,
          enableWebScraping: shouldScrape,
        });
      }

      await updateJobProgress(jobId, 'generating_audio', 55, {
        script: storyboard,
      });

      console.log(`[Pipeline ${jobId}] Stage 3: Synthesizing Neural2 voiceover (${voiceId})...`);
      const audioResult = await ttsService.synthesizeNarration(storyboard.fullNarration, voiceId);

      let audioGcsUrl = '';
      try {
        audioGcsUrl = await uploadBufferToGcs(
          audioResult.audioBuffer,
          `audio/${jobId}_voiceover.mp3`,
          'audio/mpeg',
          true
        );
      } catch (err: any) {
        console.warn(`[Pipeline ${jobId}] GCS audio upload warning:`, err.message);
      }
      audioResult.audioUrl = audioGcsUrl;

      const shotDir = fs.mkdtempSync(path.join(os.tmpdir(), `linkreel-shots-${jobId}-`));
      await hydrateStoreProof(job, scrapedBranding, shotDir);
      const sceneClips = await downloadSceneShots(job, shotDir, jobId);
      const withPreview = await attachListingPreview(job, shotDir, jobId, sceneClips);

      await updateJobProgress(jobId, 'rendering', 75, {
        audioUrl: audioGcsUrl,
      });

      console.log(`[Pipeline ${jobId}] Stage 4: Rendering (${aspectRatio}) shots=${withPreview.filter((c) => c.shotPath).length} clips=${withPreview.length} preview=${withPreview.some((c) => c.videoPath) ? 'yes' : 'no'}`);
      const renderResult = await videoRendererService.renderVideo({
        jobId,
        branding: scrapedBranding,
        storyboard,
        audioResult,
        aspectRatio,
        sceneClips: withPreview,
        captionStyle,
        musicTrack,
        musicVolume,
      });

      if (!videoRendererService.isValidMp4(renderResult.outputVideoPath)) {
        throw new Error('RENDER_FAILURE: Encoded video is missing or not a valid MP4.');
      }

      const publicVideoUrl = await uploadLocalFileToGcs(
        renderResult.outputVideoPath,
        `videos/${jobId}_${aspectRatio.replace(':', '_')}.mp4`,
        true
      );

      await updateJobProgress(jobId, 'completed', 100, {
        outputVideoUrl: publicVideoUrl,
        audioUrl: audioResult.audioUrl,
        durationSeconds: renderResult.durationSeconds,
      });

      console.log(`[Pipeline ${jobId}] Video generated: ${publicVideoUrl}`);
    } catch (error: any) {
      console.error(`[Pipeline ${jobId} Failed]`, error);

      let errorCode: JobErrorCode = 'RENDER_FAILURE';
      let title = 'Video Generation Failed';
      let message = error.message || 'An unexpected error occurred during rendering.';

      if (error.message?.includes('INVALID_URL')) {
        errorCode = 'INVALID_URL';
        title = 'Invalid Website URL';
        message = 'Please provide a valid public URL starting with http or https.';
      } else if (error.message?.includes('PAYWALL_DETECTED')) {
        errorCode = 'PAYWALL_DETECTED';
        title = 'Paywall / Login Barrier Detected';
        message = 'This website requires login credentials. Please provide a public webpage.';
      } else if (error.message?.includes('SCRAPE_TIMEOUT')) {
        errorCode = 'SCRAPE_TIMEOUT';
        title = 'Website Timed Out';
        message = 'The website took too long to respond. Please check the address or try again.';
      }

      await failJob(jobId, errorCode, title, message, true);
    }
  }
}

async function hydrateStoreProof(
  job: VideoJobDocument,
  branding: ScrapedBranding,
  destDir: string
): Promise<void> {
  if (!parseAppleId(job.inputUrl || '')) return;
  try {
    const listing = await lookupAppStoreListing(job.inputUrl);
    branding.title = listing.name || branding.title;
    branding.iconUrl = listing.iconUrl;
    branding.averageUserRating = listing.averageUserRating;
    branding.userRatingCount = listing.userRatingCount;
    branding.priceLabel = listing.priceLabel;
    if (!listing.iconUrl) return;
    const dest = path.join(destDir, 'app_icon.jpg');
    await downloadAllowedImage(listing.iconUrl, dest);
    if (fs.existsSync(dest) && fs.statSync(dest).size >= 2_000) {
      branding.iconPath = dest;
    }
  } catch (err: any) {
    console.warn(`[Pipeline ${job.id}] Store proof skipped: ${err.message}`);
  }
}

function isPlaceholderUrl(url: string): boolean {
  return /linkreel\.app/i.test(url || '');
}

async function resolvePackedShots(job: VideoJobDocument): Promise<PackedSceneClip[]> {
  const picks = job.sceneShots || [];
  if (!parseAppleId(job.inputUrl || '')) {
    return [1, 2, 3, 4].map((sceneId) => {
      const pick = picks.find((s) => s.sceneId === sceneId);
      return pick
        ? { sceneId, imageUrl: pick.imageUrl, objectPath: pick.objectPath }
        : { sceneId };
    });
  }
  try {
    const listing = await lookupAppStoreListing(job.inputUrl);
    return packListingClips(listing.screenshotUrls, picks);
  } catch (err: any) {
    console.warn(`[Pipeline ${job.id}] Listing pack skipped: ${err.message}`);
    return packListingClips([], picks);
  }
}

type RenderClip = {
  sceneIndex: number;
  shotPath?: string;
  videoPath?: string;
  videoStartSec?: number;
  videoSliceSec?: number;
};

async function attachListingPreview(
  job: VideoJobDocument,
  destDir: string,
  jobId: string,
  clips: RenderClip[]
): Promise<RenderClip[]> {
  if (!parseAppleId(job.inputUrl || '')) return clips;
  try {
    const listing = await lookupAppStoreListing(job.inputUrl);
    const trailer = listing.previewVideoUrls?.[0];
    if (!trailer) return clips;
    const dest = path.join(destDir, 'store_preview.mp4');
    const previewDur = await downloadPreviewVideo(trailer, dest);
    const used = new Set<number>();
    console.log(`[Pipeline ${jobId}] Store preview ${previewDur.toFixed(1)}s`);
    return clips.map((clip) => {
      if (clip.sceneIndex < 0 || clip.sceneIndex > 3 || used.has(clip.sceneIndex)) return clip;
      used.add(clip.sceneIndex);
      const slice = previewSliceTimes(previewDur, clip.sceneIndex);
      return { ...clip, videoPath: dest, ...slice };
    });
  } catch (err: any) {
    console.warn(`[Pipeline ${jobId}] Store preview skipped: ${err.message}`);
    return clips;
  }
}

async function downloadSceneShots(
  job: VideoJobDocument,
  destDir: string,
  jobId: string
): Promise<RenderClip[]> {
  const packed = await resolvePackedShots(job);
  const clips: Array<{ sceneIndex: number; shotPath?: string }> = [];

  for (let i = 0; i < packed.length; i++) {
    const shot = packed[i];
    const sceneIndex = shot.sceneId - 1;
    if (sceneIndex < 0 || sceneIndex > 3) continue;
    if (!shot.imageUrl && !shot.objectPath) {
      clips.push({ sceneIndex });
      continue;
    }

    const dest = path.join(destDir, `clip_${i + 1}.bin`);
    try {
      if (shot.imageUrl) {
        await downloadAllowedImage(shot.imageUrl, dest);
      } else if (shot.objectPath) {
        await downloadGcsObjectToFile(shot.objectPath, dest);
      }
      const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
      if (size < 8_000 || size > 8_000_000) {
        console.warn(`[Pipeline ${jobId}] Clip ${i + 1} rejected size=${size}`);
        clips.push({ sceneIndex });
        continue;
      }
      const head = Buffer.alloc(8);
      const fd = fs.openSync(dest, 'r');
      fs.readSync(fd, head, 0, 8, 0);
      fs.closeSync(fd);
      const ext = head[0] === 0x89 && head[1] === 0x50
        ? '.png'
        : head[0] === 0xff && head[1] === 0xd8
          ? '.jpg'
          : head.toString('ascii', 0, 4) === 'RIFF'
            ? '.webp'
            : '.jpg';
      const typed = path.join(destDir, `clip_${i + 1}${ext}`);
      fs.renameSync(dest, typed);
      clips.push({ sceneIndex, shotPath: typed });
    } catch (err: any) {
      console.warn(`[Pipeline ${jobId}] Clip ${i + 1} download failed: ${err.message}`);
      clips.push({ sceneIndex });
    }
  }

  if (clips.length === 0) {
    return [0, 1, 2, 3].map((sceneIndex) => ({ sceneIndex }));
  }
  return clips;
}

export const pipelineCoordinator = new VideoPipelineCoordinator();
