import { storyboardService } from './src/services/storyboard.service';
import { ttsService } from './src/services/tts.service';
import { videoRendererService } from './src/services/renderer.service';
import fs from 'fs';
import path from 'path';

const userDescription = `- Live Kalshi 15-minute lean signals & alerts
- Automated trading execution with risk buffers & cushions
- Full access to Protect-Sell and settlement engine
- Unlimited trade history export & analytics dashboard`;

async function runPredictProVideo() {
  console.log('====================================================');
  console.log('🚀 LinkReel AI Video Pipeline for Predict Pro');
  console.log('====================================================\n');

  const branding = {
    url: 'https://senthilmkm.github.io/Predict/',
    title: 'Predict Pro | Kalshi 15M Trading Signals & Auto Execution',
    description: 'Live Kalshi 15-minute lean signals & automated execution.',
    features: [
      'Live Kalshi 15M Lean Signals & Alerts',
      'Automated Trading Execution & Risk Cushions',
      'Protect-Sell & Contract Settlement Engine',
      'Unlimited Trade History Export & Analytics',
    ],
    primaryColor: '#6366F1',
    accentColor: '#06B6D4',
    heroScreenshotPath: '',
    featureScreenshotPaths: [],
    heroScreenshotUrl: '',
  };

  console.log('1. Generating Script & Storyboard using Gemini 2.5 Pro (Scraping: OFF)...');
  const storyboard = await storyboardService.generateStoryboard(
    branding,
    'saas_dark',
    userDescription,
    false // enableWebScraping = false
  );

  console.log('\n--- Gemini 2.5 Pro Generated Storyboard ---');
  console.log('🎯 Hook:', storyboard.hook);
  console.log('🎙️ Full Narration:', storyboard.fullNarration);
  console.log('\n🎬 Scenes:');
  storyboard.scenes.forEach((scene) => {
    console.log(`  [Scene ${scene.id} | ${scene.durationSec}s] Caption: "${scene.caption}" | Narration: "${scene.narrationText}"`);
  });

  console.log('\n2. Synthesizing Neural2 Studio Voiceover...');
  const audioResult = await ttsService.synthesizeNarration(storyboard.fullNarration, 'en-US-Neural2-D');
  console.log(`✅ Audio synthesized: ${audioResult.durationSeconds.toFixed(1)}s`);

  console.log('\n3. Rendering 9:16 HD Vertical MP4 Video Reel...');
  const outputDir = path.join(process.cwd(), 'diagnostic_output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const renderResult = await videoRendererService.renderVideo({
    jobId: 'predict_pro_features_reel',
    branding,
    storyboard,
    audioResult,
    aspectRatio: '9:16',
    outputDir,
  });

  console.log('\n====================================================');
  console.log('✅ PREDICT PRO VIDEO SUCCESSFULLY GENERATED!');
  console.log(`📹 Video Output Path: ${renderResult.outputVideoPath}`);
  console.log(`⏱️ Duration: ${renderResult.durationSeconds}s`);
  console.log('====================================================');

  // Copy to persistent artifact directory
  const artifactDir = 'C:\\Users\\senth\\.gemini\\antigravity-ide\\brain\\88cd9012-4698-4c76-928d-cdafb34aa248';
  if (fs.existsSync(artifactDir)) {
    const destVideo = path.join(artifactDir, 'predict_pro_features_reel.mp4');
    fs.copyFileSync(renderResult.outputVideoPath, destVideo);
    console.log(`📦 Saved copy to artifact directory: ${destVideo}`);
  }
}

runPredictProVideo().catch(console.error);
