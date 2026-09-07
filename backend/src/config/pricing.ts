import fallback from './pricing.json';

export const PRICING_REMOTE_URL =
  process.env.PRICING_JSON_URL || 'https://senthilmkm.github.io/LinkReel/pricing.json';

const CACHE_MS = 2 * 60 * 1000;

export type BannerTone = 'info' | 'promo' | 'warning';

export interface PricingConfig {
  version: number;
  updatedAt: string;
  flags: {
    purchasesEnabled: boolean;
    creditPacksEnabled: boolean;
    subscriptionsEnabled: boolean;
    restorePurchasesEnabled: boolean;
    freeTierEnabled: boolean;
    showGithubLink: boolean;
    showAppleEula: boolean;
  };
  banner: {
    enabled: boolean;
    tone: BannerTone;
    title: string;
    message: string;
    cta: 'paywall' | 'none';
    ctaLabel: string;
    dismissible: boolean;
  };
  free: {
    id: string;
    enabled: boolean;
    credits: number;
    planningFree: boolean;
    title: string;
    subtitle: string;
    description: string;
    features: string[];
    limitations: string[];
  };
  creditPacks: Array<{
    id: string;
    enabled: boolean;
    productId: string;
    type: 'consumable';
    credits: number;
    displayPrice: string;
    priceUsd: number;
    title: string;
    subtitle: string;
    badge: string | null;
    highlighted: boolean;
    description: string;
    features: string[];
  }>;
  subscriptions: Array<{
    id: string;
    enabled: boolean;
    productId: string;
    type: 'auto_renewable';
    period: string;
    periodLabel: string;
    creditsPerPeriod: number;
    displayPrice: string;
    priceUsd: number;
    title: string;
    subtitle: string;
    badge: string | null;
    highlighted: boolean;
    description: string;
    legalNote: string;
    features: string[];
  }>;
  paywall: {
    kicker: string;
    headline: string;
    subheadline: string;
    balanceLabel: string;
    packsSectionTitle: string;
    subscriptionsSectionTitle: string;
    subscriptionsDisabledNote: string;
    features: string[];
    legalBody: string;
    restoreLabel: string;
    restoreBusyLabel: string;
    restoreMessage: string;
    buyUnavailableTitle: string;
    buyUnavailableMessage: string;
    purchasesOffTitle: string;
    purchasesOffMessage: string;
  };
  messages: {
    dashboardHint: string;
    creditBadgeLabel: string;
    creditBadgeEmpty: string;
    onboardingGenerate: string;
    insufficientCredits: string;
    iapNotLive: string;
  };
  legal: {
    termsUrl: string;
    privacyUrl: string;
    supportUrl: string;
    appleEulaUrl: string;
    githubUrl: string;
  };
}

export const FALLBACK_PRICING = fallback as PricingConfig;

let cached: PricingConfig = FALLBACK_PRICING;
let cachedAt = 0;
let inflight: Promise<PricingConfig> | null = null;

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asStr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v : fallback;
}

function asNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asStrList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const next = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return next.length ? next : fallback;
}

