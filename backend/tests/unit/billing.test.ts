import { FREE_REEL_CREDITS, spendableCredits } from '../../src/config/billing';

describe('spendableCredits', () => {
  it('gives new free users 3 credits', () => {
    expect(spendableCredits({ creditsRemaining: 3, totalVideosCreated: 0, paidCreditsGranted: 0 })).toBe(3);
  });

  it('clamps inflated free balances to lifetime 3 minus used', () => {
    expect(spendableCredits({ creditsRemaining: 264, totalVideosCreated: 1, paidCreditsGranted: 0 })).toBe(
      FREE_REEL_CREDITS - 1
    );
  });

  it('blocks free users after 3 generates even if creditsRemaining is high', () => {
    expect(spendableCredits({ creditsRemaining: 100, totalVideosCreated: 3, paidCreditsGranted: 0 })).toBe(0);
  });

  it('trusts remaining credits only after a paid grant', () => {
    expect(
      spendableCredits({ creditsRemaining: 12, totalVideosCreated: 3, paidCreditsGranted: 10 })
    ).toBe(12);
  });

  it('does not grant credits back if the stored balance is already 0', () => {
    expect(spendableCredits({ creditsRemaining: 0, totalVideosCreated: 0, paidCreditsGranted: 0 })).toBe(0);
  });
});
