import {
  applyShotPicks,
  assignStoreShots,
  isAllowedStoreImageUrl,
  listingStory,
  lookupAppStoreListing,
  packListingClips,
  parseAppleId,
  formatStoreProof,
  formatRatingCount,
  thumbnailScreenshotUrl,
  upgradeScreenshotUrl,
  _clearListingCacheForTests,
} from '../../src/services/app-store.service';

describe('App Store listing helpers', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    _clearListingCacheForTests();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('parses Apple IDs from common App Store URLs', () => {
    expect(parseAppleId('https://apps.apple.com/us/app/orbit-auto-lap-tracker/id6780816083')).toBe('6780816083');
    expect(parseAppleId('https://apps.apple.com/app/id6780816083')).toBe('6780816083');
    expect(parseAppleId('https://apps.apple.com/us/app/id6780816083?uo=4')).toBe('6780816083');
    expect(parseAppleId('apps.apple.com/app/id6780816083')).toBe('6780816083');
  });

  it('rejects non-App Store links', () => {
    expect(parseAppleId('https://play.google.com/store/apps/details?id=com.foo')).toBeNull();
    expect(parseAppleId('https://senthilmkm.github.io/lap-counter/')).toBeNull();
    expect(parseAppleId('not a url')).toBeNull();
    expect(parseAppleId('')).toBeNull();
  });

  it('only allows store CDN screenshot hosts', () => {
    expect(isAllowedStoreImageUrl('https://is1-ssl.mzstatic.com/image/thumb/foo/1242x2688bb.jpg')).toBe(true);
    expect(isAllowedStoreImageUrl('https://play-lh.googleusercontent.com/abc=w1242-h2688')).toBe(true);
    expect(isAllowedStoreImageUrl('https://evil.example/shot.jpg')).toBe(false);
    expect(isAllowedStoreImageUrl('http://is1-ssl.mzstatic.com/image/thumb/foo/1242x2688bb.jpg')).toBe(false);
  });

  it('upgrades thumbnail screenshot URLs to a mid-size asset', () => {
    const small = 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/ab/cd/IMG.PNG/320x480bb.jpg';
    expect(upgradeScreenshotUrl(small)).toBe(
      'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/ab/cd/IMG.PNG/1242x2688bb.jpg'
    );
  });

  it('assigns store shots in scene order without calling AI', () => {
    const urls = [
      'https://is1-ssl.mzstatic.com/image/thumb/a/1242x2688bb.jpg',
      'https://is1-ssl.mzstatic.com/image/thumb/b/1242x2688bb.jpg',
      'https://is1-ssl.mzstatic.com/image/thumb/c/1242x2688bb.jpg',
    ];
    const assigned = assignStoreShots(urls);
    expect(assigned).toHaveLength(3);
    expect(assigned[0]).toEqual({ sceneId: 1, imageUrl: urls[0], imageIndex: 0 });
    expect(assigned[2].sceneId).toBe(3);
  });

  it('applies vision picks and fills gaps without reusing a shot', () => {
    const urls = [
      'https://is1-ssl.mzstatic.com/image/thumb/a/1242x2688bb.jpg',
      'https://is1-ssl.mzstatic.com/image/thumb/b/1242x2688bb.jpg',
      'https://is1-ssl.mzstatic.com/image/thumb/c/1242x2688bb.jpg',
      'https://is1-ssl.mzstatic.com/image/thumb/d/1242x2688bb.jpg',
    ];
    const assigned = applyShotPicks(urls, [
      { sceneId: 3, imageIndex: 2 },
      { sceneId: 1, imageIndex: 0 },
      { sceneId: 1, imageIndex: 3 },
      { sceneId: 9, imageIndex: 1 },
      { sceneId: 2, imageIndex: 99 },
    ]);
    expect(assigned.find((s) => s.sceneId === 1)?.imageIndex).toBe(0);
    expect(assigned.find((s) => s.sceneId === 3)?.imageIndex).toBe(2);
    expect(assigned.find((s) => s.sceneId === 2)?.imageIndex).toBe(1);
    expect(assigned.find((s) => s.sceneId === 4)?.imageIndex).toBe(3);
    expect(new Set(assigned.map((s) => s.imageIndex)).size).toBe(4);
  });

  it('builds a cheap 320px thumb URL for the vision pass', () => {
    const full = 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/ab/cd/IMG.PNG/1242x2688bb.jpg';
    expect(thumbnailScreenshotUrl(full)).toBe(
      'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/ab/cd/IMG.PNG/320x480bb.jpg'
    );
  });

  it('strips subscription legal text before the story is sent to Flash', () => {
    const story = listingStory(
      'Stop counting laps in your head. Pocket your phone.\n\n----------------------------------------------\nORBIT PRO SUBSCRIPTION INFORMATION\nUpgrade to Orbit Pro $4.99/mo.\nPrivacy Policy: https://example.com',
      'Orbit — Auto Lap Tracker'
    );
    expect(story).toMatch(/Stop counting laps/);
    expect(story).not.toMatch(/\$4\.99/);
    expect(story).not.toMatch(/Privacy Policy/);
    expect(story.length).toBeLessThan(200);
  });

  it('looks up a listing once and serves the second call from cache', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [{
          trackId: 6780816083,
          trackName: 'Orbit — Auto Lap Tracker',
          kind: 'software',
          description: 'Stop counting laps in your head. Orbit tracks walks and runs automatically.',
          trackViewUrl: 'https://apps.apple.com/us/app/orbit-auto-lap-tracker/id6780816083',
          screenshotUrls: [
            'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource/v4/x/IMG.PNG/320x480bb.jpg',
          ],
        }],
      }),
    });
    (global as any).fetch = fetchMock;

    const first = await lookupAppStoreListing('https://apps.apple.com/us/app/orbit-auto-lap-tracker/id6780816083');
    const second = await lookupAppStoreListing('https://apps.apple.com/app/id6780816083');

    expect(first.name).toBe('Orbit — Auto Lap Tracker');
    expect(first.screenshotUrls[0]).toContain('1242x2688');
    expect(second.appleId).toBe(first.appleId);
    expect(fetchMock).toHaveBeenCalled();
    const itunesCalls = fetchMock.mock.calls.filter((c: any[]) => String(c[0]).includes('lookup')).length;
    expect(itunesCalls).toBe(1);
  });

  it('keeps all iPhone screenshots for the picker, up to 10', async () => {
    const urls = Array.from({ length: 10 }, (_, i) =>
      `https://is1-ssl.mzstatic.com/image/thumb/s${i}/320x480bb.jpg`
    );
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [{
          trackId: 11111111,
          trackName: 'Ten Shots',
          kind: 'software',
          description: 'Lots of screens.',
          trackViewUrl: 'https://apps.apple.com/app/id11111111',
          screenshotUrls: urls,
        }],
      }),
    });

    const listing = await lookupAppStoreListing('https://apps.apple.com/app/id11111111');
    expect(listing.screenshotUrls).toHaveLength(10);
  });

  it('formats App Store proof and hides stars when Apple has no rating', () => {
    expect(formatRatingCount(1234)).toBe('1.2K');
    expect(formatStoreProof({ averageUserRating: 4.8, userRatingCount: 12000, priceLabel: 'Free' })).toEqual({
      ratingLine: '4.8 · 12K ratings',
      priceLine: 'Free',
      starCount: 5,
    });
    expect(formatStoreProof({ averageUserRating: 0, userRatingCount: 0, priceLabel: 'Free' }).ratingLine).toBeNull();
    expect(formatStoreProof({}).starCount).toBe(0);
  });

  it('packs leftover listing shots into the reel and leaves a skipped scene as a caption card', () => {
    const urls = Array.from({ length: 8 }, (_, i) =>
      `https://is1-ssl.mzstatic.com/image/thumb/${i}/1242x2688bb.jpg`
    );
    const packed = packListingClips(urls, [
      { sceneId: 1, imageUrl: urls[0] },
      { sceneId: 3, imageUrl: urls[2] },
      { sceneId: 4, imageUrl: urls[3] },
    ]);
    expect(packed.filter((c) => c.imageUrl).length).toBe(8);
    expect(packed.some((c) => c.sceneId === 2 && !c.imageUrl)).toBe(true);
    expect(new Set(packed.filter((c) => c.imageUrl).map((c) => c.imageUrl)).size).toBe(8);
  });
});
