import { assertSafeUploadPath } from '../../src/services/storage.service';
import { normalizeStoryboard } from '../../src/services/storyboard.service';
import { storyboardService } from '../../src/services/storyboard.service';

describe('Upload path safety', () => {
  it('accepts user upload object paths', () => {
    expect(assertSafeUploadPath('uploads/user_apple_tester_1/3-abc.jpg')).toBe(
      'uploads/user_apple_tester_1/3-abc.jpg'
    );
  });

  it('rejects path traversal and foreign prefixes', () => {
    expect(() => assertSafeUploadPath('../secret')).toThrow('INVALID_UPLOAD_PATH');
    expect(() => assertSafeUploadPath('videos/hack.mp4')).toThrow('INVALID_UPLOAD_PATH');
    expect(() => assertSafeUploadPath('uploads/../etc/passwd')).toThrow('INVALID_UPLOAD_PATH');
    expect(() => assertSafeUploadPath('')).toThrow('INVALID_UPLOAD_PATH');
  });
});

describe('Storyboard normalize + fallback shots', () => {
  const branding = {
    url: 'https://example.com',
    title: 'Example',
    description: 'desc',
    primaryColor: '#3DB8A0',
    accentColor: '#C6A75E',
    heroScreenshotPath: '',
    featureScreenshotPaths: [],
  };

  it('pads to 4 scenes and labels shot kinds', () => {
    const board = normalizeStoryboard({
      hook: 'Hook',
      fullNarration: 'Narration for the reel about the product.',
      scenes: [
        { id: 1, durationSec: 4, caption: 'HOOK', narrationText: 'hook', assetType: 'screenshot_hero', motionEffect: 'zoom_in' },
      ] as any,
    }, branding);

    expect(board.scenes).toHaveLength(4);
    expect(board.scenes[0].shotKind).toBe('caption_card');
    expect(board.scenes[2].shotKind).toBe('product_shot');
    expect(board.scenes[2].shotPrompt).toMatch(/Upload|screen/i);
  });

  it('keeps user-edited captions, voice lines, and voiceover on a locked script', () => {
    const board = normalizeStoryboard({
      hook: 'Meet Predict',
      fullNarration: 'You set the rules once. Then you walk away.',
      scenes: [
        { id: 1, durationSec: 4, caption: 'SET RULES ONCE', narrationText: 'You set the rules once.', assetType: 'screenshot_hero', motionEffect: 'zoom_in' },
        { id: 2, durationSec: 8, caption: 'STOP STARING', narrationText: 'Stop staring at the book.', assetType: 'screenshot_feature', motionEffect: 'zoom_in' },
        { id: 3, durationSec: 12, caption: 'WALK AWAY', narrationText: 'Predict fills when your cushion hits.', assetType: 'screenshot_hero', motionEffect: 'pan_down' },
        { id: 4, durationSec: 6, caption: 'TRY PREDICT', narrationText: 'Then you walk away.', assetType: 'brand_card', motionEffect: 'zoom_in' },
      ] as any,
    }, branding);

    expect(board.scenes[0].caption).toBe('SET RULES ONCE');
    expect(board.scenes[2].narrationText).toBe('Predict fills when your cushion hits.');
    expect(board.fullNarration).toBe('You set the rules once. Then you walk away.');
  });
});
