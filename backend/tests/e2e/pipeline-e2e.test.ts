import { pipelineCoordinator } from '../../src/services/pipeline.service';
import { createJobWithAtomicDeduction, getOrCreateUser, firestore, JOBS_COLLECTION, USERS_COLLECTION } from '../../src/services/firestore.service';
import { scraperService } from '../../src/services/scraper.service';
import { VideoJobDocument } from '../../src/types';

describe('End-to-End Pipeline Verification', () => {
  const e2eUserId = `e2e_user_${Date.now()}`;
  let e2eJobId: string;

  beforeAll(async () => {
    await getOrCreateUser(e2eUserId, `${e2eUserId}@example.com`);
  });

  afterAll(async () => {
    try {
      if (e2eJobId) {
        await firestore.collection(JOBS_COLLECTION).doc(e2eJobId).delete();
      }
      await firestore.collection(USERS_COLLECTION).doc(e2eUserId).delete();
      await scraperService.close();
    } catch {}
  });

  it('should execute full pipeline from live URL to completed 9:16 video', async () => {
    const idempotencyKey = `e2e_job_${Date.now()}`;
    const { jobId } = await createJobWithAtomicDeduction(e2eUserId, {
      userId: e2eUserId,
      inputUrl: 'https://example.com',
      idempotencyKey,
      aspectRatio: '9:16',
      stylePreset: 'saas_dark',
      voiceId: 'en-US-Neural2-F',
    });
    e2eJobId = jobId;

    const jobDoc: VideoJobDocument = {
      id: jobId,
      userId: e2eUserId,
      inputUrl: 'https://example.com',
      idempotencyKey,
      aspectRatio: '9:16',
      stylePreset: 'saas_dark',
      voiceId: 'en-US-Neural2-F',
      status: 'queued',
      progress: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Execute full pipeline
    await pipelineCoordinator.executeJob(jobDoc);

    // Verify Firestore document reached 100% and completed status
    const finalDoc = await firestore.collection(JOBS_COLLECTION).doc(jobId).get();
    expect(finalDoc.exists).toBe(true);

    const data = finalDoc.data() as VideoJobDocument;
    expect(data.status).toBe('completed');
    expect(data.progress).toBe(100);
    expect(data.outputVideoUrl).toBeDefined();
    expect(data.branding).toBeDefined();
    expect(data.script).toBeDefined();
    expect(data.durationSeconds).toBeGreaterThan(0);
  }, 90000);
});
