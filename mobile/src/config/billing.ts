import { getPricing } from '../services/pricing';

export function getFreeReelCredits(): number {
  return getPricing().free.credits;
}

export const FREE_REEL_CREDITS = 3;

export type CreditPackId = string;

export function getLegalUrls() {
  return getPricing().legal;
}
