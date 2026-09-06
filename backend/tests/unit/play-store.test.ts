import { isPlayStoreEnabled } from '../../src/config/env';
import { thumbnailScreenshotUrl, _clearListingCacheForTests } from '../../src/services/app-store.service';
import {
  extractPlayListing,
  lookupStoreListing,
  parsePlayStoreId,
} from '../../src/services/play-store.service';

describe('Play Store helpers', () => {
  const originalFlag = process.env.ENABLE_PLAY_STORE;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.ENABLE_PLAY_STORE = originalFlag;
    global.fetch = originalFetch;
    _clearListingCacheForTests();
    jest.restoreAllMocks();
  });

  it('parses Play package IDs from public listing URLs', () => {
    expect(parsePlayStoreId('https://play.google.com/store/apps/details?id=com.google.android.apps.maps')).toBe(
      'com.google.android.apps.maps'
    );
    expect(parsePlayStoreId('https://play.google.com/store/apps/details?id=com.foo.bar&hl=en')).toBe('com.foo.bar');
    expect(parsePlayStoreId('play.google.com/store/apps/details?id=com.foo.bar')).toBe('com.foo.bar');
    expect(parsePlayStoreId('https://market.android.com/details?id=com.foo.bar')).toBe('com.foo.bar');
  });

  it('rejects non-Play links and junk package IDs', () => {
    expect(parsePlayStoreId('https://apps.apple.com/app/id6780816083')).toBeNull();
    expect(parsePlayStoreId('https://play.google.com/store/apps')).toBeNull();
    expect(parsePlayStoreId('https://play.google.com/store/apps/details?id=not-a-package')).toBeNull();
    expect(parsePlayStoreId('')).toBeNull();
  });

  it('reads the live ENABLE_PLAY_STORE flag', () => {
    process.env.ENABLE_PLAY_STORE = '';
    expect(isPlayStoreEnabled()).toBe(false);
    process.env.ENABLE_PLAY_STORE = 'true';
    expect(isPlayStoreEnabled()).toBe(true);
    process.env.ENABLE_PLAY_STORE = '1';
    expect(isPlayStoreEnabled()).toBe(true);
  });

  it('rejects Play links when the flag is off', async () => {
    process.env.ENABLE_PLAY_STORE = 'false';
    await expect(
      lookupStoreListing('https://play.google.com/store/apps/details?id=com.foo.bar')
    ).rejects.toThrow(/PLAY_STORE_DISABLED/);
  });

  it('still looks up App Store listings when Play is off', async () => {
    process.env.ENABLE_PLAY_STORE = '';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [{
          trackId: 6780816083,
          trackName: 'Orbit — Auto Lap Tracker',
          kind: 'software',
          description: 'Stop counting laps.',
          trackViewUrl: 'https://apps.apple.com/us/app/orbit-auto-lap-tracker/id6780816083',
          screenshotUrls: [
            'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource/v4/x/IMG.PNG/320x480bb.jpg',
          ],
        }],
      }),
    });
    (global as any).fetch = fetchMock;

    const listing = await lookupStoreListing('https://apps.apple.com/app/id6780816083');
    expect(listing.name).toBe('Orbit — Auto Lap Tracker');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('extracts title and screenshot URLs from Play HTML', () => {
    const html = `
      <html>
        <title>Google Maps - Apps on Google Play</title>
        <meta property="og:title" content="Google Maps">
        <meta itemprop="description" content="Navigate with live traffic.">
        <img src="https://play-lh.googleusercontent.com/shotA=w526-h296-rw">
        <img src="https://play-lh.googleusercontent.com/shotB=w1242-h2688-rw">
      </html>
    `;
    const listing = extractPlayListing(html, 'com.google.android.apps.maps');
    expect(listing.name).toBe('Google Maps');
    expect(listing.appleId).toBe('play:com.google.android.apps.maps');
    expect(listing.screenshotUrls).toHaveLength(2);
    expect(listing.screenshotUrls[0]).toBe('https://play-lh.googleusercontent.com/shotA=w1242-h2688');
    expect(listing.story).toMatch(/Navigate/);
  });

  it('shrinks Play screenshot URLs for the vision pass', () => {
    expect(thumbnailScreenshotUrl('https://play-lh.googleusercontent.com/shotA=w1242-h2688')).toBe(
      'https://play-lh.googleusercontent.com/shotA=w320-h480'
    );
  });
});
