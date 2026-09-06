import fallback from '../../src/config/pricing.json';
import { sanitizePricing, visibleCreditPacks, visibleSubscriptions, FALLBACK_PRICING } from '../../src/config/pricing';

describe('pricing.json', () => {
  it('ships a valid fallback with packs on and subscriptions off', () => {
    const parsed = sanitizePricing(fallback);
    expect(parsed).not.toBeNull();
    expect(parsed?.free.credits).toBe(3);
    expect(visibleCreditPacks(parsed!).map((p) => p.productId)).toEqual([
      'com.linkreel.credits.10',
      'com.linkreel.credits.25',
    ]);
    expect(visibleSubscriptions(parsed!)).toEqual([]);
    expect(FALLBACK_PRICING.flags.subscriptionsEnabled).toBe(false);
  });

  it('rejects junk so a bad remote file cannot open the paywall', () => {
    expect(sanitizePricing({ hello: true })).toBeNull();
    expect(sanitizePricing({ ...fallback, creditPacks: [] })).toBeNull();
  });

  it('can turn on a subscription only when both flags are true', () => {
    const parsed = sanitizePricing({
      ...fallback,
      flags: { ...fallback.flags, subscriptionsEnabled: true },
      subscriptions: fallback.subscriptions.map((s, i) => (i === 0 ? { ...s, enabled: true } : s)),
    });
    expect(visibleSubscriptions(parsed!).map((s) => s.id)).toEqual(['monthly']);
  });
});
