import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { normalizeCaptionStyle, CAPTION_STYLES } from '../../src/config/caption-style';
import { videoRendererService } from '../../src/services/renderer.service';
import { CaptionStyle } from '../../src/types';

function brightness(ctx: any, x: number, y: number): number {
  const px = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return (px[0] + px[1] + px[2]) / 3;
}

function maxBrightness(ctx: any, x: number, y: number, radius = 40): number {
  let max = 0;
  for (let dy = -radius; dy <= radius; dy += 6) {
    for (let dx = -radius; dx <= radius; dx += 6) {
      max = Math.max(max, brightness(ctx, x + dx, y + dy));
    }
  }
  return max;
}

function maxGold(ctx: any, x: number, y: number, radius = 50): [number, number, number] {
  let best: [number, number, number] = [0, 0, 0];
  let bestScore = -1;
  for (let dy = -radius; dy <= radius; dy += 6) {
    for (let dx = -radius; dx <= radius; dx += 6) {
      const px = ctx.getImageData(Math.round(x + dx), Math.round(y + dy), 1, 1).data;
      const score = px[0] + px[1] - px[2] * 1.4;
      if (score > bestScore) {
        bestScore = score;
        best = [px[0], px[1], px[2]];
      }
    }
  }
  return best;
}

function storyboard() {
  return {
    hook: 'Hook',
    fullNarration: 'Highlightword sits on the first beat of the reel.',
    scenes: [
      {
        id: 1,
        durationSec: 4,
        caption: 'Highlightword sits here',
        narrationText: 'hook line',
        assetType: 'screenshot_hero' as const,
        motionEffect: 'zoom_in' as const,
      },
      {
        id: 2,
        durationSec: 8,
        caption: 'PAIN',
        narrationText: 'pain',
        assetType: 'screenshot_feature' as const,
        motionEffect: 'zoom_in' as const,
      },
      {
        id: 3,
        durationSec: 12,
        caption: 'FIX',
        narrationText: 'fix',
        assetType: 'screenshot_hero' as const,
        motionEffect: 'pan_down' as const,
      },
      {
        id: 4,
        durationSec: 6,
        caption: 'CTA',
        narrationText: 'cta',
        assetType: 'brand_card' as const,
        motionEffect: 'zoom_in' as const,
      },
    ],
  };
}

const branding = {
  url: 'https://example.com',
  title: 'Example',
  description: 'desc',
  primaryColor: '#3DB8A0',
  accentColor: '#C6A75E',
  heroScreenshotPath: '',
  featureScreenshotPaths: [],
};

async function renderStyle(style: CaptionStyle) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `linkreel-caption-${style}-`));
  await videoRendererService.renderVideo({
    jobId: `caption_${style}`,
    branding,
    storyboard: storyboard(),
    audioResult: { audioBuffer: Buffer.from('mp3'), durationSeconds: 8, timecodes: [] },
    aspectRatio: '9:16',
    outputDir: dir,
    captionStyle: style,
  });
  const frame = await loadImage(path.join(dir, 'scene_1.png'));
  const canvas = createCanvas(frame.width, frame.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(frame, 0, 0);
  return { dir, ctx, width: frame.width, height: frame.height };
}

describe('Caption styles', () => {
  it('normalizes unknown styles to bold_center', () => {
    expect(normalizeCaptionStyle('bold_center')).toBe('bold_center');
    expect(normalizeCaptionStyle('nope')).toBe('bold_center');
    expect(normalizeCaptionStyle(undefined)).toBe('bold_center');
    expect(CAPTION_STYLES).toHaveLength(4);
  });

  it('draws four distinct caption looks end to end', async () => {
    const bold = await renderStyle('bold_center');
    const bar = await renderStyle('bottom_bar');
    const hi = await renderStyle('word_highlight');
    const min = await renderStyle('minimal');

    const cx = bold.width / 2;
    const topY = 145;
    const barTextY = bold.height - 200 - 36 + 92;

    const boldTop = maxBrightness(bold.ctx, cx, topY);
    const barTop = maxBrightness(bar.ctx, cx, topY);
    const barBottom = maxBrightness(bar.ctx, cx, barTextY);
    const boldBottom = maxBrightness(bold.ctx, cx, barTextY);
    const [hr, hg, hb] = maxGold(hi.ctx, cx, 155);
    const minTop = maxBrightness(min.ctx, cx, 136);

    expect(boldTop).toBeGreaterThan(140);
    expect(barTop).toBeLessThan(boldTop - 30);
    expect(barBottom).toBeGreaterThan(boldBottom + 40);
    expect(hr).toBeGreaterThan(140);
    expect(hg).toBeGreaterThan(120);
    expect(hb).toBeLessThan(hr);
    expect(minTop).toBeGreaterThan(40);
    expect(minTop).toBeLessThan(boldTop);
  }, 120000);
});
