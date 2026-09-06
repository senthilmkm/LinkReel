import {
  getOrCreateUser,
  createJobWithAtomicDeduction,
  firestore,
  USERS_COLLECTION,
  JOBS_COLLECTION,
} from '../../src/services/firestore.service';

describe('Integration Tests: Firestore Concurrency & Deductions', () => {
  const testUserId = `test_user_${Date.now()}`;

  beforeAll(async () => {
    await getOrCreateUser(testUserId, `${testUserId}@example.com`);
  });

  afterAll(async () => {
    // Cleanup test user and test jobs
    try {
      await firestore.collection(USERS_COLLECTION).doc(testUserId).delete();
    } catch {}
  });

  it('should create user with 3 starting credits', async () => {
    const user = await getOrCreateUser(testUserId, `${testUserId}@example.com`);
    expect(user.creditsRemaining).toBe(3);
  });

  it('should deduct exactly 1 credit atomically on job creation', async () => {
    const idempotencyKey = `idem_${Date.now()}_1`;
    const res = await createJobWithAtomicDeduction(testUserId, {
      userId: testUserId,
      inputUrl: 'https://example.com',
      idempotencyKey,
      aspectRatio: '9:16',
      stylePreset: 'saas_dark',
      voiceId: 'en-US-Neural2-F',
    });

    expect(res.jobId).toBeDefined();
    expect(res.isDuplicate).toBe(false);

    const userDoc = await firestore.collection(USERS_COLLECTION).doc(testUserId).get();
    expect(userDoc.data()?.creditsRemaining).toBe(2);
  });

  it('should return identical jobId without extra deduction on double-submission (Idempotency)', async () => {
    const idempotencyKey = `idem_duplicate_test_${Date.now()}`;

    // First attempt
    const res1 = await createJobWithAtomicDeduction(testUserId, {
      userId: testUserId,
      inputUrl: 'https://example.com',
      idempotencyKey,
      aspectRatio: '9:16',
      stylePreset: 'saas_dark',
      voiceId: 'en-US-Neural2-F',
    });

    // Rapid second attempt with same idempotency key
    const res2 = await createJobWithAtomicDeduction(testUserId, {
      userId: testUserId,
      inputUrl: 'https://example.com',
      idempotencyKey,
      aspectRatio: '9:16',
      stylePreset: 'saas_dark',
      voiceId: 'en-US-Neural2-F',
    });

    expect(res2.jobId).toBe(res1.jobId);
    expect(res2.isDuplicate).toBe(true);

    // Credits should have only been deducted once
    const userDoc = await firestore.collection(USERS_COLLECTION).doc(testUserId).get();
    expect(userDoc.data()?.creditsRemaining).toBe(1);
  });
});