/** Accept a remote file only if the core shape is present. Bad JSON never opens a credit hole. */
export function sanitizePricing(raw: unknown, base: PricingConfig = FALLBACK_PRICING): PricingConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  if (!r.flags || !r.free || !r.paywall || !r.messages || !r.legal) return null;
  if (!Array.isArray(r.creditPacks) || !Array.isArray(r.subscriptions)) return null;

  const packs = r.creditPacks
    .map((p: any) => {
      const productId = asStr(p?.productId, '');
      const credits = asNum(p?.credits, 0, 1, 200);
      if (!productId.startsWith('com.linkreel.') || !Number.isInteger(credits)) return null;
      return {
        id: asStr(p.id, productId),
        enabled: asBool(p.enabled, false),
        productId,
        type: 'consumable' as const,
        credits,
        displayPrice: asStr(p.displayPrice, ''),
        priceUsd: asNum(p.priceUsd, 0, 0, 999),
        title: asStr(p.title, productId),
        subtitle: asStr(p.subtitle, ''),
        badge: typeof p.badge === 'string' && p.badge.trim() ? p.badge : null,
        highlighted: asBool(p.highlighted, false),
        description: asStr(p.description, ''),
        features: asStrList(p.features, []),
      };
    })
    .filter(Boolean) as PricingConfig['creditPacks'];

  if (packs.length === 0) return null;

  const toneRaw = asStr(r.banner?.tone, base.banner.tone);
  const tone: BannerTone = toneRaw === 'promo' || toneRaw === 'warning' ? toneRaw : 'info';

  return {
    version: asNum(r.version, base.version, 1, 99),
    updatedAt: asStr(r.updatedAt, base.updatedAt),
    flags: {
      purchasesEnabled: asBool(r.flags.purchasesEnabled, base.flags.purchasesEnabled),
      creditPacksEnabled: asBool(r.flags.creditPacksEnabled, base.flags.creditPacksEnabled),
      subscriptionsEnabled: asBool(r.flags.subscriptionsEnabled, false),
      restorePurchasesEnabled: asBool(r.flags.restorePurchasesEnabled, true),
      freeTierEnabled: asBool(r.flags.freeTierEnabled, true),
      showGithubLink: asBool(r.flags.showGithubLink, false),
      showAppleEula: asBool(r.flags.showAppleEula, true),
    },
    banner: {
      enabled: asBool(r.banner?.enabled, false),
      tone,
      title: asStr(r.banner?.title, ''),
      message: asStr(r.banner?.message, ''),
      cta: r.banner?.cta === 'paywall' ? 'paywall' : 'none',
      ctaLabel: asStr(r.banner?.ctaLabel, 'See packs'),
      dismissible: asBool(r.banner?.dismissible, false),
    },
    free: {
      id: 'free',
      enabled: asBool(r.free.enabled, true),
      credits: asNum(r.free.credits, base.free.credits, 0, 10),
      planningFree: asBool(r.free.planningFree, true),
      title: asStr(r.free.title, base.free.title),
      subtitle: asStr(r.free.subtitle, base.free.subtitle),
      description: asStr(r.free.description, base.free.description),
      features: asStrList(r.free.features, base.free.features),
      limitations: asStrList(r.free.limitations, base.free.limitations),
    },
    creditPacks: packs,
    subscriptions: (r.subscriptions as any[]).map((s) => ({
      id: asStr(s?.id, asStr(s?.productId, 'sub')),
      enabled: asBool(s?.enabled, false),
      productId: asStr(s?.productId, ''),
      type: 'auto_renewable' as const,
      period: asStr(s?.period, 'P1M'),
      periodLabel: asStr(s?.periodLabel, 'month'),
      creditsPerPeriod: asNum(s?.creditsPerPeriod, 0, 0, 2000),
      displayPrice: asStr(s?.displayPrice, ''),
      priceUsd: asNum(s?.priceUsd, 0, 0, 999),
      title: asStr(s?.title, 'Subscription'),
      subtitle: asStr(s?.subtitle, ''),
      badge: typeof s?.badge === 'string' && s.badge.trim() ? s.badge : null,
      highlighted: asBool(s?.highlighted, false),
      description: asStr(s?.description, ''),
      legalNote: asStr(s?.legalNote, ''),
      features: asStrList(s?.features, []),
    })),
    paywall: {
      kicker: asStr(r.paywall.kicker, base.paywall.kicker),
      headline: asStr(r.paywall.headline, base.paywall.headline),
      subheadline: asStr(r.paywall.subheadline, base.paywall.subheadline),
      balanceLabel: asStr(r.paywall.balanceLabel, base.paywall.balanceLabel),
      packsSectionTitle: asStr(r.paywall.packsSectionTitle, base.paywall.packsSectionTitle),
      subscriptionsSectionTitle: asStr(r.paywall.subscriptionsSectionTitle, base.paywall.subscriptionsSectionTitle),
      subscriptionsDisabledNote: asStr(r.paywall.subscriptionsDisabledNote, base.paywall.subscriptionsDisabledNote),
      features: asStrList(r.paywall.features, base.paywall.features),
      legalBody: asStr(r.paywall.legalBody, base.paywall.legalBody),
      restoreLabel: asStr(r.paywall.restoreLabel, base.paywall.restoreLabel),
      restoreBusyLabel: asStr(r.paywall.restoreBusyLabel, base.paywall.restoreBusyLabel),
      restoreMessage: asStr(r.paywall.restoreMessage, base.paywall.restoreMessage),
      buyUnavailableTitle: asStr(r.paywall.buyUnavailableTitle, base.paywall.buyUnavailableTitle),
      buyUnavailableMessage: asStr(r.paywall.buyUnavailableMessage, base.paywall.buyUnavailableMessage),
      purchasesOffTitle: asStr(r.paywall.purchasesOffTitle, base.paywall.purchasesOffTitle),
      purchasesOffMessage: asStr(r.paywall.purchasesOffMessage, base.paywall.purchasesOffMessage),
    },
    messages: {
      dashboardHint: asStr(r.messages.dashboardHint, base.messages.dashboardHint),
      creditBadgeLabel: asStr(r.messages.creditBadgeLabel, base.messages.creditBadgeLabel),
      creditBadgeEmpty: asStr(r.messages.creditBadgeEmpty, base.messages.creditBadgeEmpty),
      onboardingGenerate: asStr(r.messages.onboardingGenerate, base.messages.onboardingGenerate),
      insufficientCredits: asStr(r.messages.insufficientCredits, base.messages.insufficientCredits),
      iapNotLive: asStr(r.messages.iapNotLive, base.messages.iapNotLive),
    },
    legal: {
      termsUrl: asStr(r.legal.termsUrl, base.legal.termsUrl),
      privacyUrl: asStr(r.legal.privacyUrl, base.legal.privacyUrl),
      supportUrl: asStr(r.legal.supportUrl, base.legal.supportUrl),
      appleEulaUrl: asStr(r.legal.appleEulaUrl, base.legal.appleEulaUrl),
      githubUrl: asStr(r.legal.githubUrl, base.legal.githubUrl),
    },
  };
}

export function getPricingSync(): PricingConfig {
  return cached;
}

export async function refreshPricing(force = false): Promise<PricingConfig> {
  if (!force && Date.now() - cachedAt < CACHE_MS) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(`${PRICING_REMOTE_URL}?t=${Date.now()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`pricing ${res.status}`);
      const parsed = sanitizePricing(await res.json());
      if (!parsed) throw new Error('pricing invalid');
      cached = parsed;
      cachedAt = Date.now();
    } catch {
      cachedAt = Date.now();
    }
    return cached;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function visibleCreditPacks(pricing: PricingConfig = cached) {
  if (!pricing.flags.purchasesEnabled || !pricing.flags.creditPacksEnabled) return [];
  return pricing.creditPacks.filter((p) => p.enabled);
}

export function visibleSubscriptions(pricing: PricingConfig = cached) {
  if (!pricing.flags.purchasesEnabled || !pricing.flags.subscriptionsEnabled) return [];
  return pricing.subscriptions.filter((s) => s.enabled && s.productId.startsWith('com.linkreel.'));
}
