import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AspectRatio, AudioSynthesisResult, ScrapedBranding, Storyboard } from '../types';
import { buildVoiceMusicMixFilter, resolveMusicBedPath } from './music-bed';
import { formatStoreProof } from './app-store.service';

/** Predict iOS tokens from ForesightApp/src/theme/tokens.ts */
const P = {
  bg: '#0F1419',
  surface: '#1A222C',
  elevated: '#232D3A',
  border: '#2E3A48',
  text: '#F2F5F7',
  secondary: '#8B98A5',
  accent: '#3DB8A0',
  gold: '#C6A75E',
  win: '#3DDC97',
  warn: '#E6B35A',
  danger: '#E85D5D',
  mute: '#5A6875',
} as const;

export interface RenderOptions {
  jobId: string;
  branding: ScrapedBranding;
  storyboard: Storyboard;
  audioResult: AudioSynthesisResult;
  aspectRatio: AspectRatio;
  outputDir?: string;
  sceneShotPaths?: Array<string | undefined>;
  /** Extra listing screens — more than 4 clips when Apple sent more iPhone shots. */
  sceneClips?: Array<{
    sceneIndex: number;
    shotPath?: string;
    videoPath?: string;
    videoStartSec?: number;
    videoSliceSec?: number;
  }>;
}

export interface RenderResult {
  outputVideoPath: string;
  durationSeconds: number;
  resolution: { width: number; height: number };
}

export class VideoRendererService {
  getResolutionForAspect(aspect: AspectRatio): { width: number; height: number } {
    switch (aspect) {
      case '9:16': return { width: 1080, height: 1920 };
      case '1:1':  return { width: 1080, height: 1080 };
      case '16:9': return { width: 1920, height: 1080 };
      default:     return { width: 1080, height: 1920 };
    }
  }

