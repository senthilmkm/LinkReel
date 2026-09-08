import { timestampToMillis } from '../../src/services/firestore.service';

describe('My reels timestamps', () => {
  it('reads Firestore-style seconds', () => {
    expect(timestampToMillis({ seconds: 1_700_000_000 })).toBe(1_700_000_000_000);
  });

  it('treats epoch millis as millis', () => {
    expect(timestampToMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('returns 0 for empty values', () => {
    expect(timestampToMillis(undefined)).toBe(0);
    expect(timestampToMillis('')).toBe(0);
  });
});
