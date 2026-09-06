import { videoRendererService } from '../../src/services/renderer.service';
import fs from 'fs';

describe('Unit Tests: Video Renderer Service', () => {
  it('should compute exact aspect ratio resolutions', () => {
    expect(videoRendererService.getResolutionForAspect('9:16')).toEqual({ width: 1080, height: 1920 });
    expect(videoRendererService.getResolutionForAspect('1:1')).toEqual({ width: 1080, height: 1080 });
    expect(videoRendererService.getResolutionForAspect('16:9')).toEqual({ width: 1920, height: 1080 });
  });

  it('should render MP4 file with manifest metadata', async () => {
    const result = await videoRendererService.renderVideo({
      jobId: 'test_job_101',
      branding: {
        url: 'https://example.com',
        title: 'Example',
        description: 'Example description',
        primaryColor: '#6366F1',
        accentColor: '#06B6D4',
        heroScreenshotPath: '/tmp/test_hero.png',
        featureScreenshotPaths: [],
      },
      storyboard: {
        hook: 'Check this out!',
        fullNarration: 'Check this out! It is amazing.',
        scenes: [
          {
            id: 1,
            durationSec: 4,
            caption: 'Hook 🚀',
            narrationText: 'Check this out!',
            assetType: 'screenshot_hero',
            motionEffect: 'tilt_3d',
          },
        ],
      },
      audioResult: {
        audioBuffer: Buffer.from('mp3'),
        durationSeconds: 30,
        timecodes: [],
      },
      aspectRatio: '9:16',
    });

    expect(fs.existsSync(result.outputVideoPath)).toBe(true);
    expect(result.resolution).toEqual({ width: 1080, height: 1920 });
    expect(result.durationSeconds).toBe(30);
  });
});