  async renderVideo(options: RenderOptions): Promise<RenderResult> {
    const { jobId, branding, storyboard, audioResult, aspectRatio, outputDir, sceneShotPaths, sceneClips } = options;
    const clips: Array<{
      sceneIndex: number;
      shotPath?: string;
      videoPath?: string;
      videoStartSec?: number;
      videoSliceSec?: number;
    }> = (sceneClips && sceneClips.length > 0)
      ? sceneClips
      : [0, 1, 2, 3].map((sceneIndex) => ({ sceneIndex, shotPath: sceneShotPaths?.[sceneIndex] }));
    const targetDir = outputDir || fs.mkdtempSync(path.join(os.tmpdir(), `linkreel-render-${jobId}-`));

    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const resolution = this.getResolutionForAspect(aspectRatio);
    const outputVideoPath = path.join(targetDir, `${jobId}_output_${aspectRatio.replace(':', '_')}.mp4`);

    try {
      const framePaths: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        const framePath = path.join(targetDir, `scene_${i + 1}.png`);
        await this.renderSceneFrame({
          sceneIndex: clips[i].sceneIndex,
          resolution,
          branding,
          storyboard,
          outputPath: framePath,
          shotPath: clips[i].shotPath,
          overlayOnly: Boolean(clips[i].videoPath),
        });
        framePaths.push(framePath);
        console.log(`[VideoRenderer] Frame ${i + 1}/${clips.length} rendered: ${framePath}`);
      }

      await this.assembleVideoWithFfmpeg({
        framePaths,
        motionClips: clips,
        outputPath: outputVideoPath,
        duration: audioResult.durationSeconds || 25,
        audioBuffer: audioResult.audioBuffer,
        targetDir,
        resolution,
      });

      if (!this.isValidMp4(outputVideoPath)) {
        throw new Error('RENDER_FAILURE: FFmpeg produced an invalid MP4.');
      }

      return { outputVideoPath, durationSeconds: audioResult.durationSeconds || 25, resolution };
    } catch (err: any) {
      console.error('[VideoRenderer] Render error:', err.message);
      throw new Error(`RENDER_FAILURE: ${err.message || 'Video encode failed.'}`);
    }
  }

  /** Full-bleed Predict screens from ForesightApp layout — for LinkReel scene uploads. */
  exportPredictFeatureShots(outDir: string): string[] {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const w = 1170;
    const h = 2532;
    const phone = { x: 0, y: 0, w, h };
    const jobs: Array<{ file: string; kind: 'home' | 'cushions' | 'lock' }> = [
      { file: '01_home_last_signals.png', kind: 'home' },
      { file: '03_cushions.png', kind: 'cushions' },
      { file: '04_order_filled.png', kind: 'lock' },
    ];
    const paths: string[] = [];
    for (const job of jobs) {
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = P.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = P.text;
      ctx.font = '600 28px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('9:41', 48, 52);
      ctx.textAlign = 'right';
      ctx.fillText('5G', w - 48, 52);

      if (job.kind === 'home') this.drawPredictHomeScreen(ctx, phone);
      else if (job.kind === 'cushions') this.drawPredictCushionsScreen(ctx, phone);
      else this.drawLockScreenFill(ctx, phone, 'Predict', P.accent);

      const out = path.join(outDir, job.file);
      fs.writeFileSync(out, canvas.toBuffer('image/png'));
      paths.push(out);
    }
    return paths;
  }

  private async renderSceneFrame(params: {
    sceneIndex: number;
    resolution: { width: number; height: number };
    branding: ScrapedBranding;
    storyboard: Storyboard;
    outputPath: string;
    shotPath?: string;
    overlayOnly?: boolean;
  }) {
    const { sceneIndex, resolution, branding, storyboard, outputPath, shotPath, overlayOnly } = params;
    const { width, height } = resolution;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const isPredict = /predict|kalshi/i.test(`${branding.url} ${branding.title}`);
    const primaryColor = isPredict ? P.accent : (branding.primaryColor || P.accent);
    const accentColor  = isPredict ? P.gold : (branding.accentColor || P.gold);

    if (overlayOnly) {
      await this.drawPreviewCaptionOverlay(ctx, {
        sceneIndex,
        width,
        height,
        productName: (branding.title.split(/[-|]/)[0] || 'Your product').trim(),
        scene: storyboard.scenes?.[sceneIndex],
        primaryColor,
        accentColor,
        branding,
      });
      fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
      return;
    }

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0B1016');
    bgGrad.addColorStop(0.5, P.bg);
    bgGrad.addColorStop(1, '#0A0E12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width / 2, height * 0.35, 20, width / 2, height * 0.35, width * 0.6);
    glow.addColorStop(0, primaryColor + '33');
    glow.addColorStop(1, '#00000000');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const productName = (branding.title.split(/[-|]/)[0] || 'Your product').trim();
    const phone = this.phoneRect(width, height);
    const scene = storyboard.scenes?.[sceneIndex];
    const userShot = await this.tryLoadShot(shotPath);

    if (sceneIndex === 0) {
      this.drawKicker(ctx, width / 2, 88, `${productName.toUpperCase().slice(0, 18)}  ·  PROMO`);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 54px sans-serif';
      this.drawWrappedText(ctx, scene?.caption || 'STILL STUCK IN THE LOOP?', width / 2, 150, width - 100, 62);
      ctx.fillStyle = P.secondary;
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(scene?.narrationText?.slice(0, 64) || 'The old job, in one line.', width / 2, 300);

      this.drawIPhone(ctx, phone);
      if (userShot) {
        await this.drawShotInDevice(ctx, phone, userShot);
      } else if (isPredict) {
        this.drawPredictHomeScreen(ctx, phone);
      } else {
        this.drawCaptionFallback(ctx, phone, scene?.caption || 'THE HOOK', scene?.narrationText || '');
      }

    } else if (sceneIndex === 1) {
      this.drawKicker(ctx, width / 2, 88, 'THE OLD LOOP');
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 50px sans-serif';
      this.drawWrappedText(ctx, scene?.caption || 'SIT. STARE. TAP. MISS.', width / 2, 150, width - 100, 58);

      if (userShot) {
        this.drawIPhone(ctx, phone);
        await this.drawShotInDevice(ctx, phone, userShot);
      } else {
        const pains = [
          { title: 'The old way eats time', sub: scene?.narrationText || 'You do the work by hand and miss the moment.' },
          { title: 'Look away once', sub: 'The window closes. You start over.' },
          { title: 'You are the refresh button', sub: 'Sit. Stare. Tap. Miss. Repeat.' },
        ];
        pains.forEach((item, idx) => {
          this.drawIOSNotification(ctx, 70, 340 + idx * 280, width - 140, 250, item.title, item.sub, idx);
        });
        ctx.fillStyle = '#F87171';
        ctx.font = '800 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("That's the loop this reel is about.", width / 2, 1280);
      }

    } else if (sceneIndex === 2) {
      this.drawKicker(ctx, width / 2, 88, 'THE FIX');
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 50px sans-serif';
      this.drawWrappedText(ctx, scene?.caption || 'SET IT. STAY COOL.', width / 2, 150, width - 100, 58);
      ctx.fillStyle = P.secondary;
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(scene?.narrationText?.slice(0, 72) || `${productName} takes the next step.`, width / 2, 300);

      this.drawIPhone(ctx, phone);
      if (userShot) {
        await this.drawShotInDevice(ctx, phone, userShot);
      } else if (isPredict) {
        this.drawPredictCushionsScreen(ctx, phone);
      } else {
        this.drawCaptionFallback(ctx, phone, scene?.caption || 'THE FIX', scene?.narrationText || '');
      }

    } else {
      this.drawKicker(ctx, width / 2, 88, 'START FREE');
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 50px sans-serif';
      this.drawWrappedText(ctx, scene?.caption || `TRY ${productName.toUpperCase()} TODAY`, width / 2, 150, width - 100, 58);

      this.drawIPhone(ctx, { ...phone, y: phone.y - 20 });
      if (userShot) {
        await this.drawShotInDevice(ctx, { ...phone, y: phone.y - 20 }, userShot);
      } else {
        this.drawLockScreenFill(ctx, { ...phone, y: phone.y - 20 }, productName, primaryColor);
      }

      await this.drawStoreProofCta(ctx, {
        width,
        height,
        productName,
        primaryColor,
        accentColor,
        branding,
      });
    }

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
  }

  private drawMockBrowserFrame(ctx: any, x: number, y: number, w: number, h: number, title: string) {
    ctx.beginPath();
    ctx.fillStyle = '#161B26';
    ctx.roundRect(x, y, w, h, 24); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = '#0D111A';
    ctx.roundRect(x, y, w, 54, 24); ctx.fill();
    ['#EF4444','#F59E0B','#10B981'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x + 32 + i * 24, y + 27, 8, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#94A3B8'; ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, x + w / 2, y + 34);
  }

  // ── Helpers ──

  private phoneRect(canvasW: number, canvasH: number) {
    const w = 800;
    const h = 1280;
    return { x: (canvasW - w) / 2, y: 330, w, h };
  }

  private async drawPreviewCaptionOverlay(
    ctx: any,
    params: {
      sceneIndex: number;
      width: number;
      height: number;
      productName: string;
      scene?: { caption?: string; narrationText?: string };
      primaryColor: string;
      accentColor: string;
      branding: ScrapedBranding;
    }
  ) {
    const { sceneIndex, width, height, productName, scene, primaryColor, accentColor, branding } = params;
    const top = ctx.createLinearGradient(0, 0, 0, 340);
    top.addColorStop(0, 'rgba(7,10,16,0.82)');
    top.addColorStop(1, 'rgba(7,10,16,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, 340);

    const kickers = [
      `${productName.toUpperCase().slice(0, 18)}  ·  PROMO`,
      'THE OLD LOOP',
      'THE FIX',
      'START FREE',
    ];
    this.drawKicker(ctx, width / 2, 88, kickers[sceneIndex] || kickers[0]);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 50px sans-serif';
    this.drawWrappedText(ctx, scene?.caption || 'WATCH THIS', width / 2, 150, width - 100, 58);

    if (sceneIndex === 3) {
      await this.drawStoreProofCta(ctx, {
        width,
        height,
        productName,
        primaryColor,
        accentColor,
        branding,
        dimBackground: true,
      });
    }
  }

  private async drawStoreProofCta(
    ctx: any,
    params: {
      width: number;
      height: number;
      productName: string;
      primaryColor: string;
      accentColor: string;
      branding: ScrapedBranding;
      dimBackground?: boolean;
    }
  ) {
    const { width, height, productName, primaryColor, accentColor, branding, dimBackground } = params;
    const proof = formatStoreProof(branding);
    const icon = await this.tryLoadShot(branding.iconPath);

    if (dimBackground) {
      const bottom = ctx.createLinearGradient(0, height - 420, 0, height);
      bottom.addColorStop(0, 'rgba(7,10,16,0)');
      bottom.addColorStop(1, 'rgba(7,10,16,0.82)');
      ctx.fillStyle = bottom;
      ctx.fillRect(0, height - 420, width, 420);
    }

    const btnY = height - 220;
    const proofY = btnY - (proof.ratingLine || icon ? 118 : 70);

    if (icon) {
      const size = 72;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(width / 2 - 200, proofY - 8, size, size, 16);
      ctx.clip();
      ctx.drawImage(icon, width / 2 - 200, proofY - 8, size, size);
      ctx.restore();
    }

    ctx.textAlign = icon ? 'left' : 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 28px sans-serif';
    ctx.fillText(productName.slice(0, 22), icon ? width / 2 - 112 : width / 2, proofY + 22);

    if (proof.starCount > 0 && proof.ratingLine) {
      ctx.fillStyle = P.gold;
      ctx.font = '700 26px sans-serif';
      ctx.fillText(`${'★'.repeat(proof.starCount)}${'☆'.repeat(5 - proof.starCount)}`, icon ? width / 2 - 112 : width / 2, proofY + 56);
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '600 20px sans-serif';
      ctx.fillText(proof.ratingLine, icon ? width / 2 - 112 : width / 2, proofY + 86);
    }

    const btnGrad = ctx.createLinearGradient(90, btnY, width - 90, btnY);
    btnGrad.addColorStop(0, primaryColor);
    btnGrad.addColorStop(1, accentColor);
    ctx.beginPath();
    ctx.fillStyle = btnGrad;
    ctx.roundRect(90, btnY, width - 180, 88, 44);
    ctx.fill();
    ctx.fillStyle = '#070A10';
    ctx.font = '800 28px sans-serif';
    ctx.textAlign = 'center';
    const priceBit = proof.priceLine ? `  ·  ${proof.priceLine}` : '';
    ctx.fillText(`Get on the App Store${priceBit}`.slice(0, 36), width / 2, btnY + 56);
  }

  private drawKicker(ctx: any, x: number, y: number, text: string) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '700 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }

  private drawIPhone(ctx: any, p: { x: number; y: number; w: number; h: number }) {
    ctx.beginPath();
    ctx.fillStyle = '#0A0A0C';
    ctx.roundRect(p.x, p.y, p.w, p.h, 68);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = P.bg;
    ctx.roundRect(p.x + 16, p.y + 16, p.w - 32, p.h - 32, 56);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#111113';
    ctx.roundRect(p.x + p.w / 2 - 90, p.y + 28, 180, 38, 19);
    ctx.fill();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('9:41', p.x + 48, p.y + 78);
    ctx.textAlign = 'right';
    ctx.fillText('5G', p.x + p.w - 48, p.y + 78);
  }

  private screenBox(p: { x: number; y: number; w: number; h: number }) {
    return { x: p.x + 28, y: p.y + 100, w: p.w - 56, h: p.h - 150 };
  }

  private async tryLoadShot(shotPath?: string): Promise<any | null> {
    if (!shotPath || !fs.existsSync(shotPath)) return null;
    try {
      const img = await loadImage(shotPath);
      if (!img.width || !img.height) return null;
      return img;
    } catch (err: any) {
      console.warn(`[VideoRenderer] Shot skipped: ${err.message}`);
      return null;
    }
  }

  private async drawShotInDevice(
    ctx: any,
    p: { x: number; y: number; w: number; h: number },
    img: { width: number; height: number }
  ) {
    const s = this.screenBox(p);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 36);
    ctx.clip();
    ctx.fillStyle = '#0B1016';
    ctx.fillRect(s.x, s.y, s.w, s.h);

    // Contain: show the full upload. Cover was clipping top/bottom of tall screenshots.
    const scale = Math.min(s.w / img.width, s.h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = s.x + (s.w - dw) / 2;
    const dy = s.y + (s.h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  private drawCaptionFallback(
    ctx: any,
    p: { x: number; y: number; w: number; h: number },
    caption: string,
    body: string
  ) {
    const s = this.clipPhoneScreen(ctx, p);
    this.drawCard(ctx, s.x + 20, s.y + 80, s.w - 40, 220, 22, P.surface, P.border);
    ctx.fillStyle = P.gold;
    ctx.font = '800 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NO SHOT — CAPTION CARD', s.x + s.w / 2, s.y + 130);
    ctx.fillStyle = P.text;
    ctx.font = '800 28px sans-serif';
    this.drawWrappedText(ctx, caption, s.x + s.w / 2, s.y + 180, s.w - 80, 34);
    ctx.fillStyle = P.secondary;
    ctx.font = '18px sans-serif';
    this.drawWrappedText(ctx, body.slice(0, 120), s.x + s.w / 2, s.y + 280, s.w - 80, 26);
    ctx.restore();
  }

  private clipPhoneScreen(ctx: any, p: { x: number; y: number; w: number; h: number }) {
    const s = this.screenBox(p);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 36);
    ctx.clip();
    ctx.fillStyle = P.bg;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    return s;
  }

  private drawNavHeader(ctx: any, s: { x: number; y: number; w: number }, title: string) {
    ctx.fillStyle = P.surface;
    ctx.fillRect(s.x, s.y, s.w, 56);
    ctx.fillStyle = P.border;
    ctx.fillRect(s.x, s.y + 55, s.w, 1);

    ctx.fillStyle = P.text;
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, s.x + 18, s.y + 36);

    ctx.strokeStyle = P.text;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x + s.w - 78, s.y + 38);
    ctx.lineTo(s.x + s.w - 78, s.y + 20);
    ctx.moveTo(s.x + s.w - 86, s.y + 27);
    ctx.lineTo(s.x + s.w - 78, s.y + 18);
    ctx.lineTo(s.x + s.w - 70, s.y + 27);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = P.text;
    ctx.moveTo(s.x + s.w - 42, s.y + 34);
    ctx.lineTo(s.x + s.w - 22, s.y + 34);
    ctx.quadraticCurveTo(s.x + s.w - 20, s.y + 22, s.x + s.w - 32, s.y + 16);
    ctx.quadraticCurveTo(s.x + s.w - 44, s.y + 22, s.x + s.w - 42, s.y + 34);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.x + s.w - 32, s.y + 36, 3, 0, Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = P.danger;
    ctx.arc(s.x + s.w - 20, s.y + 16, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('2', s.x + s.w - 20, s.y + 20);
  }

  private drawTabBar(ctx: any, s: { x: number; y: number; w: number; h: number }, active: string) {
    const tabs = ['Home', 'Cushions', 'History', 'Dashboard', 'Settings'];
    const barH = 72;
    const y = s.y + s.h - barH;
    ctx.fillStyle = P.surface;
    ctx.fillRect(s.x, y, s.w, barH);
    ctx.fillStyle = P.border;
    ctx.fillRect(s.x, y, s.w, 1);

    const slot = s.w / tabs.length;
    tabs.forEach((tab, i) => {
      const on = tab === active;
      ctx.fillStyle = on ? P.accent : P.mute;
      ctx.font = on ? '700 13px sans-serif' : '600 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tab, s.x + slot * i + slot / 2, y + 42);
    });
  }

  private drawSwitch(ctx: any, x: number, y: number, on: boolean) {
    ctx.beginPath();
    ctx.fillStyle = on ? P.accent : P.mute;
    ctx.roundRect(x, y, 46, 28, 14);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = P.text;
    ctx.arc(on ? x + 32 : x + 14, y + 14, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSlider(ctx: any, x: number, y: number, w: number, pct: number) {
    ctx.beginPath();
    ctx.fillStyle = P.border;
    ctx.roundRect(x, y, w, 6, 3);
    ctx.fill();
    const fillW = Math.max(12, w * Math.min(1, Math.max(0, pct)));
    ctx.beginPath();
    ctx.fillStyle = P.accent;
    ctx.roundRect(x, y, fillW, 6, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = P.gold;
    ctx.arc(x + fillW, y + 3, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawChip(ctx: any, x: number, y: number, label: string, active: boolean) {
    ctx.font = active ? '700 13px sans-serif' : '500 13px sans-serif';
    const tw = ctx.measureText(label).width + 28;
    ctx.beginPath();
    ctx.fillStyle = active ? P.accent : P.surface;
    ctx.strokeStyle = active ? P.accent : P.border;
    ctx.lineWidth = 1.5;
    ctx.roundRect(x, y, tw, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = active ? P.bg : P.secondary;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 14, y + 21);
    return tw;
  }

  /** Home tab — ForesightApp/src/screens/HomeScreen.tsx */
  private drawPredictHomeScreen(ctx: any, p: { x: number; y: number; w: number; h: number }) {
    const s = this.clipPhoneScreen(ctx, p);
    this.drawNavHeader(ctx, s, 'Predict');

    const x = s.x + 20;
    const w = s.w - 40;
    let y = s.y + 72;

    ctx.fillStyle = P.gold;
    ctx.font = '700 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Predict', x, y + 28);
    ctx.fillStyle = P.secondary;
    ctx.font = '16px sans-serif';
    ctx.fillText('Prediction trades, with a buffer.', x, y + 52);

    this.drawCard(ctx, x + w - 168, y, 80, 58, 14, P.elevated, P.border);
    ctx.fillStyle = P.secondary;
    ctx.font = '800 8px sans-serif';
    ctx.fillText('PREDICTIONS', x + w - 158, y + 18);
    ctx.fillStyle = P.text;
    ctx.font = '800 15px sans-serif';
    ctx.fillText('$1,240.00', x + w - 158, y + 42);

    this.drawCard(ctx, x + w - 80, y, 80, 58, 14, P.surface, P.border);
    ctx.fillStyle = P.text;
    ctx.font = '800 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$860.00', x + w - 40, y + 28);
    ctx.fillStyle = P.secondary;
    ctx.font = '500 11px sans-serif';
    ctx.fillText('Cash', x + w - 40, y + 46);
    ctx.textAlign = 'left';

    y += 78;
    ctx.font = '600 12px sans-serif';
    const modeLabel = 'Alerts on · auto-trading';
    const modeW = ctx.measureText(modeLabel).width + 28;
    ctx.beginPath();
    ctx.fillStyle = P.surface;
    ctx.strokeStyle = P.accent;
    ctx.lineWidth = 1.5;
    ctx.roundRect(x, y, modeW, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.accent;
    ctx.textAlign = 'left';
    ctx.fillText(modeLabel, x + 14, y + 21);
    const chipX = x + modeW + 8;
    ctx.beginPath();
    ctx.fillStyle = P.surface;
    ctx.strokeStyle = P.border;
    ctx.lineWidth = 1.5;
    ctx.roundRect(chipX, y, 92, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = P.win;
    ctx.arc(chipX + 16, y + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.win;
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Live · 4s', chipX + 28, y + 21);

    y += 48;
    ctx.beginPath();
    ctx.fillStyle = P.danger;
    ctx.roundRect(x, y, w, 48, 12);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Kill switch — disarm now', x + w / 2, y + 31);
    ctx.textAlign = 'left';

    y += 64;
    this.drawCard(ctx, x, y, w, 88, 12, P.surface, P.border);
    ctx.fillStyle = P.secondary;
    ctx.font = '13px sans-serif';
    ctx.fillText('Today snapshot (ET)', x + 16, y + 24);
    ctx.fillStyle = P.text;
    ctx.font = '600 18px sans-serif';
    ctx.fillText('P&L $12.40 · 2W / 0L · pending 1', x + 16, y + 50);
    ctx.fillStyle = P.mute;
    ctx.font = '11px sans-serif';
    ctx.fillText('Today’s fills only. Wins/losses update after the 15m market resolves.', x + 16, y + 72);

    y += 104;
    this.drawCard(ctx, x, y, w, 292, 12, P.surface, P.border);
    ctx.fillStyle = P.secondary;
    ctx.font = '13px sans-serif';
    ctx.fillText('Last signals', x + 16, y + 26);
    ctx.fillStyle = P.accent;
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Last tick 9:41:12 · 4s ago', x + w - 16, y + 26);
    ctx.textAlign = 'left';

    const signals = [
      { asset: 'BTC', decision: 'YES', gap: 'gap $187.00', time: '9:41:08 · 8s ago', trade: 'filled · YES 2 ctr · $12.00', tradeColor: P.win },
      { asset: 'ETH', decision: 'SKIP', gap: 'gap $4.20', time: '9:41:06 · 10s ago', trade: '', tradeColor: P.warn },
      { asset: 'SOL', decision: 'YES', gap: 'gap $0.62', time: '9:41:04 · 12s ago', trade: '', tradeColor: P.win },
    ];
    signals.forEach((row, i) => {
      const ry = y + 44 + i * 78;
      ctx.fillStyle = P.border;
      ctx.fillRect(x + 16, ry, w - 32, 1);
      ctx.fillStyle = P.text;
      ctx.font = '700 16px sans-serif';
      ctx.fillText(row.asset, x + 16, ry + 28);
      ctx.fillStyle = row.decision === 'SKIP' ? P.warn : P.win;
      ctx.font = '800 16px sans-serif';
      ctx.fillText(row.decision, x + 72, ry + 28);
      ctx.fillStyle = P.mute;
      ctx.font = '12px sans-serif';
      ctx.fillText(row.gap, x + 128, ry + 28);
      ctx.textAlign = 'right';
      ctx.font = '11px sans-serif';
      ctx.fillText(row.time, x + w - 16, ry + 28);
      ctx.textAlign = 'left';
      if (row.trade) {
        ctx.fillStyle = row.tradeColor;
        ctx.font = '600 11px sans-serif';
        ctx.fillText(row.trade, x + 72, ry + 50);
      }
    });
    ctx.fillStyle = P.mute;
    ctx.font = '11px sans-serif';
    ctx.fillText('Lean YES/NO alerts are signals only. A real order shows “order placed”.', x + 16, y + 278);

    y += 308;
    ctx.beginPath();
    ctx.fillStyle = P.accent;
    ctx.roundRect(x, y, (w - 10) / 2, 48, 12);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = P.elevated;
    ctx.roundRect(x + (w - 10) / 2 + 10, y, (w - 10) / 2, 48, 12);
    ctx.fill();
    ctx.fillStyle = P.text;
    ctx.font = '700 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Stop poller', x + (w - 10) / 4, y + 31);
    ctx.fillText('Tick once', x + (w - 10) * 0.75 + 5, y + 31);
    ctx.textAlign = 'left';

    y += 64;
    ctx.fillStyle = P.mute;
    ctx.font = '12px sans-serif';
    this.drawWrappedTextLeft(
      ctx,
      '24/7 background trading runs securely on GCP Cloud Run. Your phone does not need to stay open.',
      x,
      y,
      w,
      17
    );

    this.drawTabBar(ctx, s, 'Home');
    ctx.restore();
  }

  /** Cushions tab — ForesightApp/src/screens/CushionsScreen.tsx */
  private drawPredictCushionsScreen(ctx: any, p: { x: number; y: number; w: number; h: number }) {
    const s = this.clipPhoneScreen(ctx, p);
    this.drawNavHeader(ctx, s, 'Cushions');

    const x = s.x + 16;
    const w = s.w - 32;
    let y = s.y + 72;

    ctx.fillStyle = P.secondary;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    this.drawWrappedTextLeft(
      ctx,
      'Static $ cushions — trade only when gap clears the buffer. Drag to adjust; saves automatically.',
      x,
      y,
      w,
      18
    );

    y += 48;
    let chipX = x;
    chipX += this.drawChip(ctx, chipX, y, 'All', true) + 8;
    chipX += this.drawChip(ctx, chipX, y, 'Crypto 24/7', false) + 8;
    this.drawChip(ctx, chipX, y, 'CME Commodities', false);

    y += 48;
    ctx.fillStyle = P.text;
    ctx.font = '700 16px sans-serif';
    ctx.fillText('Crypto 24/7', x, y + 20);
    ctx.fillStyle = P.secondary;
    ctx.font = '12px sans-serif';
    ctx.fillText('7/8 active', x + 118, y + 20);
    this.drawSwitch(ctx, x + w - 46, y + 4, true);

    y += 40;
    const assets = [
      { name: 'Bitcoin 15m (BTC)', value: '$175', pct: 0.32, step: '5', lo: '$25', hi: '$500' },
      { name: 'Ethereum 15m (ETH)', value: '$9', pct: 0.16, step: '0.5', lo: '$1', hi: '$50' },
      { name: 'Solana 15m (SOL)', value: '$0.50', pct: 0.05, step: '0.05', lo: '$0.05', hi: '$10' },
      { name: 'Ripple 15m (XRP)', value: '$0.01', pct: 0.04, step: '0.002', lo: '$0.002', hi: '$0.20' },
    ];
    assets.forEach((asset) => {
      this.drawCard(ctx, x, y, w, 148, 14, P.surface, P.border);
      ctx.fillStyle = P.text;
      ctx.font = '600 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(asset.name, x + 16, y + 28);
      ctx.fillStyle = P.accent;
      ctx.font = '700 22px sans-serif';
      ctx.fillText(asset.value, x + 16, y + 56);
      this.drawSwitch(ctx, x + w - 62, y + 18, true);
      this.drawSlider(ctx, x + 16, y + 78, w - 32, asset.pct);
      ctx.fillStyle = P.mute;
      ctx.font = '11px sans-serif';
      ctx.fillText(asset.lo, x + 16, y + 104);
      ctx.textAlign = 'right';
      ctx.fillText(asset.hi, x + w - 16, y + 104);
      ctx.textAlign = 'left';
      ctx.beginPath();
      ctx.fillStyle = P.elevated;
      ctx.roundRect(x + 16, y + 114, 64, 24, 12);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + 88, y + 114, 64, 24, 12);
      ctx.fill();
      ctx.fillStyle = P.text;
      ctx.font = '12px sans-serif';
      ctx.fillText(`-${asset.step}`, x + 28, y + 131);
      ctx.fillText(`+${asset.step}`, x + 100, y + 131);
      y += 160;
    });

    this.drawTabBar(ctx, s, 'Cushions');
    ctx.restore();
  }

  private drawLockScreenFill(ctx: any, p: { x: number; y: number; w: number; h: number }, productName: string, primary: string) {
    const s = this.clipPhoneScreen(ctx, p);

    ctx.fillStyle = P.text;
    ctx.font = '300 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('9:41', s.x + s.w / 2, s.y + 90);
    ctx.fillStyle = P.secondary;
    ctx.font = '20px sans-serif';
    ctx.fillText('Friday', s.x + s.w / 2, s.y + 132);

    this.drawCard(ctx, s.x + 16, s.y + 180, s.w - 32, 150, 22, P.surface, primary + '66');
    ctx.fillStyle = P.gold;
    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(productName.toUpperCase(), s.x + 38, s.y + 214);
    ctx.fillStyle = P.text;
    ctx.font = '800 24px sans-serif';
    ctx.fillText('Order filled', s.x + 38, s.y + 250);
    ctx.fillStyle = P.secondary;
    ctx.font = '15px sans-serif';
    ctx.fillText('BTC YES · 2 ctr @ $0.58 · cost $12.00', s.x + 38, s.y + 284);

    this.drawCard(ctx, s.x + 16, s.y + 348, s.w - 32, 132, 20, P.surface, P.border);
    ctx.fillStyle = P.gold;
    ctx.font = '700 13px sans-serif';
    ctx.fillText(productName.toUpperCase(), s.x + 38, s.y + 380);
    ctx.fillStyle = P.text;
    ctx.font = '800 22px sans-serif';
    ctx.fillText('Signal · ETH YES', s.x + 38, s.y + 414);
    ctx.fillStyle = P.secondary;
    ctx.font = '14px sans-serif';
    ctx.fillText('Gap $9.40 · cushion $9.00 · 11m left · not an order', s.x + 38, s.y + 446);

    ctx.fillStyle = P.mute;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Swipe up to unlock', s.x + s.w / 2, s.y + s.h - 40);
    ctx.restore();
  }

  private drawIOSNotification(ctx: any, x: number, y: number, w: number, h: number, title: string, sub: string, idx: number) {
    this.drawCard(ctx, x, y, w, h, 28, '#16181F', 'rgba(255,255,255,0.10)');
    ctx.beginPath();
    ctx.fillStyle = idx === 2 ? '#F43F5E' : '#334155';
    ctx.roundRect(x + 24, y + 28, 56, 56, 16);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(idx + 1), x + 52, y + 66);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 26px sans-serif';
    ctx.textAlign = 'left';
    this.drawWrappedTextLeft(ctx, title, x + 100, y + 58, w - 140, 32);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '20px sans-serif';
    this.drawWrappedTextLeft(ctx, sub, x + 100, y + 130, w - 140, 28);
  }

  private drawBadge(ctx: any, text: string, color: string, x: number, y: number, w: number) {
    ctx.font = 'bold 24px sans-serif';
    const tw = ctx.measureText(text).width + 60;
    ctx.beginPath();
    ctx.fillStyle = color + '25';
    ctx.roundRect(x - tw / 2, y, tw, 56, 28); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 36);
  }

  private drawCard(ctx: any, x: number, y: number, w: number, h: number, r: number, fill: string, stroke: string) {
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.roundRect(x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  }

  private drawWrappedText(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    ctx.textAlign = 'center';
    const words = (text || '').split(' ');
    let line = '', currentY = y;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, currentY);
        line = word + ' '; currentY += lineHeight;
      } else { line = test; }
    }
    ctx.fillText(line.trim(), x, currentY);
  }

  private drawWrappedTextLeft(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    ctx.textAlign = 'left';
    const words = (text || '').split(' ');
    let line = '', currentY = y;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), x, currentY);
        line = word + ' '; currentY += lineHeight;
      } else { line = test; }
    }
    ctx.fillText(line.trim(), x, currentY);
  }

  private resolveFfmpegBin(): string {
    try {
      const installerPath = require('@ffmpeg-installer/ffmpeg').path as string;
      if (installerPath && fs.existsSync(installerPath)) return installerPath;
    } catch {}
    return 'ffmpeg';
  }

  isValidMp4(filePath: string): boolean {
    if (!filePath || !fs.existsSync(filePath)) return false;
    const size = fs.statSync(filePath).size;
    if (size < 32_000) return false;
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    return buf.toString('ascii', 4, 8) === 'ftyp';
  }

  private assembleVideoWithFfmpeg(params: {
    framePaths: string[];
    motionClips?: Array<{
      sceneIndex: number;
      shotPath?: string;
      videoPath?: string;
      videoStartSec?: number;
      videoSliceSec?: number;
    }>;
    outputPath: string;
    duration: number;
    audioBuffer?: Buffer;
    targetDir: string;
    resolution: { width: number; height: number };
  }): Promise<void> {
    const { framePaths, motionClips, outputPath, duration, audioBuffer, targetDir, resolution } = params;
    const { spawn } = require('child_process');
    const ffmpegBin = this.resolveFfmpegBin();
    const { width, height } = resolution;
    const sceneDur = Math.max(2, duration / Math.max(1, framePaths.length));

    let audioFile: string | null = null;
    if (audioBuffer && audioBuffer.length > 512 &&
        ((audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44) ||
         (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0))) {
      audioFile = path.join(targetDir, 'narration.mp3');
      fs.writeFileSync(audioFile, audioBuffer);
      console.log(`[VideoRenderer] Audio: ${audioBuffer.length} bytes`);
    }

    const runFfmpeg = (args: string[]): Promise<void> =>
      new Promise((resolve, reject) => {
        const proc = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
        const timer = setTimeout(() => {
          proc.kill('SIGKILL');
          reject(new Error(`FFmpeg timeout: ${args.slice(0, 4).join(' ')}`));
        }, 120000);
        proc.on('close', (code: number) => {
          clearTimeout(timer);
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg code ${code}: ${stderr.slice(-800)}`));
        });
        proc.on('error', (err: Error) => { clearTimeout(timer); reject(err); });
      });

    return (async () => {
      const clipPaths: string[] = [];
      for (let i = 0; i < framePaths.length; i++) {
        const d = (i === framePaths.length - 1)
          ? Math.max(2, duration - sceneDur * (framePaths.length - 1))
          : sceneDur;
        const clipPath = path.join(targetDir, `clip_${i}.mp4`);
        const fadeOutStart = Math.max(0.3, d - 0.35);
        const motion = motionClips?.[i];
        const usePreview = Boolean(motion?.videoPath && fs.existsSync(motion.videoPath));

        if (usePreview && motion?.videoPath) {
          const start = Number(motion.videoStartSec || 0);
          const slice = Math.max(2, Number(motion.videoSliceSec || d));
          const vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=yuv420p,fade=t=in:st=0:d=0.25,fade=t=out:st=${fadeOutStart}:d=0.25`;
          await runFfmpeg([
            '-y',
            '-stream_loop', '-1',
            '-ss', start.toFixed(2),
            '-t', slice.toFixed(2),
            '-i', motion.videoPath,
            '-i', framePaths[i],
            '-t', String(d),
            '-filter_complex', `[0:v]${vf}[v];[v][1:v]overlay=0:0`,
            '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1',
            '-preset', 'veryfast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-r', '24',
            '-an',
            '-movflags', '+faststart',
            clipPath,
          ]);
        } else {
          const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fade=t=in:st=0:d=0.25,fade=t=out:st=${fadeOutStart}:d=0.25`;
          await runFfmpeg([
            '-y', '-loop', '1', '-i', framePaths[i],
            '-t', String(d),
            '-vf', vf,
            '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1',
            '-preset', 'veryfast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-r', '24',
            '-movflags', '+faststart',
            clipPath,
          ]);
        }
        clipPaths.push(clipPath);
        console.log(`[VideoRenderer] Clip ${i + 1}/${framePaths.length} encoded (${d}s)`);
      }

      const concatListPath = path.join(targetDir, 'clips_concat.txt');
      fs.writeFileSync(concatListPath, clipPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));

      const finalArgs = [
        '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath,
      ];
      if (audioFile && fs.existsSync(audioFile)) finalArgs.push('-i', audioFile);
      const musicFile = resolveMusicBedPath();
      const mixMusic = Boolean(audioFile && musicFile);
      if (mixMusic && musicFile) {
        finalArgs.push('-stream_loop', '-1', '-i', musicFile);
      }
      if (mixMusic) {
        finalArgs.push('-filter_complex', buildVoiceMusicMixFilter(duration), '-map', '0:v', '-map', '[a]');
      }
      finalArgs.push(
        '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1',
        '-preset', 'veryfast', '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      );
      if (audioFile && fs.existsSync(audioFile)) finalArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
      finalArgs.push(outputPath);

      console.log(`[VideoRenderer] Merging ${clipPaths.length} clips${mixMusic ? ' + music bed' : ''}...`);
      await runFfmpeg(finalArgs);

      const size = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
      console.log(`[VideoRenderer] Final video: ${size} bytes`);
    })();
  }
}

export const videoRendererService = new VideoRendererService();
