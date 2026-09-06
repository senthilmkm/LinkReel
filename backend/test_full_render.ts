import { ttsService } from './src/services/tts.service';
import { videoRendererService } from './src/services/renderer.service';
import fs from 'fs';
import path from 'path';

async function testFullPipeline() {
  console.log('1. Testing TTS Speech Synthesis...');
  const text = 'Stop wasting hours on manual tasks. Meet Supabase! The open source Firebase alternative with Postgres database, authentication, instant APIs, and realtime edge functions. Try Supabase today at supabase.com!';
  
  const audioResult = await ttsService.synthesizeNarration(text, 'en-US-Neural2-F');
  console.log('TTS Audio Buffer Size:', audioResult.audioBuffer.length, 'bytes');
  console.log('TTS Duration:', audioResult.durationSeconds, 'seconds');
  
  const testAudioPath = path.join(process.cwd(), 'test_narration.mp3');
  fs.writeFileSync(testAudioPath, audioResult.audioBuffer);
  console.log('Saved test audio to:', testAudioPath);

  console.log('\n2. Testing Motion Graphics Video Composition...');
  const renderResult = await videoRendererService.renderVideo({
    jobId: 'test_supabase_diagnostic',
    branding: {
      url: 'https://supabase.com',
      title: 'Supabase | The Postgres Development Platform',
      description: 'Build production-grade applications with a Postgres database, Authentication, instant APIs, Realtime, Functions, Storage and Vector embeddings.',
      primaryColor: '#3ECF8E',
      accentColor: '#1E293B',
      heroScreenshotPath: '',
      featureScreenshotPaths: [],
      heroScreenshotUrl: '',
    },
    storyboard: {
      hook: 'Stop wasting hours on manual tasks. Meet Supabase!',
      fullNarration: text,
      scenes: [
        { id: 1, durationSec: 6, caption: 'STOP WASTING HOURS! ⚡', narrationText: 'Meet Supabase', assetType: 'brand_card', motionEffect: 'zoom_in' },
        { id: 2, durationSec: 6, caption: 'TIRED OF COMPLEX BACKENDS?', narrationText: 'Slow setups', assetType: 'brand_card', motionEffect: 'tilt_3d' },
        { id: 3, durationSec: 6, caption: 'POSTGRES + AUTH + REALTIME APIS', narrationText: 'Instant database', assetType: 'brand_card', motionEffect: 'pan_down' },
        { id: 4, durationSec: 7, caption: 'START FREE → SUPABASE.COM', narrationText: 'Try today', assetType: 'brand_card', motionEffect: 'zoom_in' },
      ],
    },
    audioResult,
    aspectRatio: '9:16',
    outputDir: path.join(process.cwd(), 'diagnostic_output'),
  });

  console.log('\n✅ Render Result:', renderResult);
}

testFullPipeline().catch(console.error);
