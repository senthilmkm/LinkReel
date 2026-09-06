/**
 * Generate a 9:16 Predict Pro promo reel from the sample feature copy.
 *
 *   npx ts-node test_promo_video.ts
 *
 * Uses Gemini 3.7 Flash (then 3.1 Pro, then 2.5 Pro) when GEMINI_API_KEY
 * is set. Falls back to a high-retention template + Windows SAPI voice
 * when cloud keys are missing.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { storyboardService } from './src/services/storyboard.service';
import { ttsService } from './src/services/tts.service';
import { videoRendererService } from './src/services/renderer.service';
import { scraperService } from './src/services/scraper.service';
import { AudioSynthesisResult, ScrapedBranding } from './src/types';

const execFileAsync = promisify(execFile);

const PRODUCT_URL = 'https://senthilmkm.github.io/Predict/';

const userDescription = `It’s a 15-minute market and you’re living inside it. Phone an inch from your face. Kalshi open. You watch the contract like it owes you money, waiting for the lean so you can slam the order before the window dies. You don’t cook. You don’t answer the text. You don’t stand up for water. The second you look away, the price is gone and you were just a human refresh button.

That’s the old job: sit, stare, tap, miss, repeat.

Predict flips it. You set the lean you want, the cushion, the risk gates, Protect-Sell. Then you put the phone face down. If the book hits your rules, Predict places the order. If it doesn’t, you weren’t chained to a 15-minute clock for nothing.

You don’t have to babysit a candle. Set it. Stay cool. Let Predict take the fill.`;

const FEATURES = [
  'Live Kalshi 15-minute lean signals & alerts',
  'Automated trading execution with risk buffers & cushions',
  'Full access to Protect-Sell and settlement engine',
  'Unlimited trade history export & analytics dashboard',
];

async function synthesizeLocalVoice(narration: string, outDir: string): Promise<AudioSynthesisResult | null> {
  const wavPath = path.join(outDir, 'promo_narration.wav');
  const mp3Path = path.join(outDir, 'promo_narration.mp3');
  const escaped = narration.replace(/'/g, "''");
  const ps = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 1
$synth.SetOutputToWaveFile('${wavPath.replace(/\\/g, '/')}')
$synth.Speak('${escaped}')
$synth.Dispose()
`;
  try {
    await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { timeout: 60000 });
    if (!fs.existsSync(wavPath) || fs.statSync(wavPath).size < 1000) return null;

    const ffmpegBin = require('@ffmpeg-installer/ffmpeg').path as string;
    await execFileAsync(ffmpegBin, ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '128k', mp3Path], {
      timeout: 30000,
    });
    const audioBuffer = fs.readFileSync(mp3Path);
    const words = narration.trim().split(/\s+/);
    const durationSeconds = Math.max(26, Math.min(32, words.length / 2.6));
    const secPerWord = durationSeconds / words.length;
    return {
      audioBuffer,
      durationSeconds,
      timecodes: words.map((word, idx) => ({
        word,
        startSec: parseFloat((idx * secPerWord).toFixed(2)),
        endSec: parseFloat(((idx + 1) * secPerWord).toFixed(2)),
      })),
    };
  } catch (err: any) {
    console.warn('[Promo] Local Windows voice failed:', err.message);
    return null;
  }
}

async function runPromoVideo() {
  const outputDir = path.join(process.cwd(), 'diagnostic_output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log('====================================================');
  console.log('LinkReel promo video  —  Predict Pro');
  console.log('====================================================\n');

  let branding: ScrapedBranding = {
    url: PRODUCT_URL,
    title: 'Predict Pro',
    description: 'Live Kalshi 15-minute lean signals and automated execution with risk cushions.',
    features: FEATURES,
    primaryColor: '#3DB8A0',
    accentColor: '#C6A75E',
    heroScreenshotPath: '',
    featureScreenshotPaths: [],
  };

  let scraped = false;
  try {
    console.log('1. Scraping product page for branding + screenshot...');
    const scrapedBranding = await scraperService.scrapeWebsite(PRODUCT_URL, outputDir);
    scraped = true;
    branding = {
      ...scrapedBranding,
      title: 'Predict Pro',
      description: 'Live Kalshi 15-minute lean signals and automated execution with risk cushions.',
      features: FEATURES,
      primaryColor: scrapedBranding.primaryColor || branding.primaryColor,
      accentColor: scrapedBranding.accentColor || branding.accentColor,
    };
    console.log(`   Title: ${branding.title}`);
    console.log(`   Hero:  ${branding.heroScreenshotPath || '(none)'}`);
  } catch (err: any) {
    console.warn('   Scrape skipped:', err.message);
  } finally {
    await scraperService.close().catch(() => undefined);
  }

  console.log('\n2. Writing storyboard (Gemini 3.7 Flash → 3.1 Pro → 2.5 Pro → fallback)...');
  const storyboard = await storyboardService.generateStoryboard(
    branding,
    'saas_dark',
    userDescription,
    scraped
  );
  console.log(`   Model used: ${storyboard.modelUsed || 'unknown'}`);
  console.log(`   Hook: ${storyboard.hook}`);
  console.log(`   Narration: ${storyboard.fullNarration}`);
  storyboard.scenes.forEach((scene) => {
    console.log(`   Scene ${scene.id} (${scene.durationSec}s): ${scene.caption}`);
  });
  fs.writeFileSync(
    path.join(outputDir, 'promo_storyboard.json'),
    JSON.stringify({ modelUsed: storyboard.modelUsed, ...storyboard }, null, 2)
  );

  console.log('\n3. Synthesizing voiceover...');
  let audioResult = await ttsService.synthesizeNarration(storyboard.fullNarration, 'en-US-Neural2-D');
  if (!audioResult.audioBuffer || audioResult.audioBuffer.length < 512) {
    console.log('   Cloud TTS unavailable — using Windows SAPI voice.');
    const local = await synthesizeLocalVoice(storyboard.fullNarration, outputDir);
    if (local) audioResult = local;
  }
  console.log(`   Audio: ${audioResult.durationSeconds.toFixed(1)}s, ${audioResult.audioBuffer.length} bytes`);

  console.log('\n4. Rendering 9:16 motion-graphics MP4...');
  const renderResult = await videoRendererService.renderVideo({
    jobId: 'predict_pro_viral_ios',
    branding,
    storyboard,
    audioResult,
    aspectRatio: '9:16',
    outputDir,
  });

  const finalPath = path.join(outputDir, 'predict_pro_viral_ios.mp4');
  if (fs.existsSync(renderResult.outputVideoPath)) {
    fs.copyFileSync(renderResult.outputVideoPath, finalPath);
  }

  const bytes = fs.existsSync(finalPath) ? fs.statSync(finalPath).size : 0;
  console.log('\n====================================================');
  console.log('Promo video ready');
  console.log(`  File:     ${finalPath}`);
  console.log(`  Size:     ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Duration: ${renderResult.durationSeconds}s`);
  console.log(`  Model:    ${storyboard.modelUsed || 'unknown'}`);
  console.log('====================================================');

  if (bytes < 50_000) {
    throw new Error('Rendered file is too small — FFmpeg likely wrote a dummy buffer.');
  }
}

runPromoVideo().catch((err) => {
  console.error('Promo generation failed:', err);
  process.exit(1);
});
