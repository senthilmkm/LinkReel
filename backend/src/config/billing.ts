import { getPricingSync } from './pricing';

export function getFreeReelCredits(): number {
  return getPricingSync().free.credits;
}

/** @deprecated Use getFreeReelCredits() — kept for tests that expect the shipped default. */
export const FREE_REEL_CREDITS = 3;

export function creditsForProduct(productId: string): number | null {
  const pack = getPricingSync().creditPacks.find((p) => p.productId === productId && p.enabled);
  if (!pack) return null;
  const n = Number(pack.credits);
  return Number.isInteger(n) && n > 0 && n <= 200 ? n : null;
}

/** Free users never get more than the pricing.json free allotment, even if creditsRemaining was inflated. */
export function spendableCredits(user: {
  creditsRemaining?: number;
  totalVideosCreated?: number;
  paidCreditsGranted?: number;
}): number {
  const paid = Number(user.paidCreditsGranted || 0);
  const stored = Math.max(0, Number(user.creditsRemaining || 0));
  if (paid > 0) return stored;
  const used = Number(user.totalVideosCreated || 0);
  const lifetimeLeft = Math.max(0, getFreeReelCredits() - used);
  return Math.min(lifetimeLeft, stored);
}
