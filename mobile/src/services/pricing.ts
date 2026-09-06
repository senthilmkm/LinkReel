import fallback from '../config/pricing.json';
import { Config } from '../config/config';

export const PRICING_PAGES_URL = 'https://senthilmkm.github.io/LinkReel/pricing.json';

export type PricingConfig = typeof fallback;

const FALLBACK = fallback as PricingConfig;

let current: PricingConfig = FALLBACK;
const listeners = new Set<(next: PricingConfig) => void>();

function looksLikePricing(raw: unknown): raw is PricingConfig {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return Boolean(
    r.flags &&
      r.free &&
      r.banner &&
      Array.isArray(r.creditPacks) &&
      Array.isArray(r.subscriptions) &&
      r.paywall &&
      r.messages &&
      r.legal
  );
}

export function getPricing(): PricingConfig {
  return current;
}

export function subscribePricing(fn: (next: PricingConfig) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function setPricing(next: PricingConfig) {
  current = next;
  listeners.forEach((fn) => fn(next));
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`pricing ${res.status}`);
  return res.json();
}

export async function refreshPricing(): Promise<PricingConfig> {
  const urls = [PRICING_PAGES_URL, `${Config.api.baseUrl}/api/v1/pricing`];
  for (const url of urls) {
    try {
      const raw = await fetchJson(url);
      if (looksLikePricing(raw) && Array.isArray(raw.creditPacks) && raw.creditPacks.length > 0) {
        setPricing(raw);
        return current;
      }
    } catch {
      // try the next source
    }
  }
  return current;
}

export function visibleCreditPacks(pricing: PricingConfig = current) {
  if (!pricing.flags.purchasesEnabled || !pricing.flags.creditPacksEnabled) return [];
  return pricing.creditPacks.filter((p) => p.enabled);
}

export function visibleSubscriptions(pricing: PricingConfig = current) {
  if (!pricing.flags.purchasesEnabled || !pricing.flags.subscriptionsEnabled) return [];
  return pricing.subscriptions.filter((s) => s.enabled);
}

export function creditBadgeText(credits: number, pricing: PricingConfig = current): string {
  if (credits < 1) return pricing.messages.creditBadgeEmpty;
  return pricing.messages.creditBadgeLabel.replace('{credits}', String(credits));
}
