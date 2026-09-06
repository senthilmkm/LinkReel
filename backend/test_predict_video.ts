import { storyboardService } from './src/services/storyboard.service';
import { ttsService } from './src/services/tts.service';
import { videoRendererService } from './src/services/renderer.service';
import fs from 'fs';
import path from 'path';

const predictDescription = `Trade prediction markets with confidence and mathematical safety. Predict is the ultimate smart execution and signal platform built specifically for Kalshi 15-minute event contracts.

Whether you want real-time buffered market alerts or full hands-free algorithmic execution, Predict helps you capitalize on fast-moving prediction markets with risk buffers, static gates, and institutional safety controls.

TRADING PREDICTIONS, WITH A BUFFER
In 15-minute event markets, speed and risk management are everything. Predict analyzes live Kalshi order books and filters every opportunity through customized cushion gates before issuing signals or executing trades. 

KEY FEATURES:

• LEAN 15M SIGNALS & BUFFERS
Get instant notification alerts when market conditions meet your exact probability cushion and risk parameters.

• SECURE AUTO-TRADING ENGINE
Enable hands-free auto-trading backed by Face ID / Touch ID biometric authorization. Predict signs orders directly with hardware-backed RSA keys via Kalshi’s API.

• ADVANCED RISK GATES & CUSHIONS
Protect your capital with customizable risk gates, position limits, profit buffers, and window locks to prevent over-trading.

• INSTANT KILL SWITCH
Arm or disarm auto-trading instantly with a single tap on your home dashboard.

• PROTECT-SELL & SETTLEMENT TRACKING
Automatically track positions through contract settlement or trigger protect-sell rules to exit early and lock in profits.

• ALERTS HUB & HISTORY EXPORT
Review detailed execution history, analyze win rates, and export past trade data for audit and strategy refinement.

PREDICT PRO SUBSCRIPTION
Unlock the full power of automated trading and live signals with Predict Pro:
- Live Kalshi 15-minute lean signals & alerts
- Automated trading execution with risk buffers & cushions
- Full access to Protect-Sell and settlement engine
- Unlimited trade history export & analytics dashboard`;

async function testPredictVideoGeneration() {
  console.log('====================================================');
  console.log('🚀 LinkReel AI Video Pipeline Test for Predict App');
  console.log('====================================================\n');

  const branding = {
    url: 'https://senthilmkm.github.io/Predict/',
    title: 'Predict | Smart Kalshi 15M Trade Signals & Auto-Trading',
    description: 'Trade prediction markets with confidence and mathematical safety.',
    features: [
      'Lean 15M Signals & Probability Buffers',
      'Secure Hardware RSA Auto-Trading Engine',
      'Advanced Risk Gates & Instant Kill Switch',
      'Protect-Sell & Contract Settlement Engine',
    ],
    primaryColor: '#06B6D4', // Vibrant Cyan / Tech Amber
    accentColor: '#1E293B',
    heroScreenshotPath: '',
    featureScreenshotPaths: [],
    heroScreenshotUrl: '',
  };

  console.log('1. Generating AI Storyboard using Gemini 2.5 Pro (Scraping: OFF)...');
  const storyboard = await storyboardService.generateStoryboard(
    branding,
    'saas_dark',
    predictDescription,
    false // enableWebScraping = false
  );

  console.log('\n--- Gemini 2.5 Pro Generated Storyboard ---');
  console.log('🎯 Hook:', storyboard.hook);
  console.log('🎙️ Full Narration:', storyboard.fullNarration);
  console.log('\n🎬 Scenes:');
  storyboard.scenes.forEach((scene) => {
    console.log(`  [Scene ${scene.id} | ${scene.durationSec}s] Caption: "${scene.caption}" | Narration: "${scene.narrationText}"`);
  });

  console.log('\n2. Synthesizing Neural2 Voiceover (en-US-Neural2-D)...');
  const audioResult = await ttsService.synthesizeNarration(storyboard.fullNarration, 'en-US-Neural2-D');
  console.log(`✅ Audio synthesized: ${audioResult.durationSeconds.toFixed(1)}s (${audioResult.audioBuffer.length} bytes)`);

  console.log('\n3. Rendering 9:16 HD Motion Graphics MP4 Video...');
  const outputDir = path.join(process.cwd(), 'diagnostic_output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const renderResult = await videoRendererService.renderVideo({
    jobId: 'predict_app_promo',
    branding,
    storyboard,
    audioResult,
    aspectRatio: '9:16',
    outputDir,
  });

  console.log('\n====================================================');
  console.log('✅ PREDICT PROMO VIDEO SUCCESSFULLY RENDERED!');
  console.log(`📹 Video File Path: ${renderResult.outputVideoPath}`);
  console.log(`⏱️ Final Duration: ${renderResult.durationSeconds}s`);
  console.log('====================================================');

  // Copy to scratch/artifacts directory for persistent reference
  const artifactDir = 'C:\\Users\\senth\\.gemini\\antigravity-ide\\brain\\88cd9012-4698-4c76-928d-cdafb34aa248';
  if (fs.existsSync(artifactDir)) {
    const destVideo = path.join(artifactDir, 'predict_promo_video.mp4');
    fs.copyFileSync(renderResult.outputVideoPath, destVideo);
    console.log(`\n📦 Video copied to artifact directory: ${destVideo}`);
  }
}

testPredictVideoGeneration().catch(console.error);
