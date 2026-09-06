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

  it('fallback storyboard asks for a product shot on scene 3', () => {
    const board = storyboardService.generateFallbackStoryboard(branding, 'saas_dark', 'You sit and watch the price all day.');
    expect(board.scenes).toHaveLength(4);
    expect(board.scenes[2].shotKind).toBe('product_shot');
    expect(board.scenes[0].shotKind).toBe('caption_card');
  });
});
