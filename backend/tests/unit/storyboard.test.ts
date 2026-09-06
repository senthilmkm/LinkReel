import { storyboardService } from '../../src/services/storyboard.service';
import { ScrapedBranding } from '../../src/types';

describe('Unit Tests: Storyboard Engine', () => {
  const mockBranding: ScrapedBranding = {
    url: 'https://supabase.com',
    title: 'Supabase | The Open Source Firebase Alternative',
    description: 'Build production-grade apps in minutes with Postgres database and authentication.',
    primaryColor: '#3ECF8E',
    accentColor: '#06B6D4',
    heroScreenshotPath: '/tmp/hero.png',
    featureScreenshotPaths: [],
  };

  it('should generate a structured 4-scene storyboard with ~30s pacing', async () => {
    const storyboard = await storyboardService.generateStoryboard(mockBranding, 'saas_dark');

    expect(storyboard).toBeDefined();
    expect(storyboard.hook).toBeTruthy();
    expect(storyboard.fullNarration).toBeTruthy();
    expect(storyboard.scenes).toHaveLength(4);

    const totalDuration = storyboard.scenes.reduce((acc, sc) => acc + sc.durationSec, 0);
    expect(totalDuration).toBeGreaterThanOrEqual(24);
    expect(totalDuration).toBeLessThanOrEqual(32);
  });

  it('should generate valid kinetic captions for every scene', async () => {
    const storyboard = await storyboardService.generateStoryboard(mockBranding, 'ecommerce_punchy');
    for (const scene of storyboard.scenes) {
      expect(scene.caption).toBeTruthy();
      expect(scene.narrationText).toBeTruthy();
      expect(['screenshot_hero', 'screenshot_feature', 'brand_card']).toContain(scene.assetType);
      expect(['zoom_in', 'pan_down', 'tilt_3d']).toContain(scene.motionEffect);
      expect(['product_shot', 'caption_card']).toContain(scene.shotKind);
    }
  });

  it('should turn a narrative scene into hook / problem / solution copy', async () => {
    const story = `A trader sits in front of the app constantly and watches whether the price is coming to a favorable direction, then rushes to place the order. With this tool they set cushions and risk factors, then stay cool. The product places orders automatically.`;
    const storyboard = await storyboardService.generateStoryboard(mockBranding, 'saas_dark', story, false);

    expect(storyboard.scenes).toHaveLength(4);
    expect(storyboard.hook.toLowerCase()).toMatch(/watch|stuck|loop|hard way|candle|babysit/);
    expect(storyboard.scenes[1].narrationText.toLowerCase()).toMatch(/sit|watch|price|rush|stare|phone/);
    expect(storyboard.fullNarration.toLowerCase()).toMatch(/cushion|protect|phone|fill|candle/);
    expect(storyboard.scenes[3].narrationText).toContain('supabase.com');
  });

  it('keeps fallback store-listing copy short so TTS does not read the whole page', async () => {
    const listingDump = 'Stop counting laps in your head. Orbit tracks walks and runs automatically. Using sensors and GPS, it detects a loop so you can focus on pace. WHY USE ORBIT? Hands-Free Lap Counting. Indoor and Outdoor Precision. Live Interactive Maps. Voice Announcements. Smart Calorie Burn. Personal Records and Analytics. Privacy First.';
    const storyboard = await storyboardService.generateStoryboard(mockBranding, 'saas_dark', listingDump, false);
    expect(storyboard.scenes[2].narrationText.length).toBeLessThan(200);
    expect(storyboard.scenes[2].narrationText.toLowerCase()).toMatch(/orbit|lap|walk|run|sensor|gps/);
    expect(storyboard.scenes[2].narrationText).not.toMatch(/Privacy First/);
  });
});
