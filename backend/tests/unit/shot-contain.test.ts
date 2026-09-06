import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { videoRendererService } from '../../src/services/renderer.service';

function makeMarkerShot(filePath: string) {
  const w = 400;
  const h = 1200;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#222222';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#FF0033';
  ctx.fillRect(0, 0, w, 80);
  ctx.fillStyle = '#0066FF';
  ctx.fillRect(0, h - 80, w, 80);
  ctx.fillStyle = '#FFEE00';
  ctx.fillRect(0, 0, 40, h);
  ctx.fillStyle = '#00CC66';
  ctx.fillRect(w - 40, 0, 40, h);
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
}

function sample(ctx: any, x: number, y: number): [number, number, number] {
  const px = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return [px[0], px[1], px[2]];
}

function isRed(rgb: [number, number, number]) {
  return rgb[0] > 180 && rgb[1] < 80 && rgb[2] < 80;
}

function isBlue(rgb: [number, number, number]) {
  return rgb[2] > 180 && rgb[0] < 80 && rgb[1] < 120;
}

describe('Uploaded shots are fully visible in the reel', () => {
  it('keeps the top and bottom of a tall user screenshot (contain, not cover-crop)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkreel-shot-test-'));
    const shotPath = path.join(dir, 'user_shot.png');
    makeMarkerShot(shotPath);

    const result = await videoRendererService.renderVideo({
      jobId: 'shot_contain_test',
      branding: {
        url: 'https://example.com',
        title: 'Example',
        description: 'desc',
        primaryColor: '#3DB8A0',
        accentColor: '#C6A75E',
        heroScreenshotPath: '',
        featureScreenshotPaths: [],
      },
      storyboard: {
        hook: 'Hook',
        fullNarration: 'Hook problem solution call to action.',
        scenes: [
          { id: 1, durationSec: 4, caption: 'HOOK', narrationText: 'hook', assetType: 'screenshot_hero', motionEffect: 'zoom_in' },
          { id: 2, durationSec: 8, caption: 'PAIN', narrationText: 'pain', assetType: 'screenshot_feature', motionEffect: 'zoom_in' },
          { id: 3, durationSec: 12, caption: 'FIX', narrationText: 'fix', assetType: 'screenshot_hero', motionEffect: 'pan_down' },
          { id: 4, durationSec: 6, caption: 'CTA', narrationText: 'cta', assetType: 'brand_card', motionEffect: 'zoom_in' },
        ],
      },
      audioResult: { audioBuffer: Buffer.from('mp3'), durationSeconds: 8, timecodes: [] },
      aspectRatio: '9:16',
      outputDir: dir,
      sceneShotPaths: [shotPath, undefined, shotPath, undefined],
    });

    expect(fs.existsSync(result.outputVideoPath)).toBe(true);

    const frame = await loadImage(path.join(dir, 'scene_1.png'));
    const canvas = createCanvas(frame.width, frame.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(frame, 0, 0);

    // Phone screen sits under the caption; sample near the inner screen top/bottom.
    const cx = frame.width / 2;
    let foundRed = false;
    let foundBlue = false;
    for (let y = 400; y < 700; y += 8) {
      if (isRed(sample(ctx, cx, y))) foundRed = true;
    }
    for (let y = 1400; y < 1680; y += 8) {
      if (isBlue(sample(ctx, cx, y))) foundBlue = true;
    }

    expect(foundRed).toBe(true);
    expect(foundBlue).toBe(true);
  }, 60000);
});
