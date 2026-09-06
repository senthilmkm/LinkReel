import { isPlayStoreEnabled } from '../config/env';
import { StoreListing, listingStory, lookupAppStoreListing, parseAppleId } from './app-store.service';

const LOOKUP_TIMEOUT_MS = 12_000;

export function parsePlayStoreId(raw: string): string | null {
  const t = (raw || '').trim();
  if (!t) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'play.google.com' && host !== 'market.android.com') return null;

  const id = url.searchParams.get('id') || '';
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(id)) return null;
  return id;
}

export function extractPlayListing(html: string, playId: string): StoreListing {
  const title =
    decodeHtml(matchContent(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || matchContent(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
      || matchContent(html, /<title>([^<]+)<\/title>/i)
      || playId)
      .replace(/\s*[-–—]\s*Apps on Google Play\s*$/i, '')
      .trim();

  const description = decodeHtml(
    matchContent(html, /<meta[^>]+itemprop=["']description["'][^>]+content=["']([^"']+)["']/i)
    || matchContent(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || matchContent(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || ''
  );

  const iconUrl = firstAllowed(
    matchContent(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  );

  const screenshotUrls = unique(
    [...html.matchAll(/https:\/\/play-lh\.googleusercontent\.com\/[^\s"'<>\\]+/g)]
      .map((m) => compactPlayImage(m[0]))
      .filter(Boolean)
  ).slice(0, 8);

  return {
    appleId: `play:${playId}`,
    name: title.slice(0, 80),
    description: description.slice(0, 4000),
    story: listingStory(description, title),
    storeUrl: `https://play.google.com/store/apps/details?id=${playId}`,
    iconUrl,
    screenshotUrls,
  };
}

export async function lookupStoreListing(storeUrl: string): Promise<StoreListing> {
  if (parseAppleId(storeUrl)) {
    return lookupAppStoreListing(storeUrl);
  }
  if (parsePlayStoreId(storeUrl)) {
    return lookupPlayStoreListing(storeUrl);
  }
  throw new Error(
    isPlayStoreEnabled()
      ? 'NOT_APP_STORE: Paste a public App Store or Play Store link.'
      : 'NOT_APP_STORE: Paste a public App Store link, like apps.apple.com/app/id…'
  );
}

export async function lookupPlayStoreListing(storeUrl: string): Promise<StoreListing> {
  if (!isPlayStoreEnabled()) {
    throw new Error('PLAY_STORE_DISABLED: Play Store links are turned off. Use an App Store link.');
  }

  const playId = parsePlayStoreId(storeUrl);
  if (!playId) {
    throw new Error('NOT_PLAY_STORE: Paste a public Play Store link, like play.google.com/store/apps/details?id=…');
  }

  const endpoint = `https://play.google.com/store/apps/details?id=${encodeURIComponent(playId)}&hl=en&gl=us`;
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error('STORE_LOOKUP_FAILED: Play listing is unavailable. Try again in a minute.');
  }

  const html = await res.text();
  const listing = extractPlayListing(html, playId);
  if (!listing.name || listing.screenshotUrls.length === 0) {
    throw new Error('STORE_NOT_FOUND: That Play Store listing has no screenshots we can read.');
  }
  return listing;
}

function matchContent(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ? m[1] : null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactPlayImage(raw: string): string {
  const cleaned = raw.replace(/=.+$/, '');
  return `${cleaned}=w1242-h2688`;
}

function firstAllowed(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

function unique(urls: string[]): string[] {
  return [...new Set(urls)];
}
