import { scraperService } from '../../src/services/scraper.service';

describe('Unit Tests: Scraper Service', () => {
  afterAll(async () => {
    await scraperService.close();
  });

  it('should reject malformed URLs with INVALID_URL error', async () => {
    await expect(scraperService.scrapeWebsite('htp://invalid format:::')).rejects.toThrow();
  });

  it('should normalize URLs without protocol to https', async () => {
    // We test normalization logic by passing a domain
    const result = await scraperService.scrapeWebsite('example.com');
    expect(result.url).toBe('https://example.com');
    expect(result.title).toBeDefined();
    expect(result.heroScreenshotPath).toBeDefined();
  });
});
