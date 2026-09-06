import { scraperService } from '../../src/services/scraper.service';
import { createJobWithAtomicDeduction, getOrCreateUser, firestore, USERS_COLLECTION } from '../../src/services/firestore.service';

describe('Negative Scenario & Edge Case Tests', () => {
  const testZeroCreditUser = `test_broke_user_${Date.now()}`;

  beforeAll(async () => {
    await getOrCreateUser(testZeroCreditUser, `${testZeroCreditUser}@example.com`);
    // Exhaust all credits to 0
    await firestore.collection(USERS_COLLECTION).doc(testZeroCreditUser).update({
      creditsRemaining: 0,
    });
  });

  afterAll(async () => {
    try {
      await firestore.collection(USERS_COLLECTION).doc(testZeroCreditUser).delete();
      await scraperService.close();
    } catch {}
  });

  it('Negative: should reject job creation when credits are exhausted (0 balance)', async () => {
    await expect(
      createJobWithAtomicDeduction(testZeroCreditUser, {
        userId: testZeroCreditUser,
        inputUrl: 'https://example.com',
        idempotencyKey: `idem_broke_${Date.now()}`,
        aspectRatio: '9:16',
        stylePreset: 'saas_dark',
        voiceId: 'en-US-Neural2-F',
      })
    ).rejects.toThrow('INSUFFICIENT_CREDITS');
  });

  it('Negative: should cleanly catch malformed URLs without crashing', async () => {
    await expect(scraperService.scrapeWebsite('ftp://invalid-scheme.xyz')).rejects.toThrow();
  });
});
