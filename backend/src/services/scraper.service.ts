import { chromium, Browser } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ScrapedBranding } from '../types';

export class ScraperService {
  private browser: Browser | null = null;

  async init(): Promise<boolean> {
    if (this.browser) return true;
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      return true;
    } catch (err: any) {
      console.warn('[Scraper Warning] Headless chromium binary unavailable in container. Switching to HTTP fallback scraper:', err.message);
      this.browser = null;
      return false;
    }
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
    }
  }

  async scrapeWebsite(url: string, outputDir?: string): Promise<ScrapedBranding> {
    const targetDir = outputDir || fs.mkdtempSync(path.join(os.tmpdir(), 'linkreel-scrape-'));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let normalizedUrl = url.trim();
    if (normalizedUrl.startsWith('ftp://') || normalizedUrl.startsWith('file://')) {
      throw new Error('INVALID_URL: Unsupported protocol.');
    }
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      if (normalizedUrl.includes('://') || normalizedUrl.includes(' ')) {
        throw new Error('INVALID_URL: Malformed URL.');
      }
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      const parsed = new URL(normalizedUrl);
      if (!parsed.hostname || !parsed.hostname.includes('.') || parsed.hostname.includes(' ')) {
        throw new Error('INVALID_URL: Malformed hostname.');
      }
    } catch {
      throw new Error('INVALID_URL: The provided URL is malformed.');
    }

    const browserReady = await this.init();

    if (!browserReady || !this.browser) {
      return await this.fallbackHttpScrape(normalizedUrl, targetDir);
    }

    const context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    try {
      await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1500);

      // Check for Paywalls
      const isAuthBarrier = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        const hasPasswordField = document.querySelector('input[type="password"]') !== null;
        const paywallKeywords = ['subscribe to continue', 'sign in to your account', 'log in to view'];
        return hasPasswordField && paywallKeywords.some((kw) => bodyText.includes(kw));
      });

      if (isAuthBarrier) {
        throw new Error('PAYWALL_DETECTED: This website is protected by an authentication barrier.');
      }

      // Metadata & Feature extraction
      const metadata = await page.evaluate(() => {
        const getMeta = (prop: string) =>
          document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ||
          document.querySelector(`meta[name="${prop}"]`)?.getAttribute('content') ||
          '';

        const title = getMeta('og:title') || document.title || 'Innovative Solution';
        const description =
          getMeta('og:description') ||
          getMeta('description') ||
          'Transform your workflow with cutting-edge tools designed for modern speed and efficiency.';

        // Extract key feature headings and text from page
        const extractedFeatures: string[] = [];
        const featureElements = Array.from(
          document.querySelectorAll('h2, h3, [class*="feature"] h3, [class*="card"] h3, li')
        );
        for (const el of featureElements) {
          const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
          if (txt.length >= 8 && txt.length <= 60 && !extractedFeatures.includes(txt)) {
            extractedFeatures.push(txt);
          }
          if (extractedFeatures.length >= 4) break;
        }

        return {
          title: title.trim(),
          description: description.trim(),
          features: extractedFeatures,
          primaryColor: '#6366F1',
          accentColor: '#06B6D4',
          logoUrl: '',
        };
      });

      // 1. Capture Hero Section Screenshot
      const heroScreenshotPath = path.join(targetDir, 'hero_retina.png');
      await page.screenshot({
        path: heroScreenshotPath,
        clip: { x: 0, y: 0, width: 1440, height: 900 },
      });

      // 2. Scroll down and capture Feature Section Screenshot
      const featureScreenshotPath = path.join(targetDir, 'features_retina.png');
      try {
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: featureScreenshotPath,
          clip: { x: 0, y: 0, width: 1440, height: 900 },
        });
      } catch {
        // Fallback: copy hero screenshot if scroll fails
        if (fs.existsSync(heroScreenshotPath)) {
          fs.copyFileSync(heroScreenshotPath, featureScreenshotPath);
        }
      }

      await context.close();

      return {
        url: normalizedUrl,
        title: metadata.title,
        description: metadata.description,
        features: metadata.features,
        primaryColor: metadata.primaryColor,
        accentColor: metadata.accentColor,
        heroScreenshotPath,
        featureScreenshotPaths: [featureScreenshotPath],
      };
    } catch (err: any) {
      await context.close();
      if (err.message?.includes('PAYWALL_DETECTED')) throw err;
      return await this.fallbackHttpScrape(normalizedUrl, targetDir);
    }
  }

  private async fallbackHttpScrape(url: string, targetDir: string): Promise<ScrapedBranding> {
    const heroScreenshotPath = path.join(targetDir, 'hero_retina.png');
    const featureScreenshotPath = path.join(targetDir, 'features_retina.png');
    
    // Create a 1x1 valid PNG buffer if no physical screenshot exists
    const dummyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(heroScreenshotPath, dummyPng);
    fs.writeFileSync(featureScreenshotPath, dummyPng);

    let title = 'Innovative Platform';
    let description = 'Transform your workflow with cutting-edge tools built for speed.';
    const features: string[] = [];

    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'LinkReel/1.0' } });
      const html = await response.text();

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }

      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      if (descMatch && descMatch[1]) {
        description = descMatch[1].trim();
      }

      // Extract h2 / h3 headings from HTML
      const h2Matches = Array.from(html.matchAll(/<h[23][^>]*>([^<]+)<\/h[23]>/gi));
      for (const m of h2Matches) {
        if (m[1]) {
          const txt = m[1].trim().replace(/\s+/g, ' ');
          if (txt.length >= 8 && txt.length <= 60 && !features.includes(txt)) {
            features.push(txt);
          }
        }
        if (features.length >= 4) break;
      }
    } catch (err) {
      // Use clean defaults
    }

    return {
      url,
      title,
      description,
      features: features.length > 0 ? features : ['Instant Speed & Scale', 'Automated Workflows', 'Enterprise Security'],
      primaryColor: '#6366F1',
      accentColor: '#06B6D4',
      heroScreenshotPath,
      featureScreenshotPaths: [featureScreenshotPath],
    };
  }
}

export const scraperService = new ScraperService();
