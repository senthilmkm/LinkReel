export const FREE_REEL_CREDITS = 3;

export const CREDIT_PACKS: Record<string, number> = {
  'com.linkreel.credits.10': 10,
  'com.linkreel.credits.25': 25,
};

export function creditsForProduct(productId: string): number | null {
  const n = CREDIT_PACKS[productId];
  return Number.isInteger(n) ? n : null;
}

/** Free users never get more than 3 generates, even if creditsRemaining was inflated. */
export function spendableCredits(user: {
  creditsRemaining?: number;
  totalVideosCreated?: number;
  paidCreditsGranted?: number;
}): number {
  const paid = Number(user.paidCreditsGranted || 0);
  const stored = Math.max(0, Number(user.creditsRemaining || 0));
  if (paid > 0) return stored;
  const used = Number(user.totalVideosCreated || 0);
  const lifetimeLeft = Math.max(0, FREE_REEL_CREDITS - used);
  return Math.min(lifetimeLeft, stored);
}
