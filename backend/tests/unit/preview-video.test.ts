import {
  appStoreProductPageUrl,
  extractPreviewVideoUrls,
  isAllowedStoreVideoUrl,
  previewSliceTimes,
} from '../../src/services/preview-video.service';

describe('App Store preview videos', () => {
  it('allows Apple trailer hosts only', () => {
    expect(isAllowedStoreVideoUrl(
      'https://apptrailers.itunes.apple.com/itunes-assets/PurpleVideo221/v4/ee/86/c6/ee86c647-bb08-37d2-2b6b-304c18642f27/P1466534171_default.m3u8'
    )).toBe(true);
    expect(isAllowedStoreVideoUrl('https://evil.example/video.mp4')).toBe(false);
    expect(isAllowedStoreVideoUrl('https://apps.apple.com/us/app/id1')).toBe(false);
  });

  it('extracts trailer m3u8 URLs from listing HTML', () => {
    const html = `
      <html><script>{"x":"https://apptrailers.itunes.apple.com/itunes-assets/PurpleVideo221/v4/aa/bb/P1_default.m3u8"}</script></html>
    `;
    expect(extractPreviewVideoUrls(html)).toEqual([
      'https://apptrailers.itunes.apple.com/itunes-assets/PurpleVideo221/v4/aa/bb/P1_default.m3u8',
    ]);
  });

  it('builds the public product page URL from a country path', () => {
    expect(appStoreProductPageUrl('https://apps.apple.com/gb/app/orbit/id6780816083', '6780816083'))
      .toBe('https://apps.apple.com/gb/app/id6780816083');
  });

  it('splits a preview into four scene slices', () => {
    const a = previewSliceTimes(24, 0);
    const d = previewSliceTimes(24, 3);
    expect(a.startSec).toBe(0);
    expect(a.sliceSec).toBe(6);
    expect(d.startSec).toBe(18);
  });
});
