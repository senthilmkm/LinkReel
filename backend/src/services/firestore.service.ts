import { Firestore, FieldValue, DocumentReference } from '@google-cloud/firestore';
import { ENV } from '../config/env';
import { getFreeReelCredits, creditsForProduct, spendableCredits } from '../config/billing';
import { VideoJobDocument, UserDocument, JobStatus, JobErrorCode } from '../types';

export const firestore = new Firestore({
  projectId: ENV.GCP_PROJECT_ID,
  ignoreUndefinedProperties: true,
});

export const USERS_COLLECTION = 'users';
export const JOBS_COLLECTION = 'video_jobs';
export const PURCHASES_COLLECTION = 'iap_purchases';
export const JOB_LOCKS_COLLECTION = 'job_idempotency';

function jobLockId(userId: string, idempotencyKey: string): string {
  return `${userId}_${idempotencyKey}`.replace(/\//g, '_').slice(0, 700);
}

async function clampUnpaidUser(
  userRef: DocumentReference,
  user: UserDocument
): Promise<UserDocument> {
  if (Number(user.paidCreditsGranted || 0) > 0) return user;
  const allowed = spendableCredits(user);
  if (user.creditsRemaining === allowed && user.plan === 'free') return user;
  await userRef.update({
    creditsRemaining: allowed,
    plan: 'free',
    paidCreditsGranted: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ...user, creditsRemaining: allowed, plan: 'free', paidCreditsGranted: 0 };
}

export async function getOrCreateUser(uid: string, email: string): Promise<UserDocument> {
  const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
  const doc = await userRef.get();

  if (doc.exists) {
    return clampUnpaidUser(userRef, doc.data() as UserDocument);
  }

  const newUser: UserDocument = {
    uid,
    email,
    plan: 'free',
    creditsRemaining: getFreeReelCredits(),
    totalVideosCreated: 0,
    paidCreditsGranted: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await userRef.set(newUser);
  return newUser;
}

export async function createJobWithAtomicDeduction(
  userId: string,
  jobData: Omit<VideoJobDocument, 'id' | 'status' | 'progress' | 'createdAt' | 'updatedAt'>
): Promise<{ jobId: string; isDuplicate: boolean }> {
  const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
  const jobRef = firestore.collection(JOBS_COLLECTION).doc();
  const lockRef = firestore.collection(JOB_LOCKS_COLLECTION).doc(jobLockId(userId, jobData.idempotencyKey));
  let result: { jobId: string; isDuplicate: boolean } = { jobId: jobRef.id, isDuplicate: false };

  await firestore.runTransaction(async (tx) => {
    const lockDoc = await tx.get(lockRef);
    const userDoc = await tx.get(userRef);

    if (lockDoc.exists) {
      result = { jobId: String(lockDoc.data()?.jobId || ''), isDuplicate: true };
      return;
    }
    if (!userDoc.exists) {
      throw new Error('USER_NOT_FOUND');
    }

    const userData = userDoc.data() as UserDocument;
    const available = spendableCredits(userData);
    if (available <= 0) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    tx.update(userRef, {
      creditsRemaining: available - 1,
      totalVideosCreated: (userData.totalVideosCreated || 0) + 1,
      plan: Number(userData.paidCreditsGranted || 0) > 0 ? userData.plan : 'free',
      updatedAt: FieldValue.serverTimestamp(),
    });

    const initialJob: VideoJobDocument = {
      ...jobData,
      id: jobRef.id,
      userId,
      status: 'queued',
      progress: 5,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    tx.set(jobRef, initialJob);
    tx.set(lockRef, {
      jobId: jobRef.id,
      userId,
      createdAt: FieldValue.serverTimestamp(),
    });
    result = { jobId: jobRef.id, isDuplicate: false };
  });

  return result;
}

export async function redeemStorePurchase(params: {
  userId: string;
  productId: string;
  transactionId: string;
}): Promise<{ creditsRemaining: number; creditsAdded: number; duplicate: boolean }> {
  const creditsAdded = creditsForProduct(params.productId);
  if (!creditsAdded) throw new Error('UNKNOWN_PRODUCT');
  const txId = params.transactionId.trim();
  if (txId.length < 8 || txId.length > 200 || !/^[A-Za-z0-9._-]+$/.test(txId)) {
    throw new Error('INVALID_TRANSACTION');
  }

  const purchaseRef = firestore.collection(PURCHASES_COLLECTION).doc(txId);
  const userRef = firestore.collection(USERS_COLLECTION).doc(params.userId);

  return firestore.runTransaction(async (tx) => {
    const existing = await tx.get(purchaseRef);
    const userDoc = await tx.get(userRef);
    if (existing.exists) {
      const creditsRemaining = (userDoc.data() as UserDocument | undefined)?.creditsRemaining || 0;
      return { creditsRemaining, creditsAdded: 0, duplicate: true };
    }

    if (!userDoc.exists) {
      tx.set(userRef, {
        uid: params.userId,
        email: `${params.userId}@linkreel.user`,
        plan: 'starter',
        creditsRemaining: getFreeReelCredits() + creditsAdded,
        totalVideosCreated: 0,
        paidCreditsGranted: creditsAdded,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      const current = userDoc.data() as UserDocument;
      const base = spendableCredits(current);
      tx.update(userRef, {
        creditsRemaining: base + creditsAdded,
        paidCreditsGranted: Number(current.paidCreditsGranted || 0) + creditsAdded,
        plan: 'starter',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(purchaseRef, {
      userId: params.userId,
      productId: params.productId,
      creditsAdded,
      createdAt: FieldValue.serverTimestamp(),
    });

    const after = userDoc.exists
      ? spendableCredits(userDoc.data() as UserDocument) + creditsAdded
      : getFreeReelCredits() + creditsAdded;
    return { creditsRemaining: after, creditsAdded, duplicate: false };
  });
}

export async function updateJobProgress(
  jobId: string,
  status: JobStatus,
  progress: number,
  additionalData: Partial<VideoJobDocument> = {}
) {
  const jobRef = firestore.collection(JOBS_COLLECTION).doc(jobId);
  await jobRef.update({
    status,
    progress,
    updatedAt: FieldValue.serverTimestamp(),
    ...additionalData,
    ...(status === 'completed' ? { completedAt: FieldValue.serverTimestamp() } : {}),
  });
}

export async function failJob(
  jobId: string,
  code: JobErrorCode,
  title: string,
  message: string,
  canRetry: boolean = true
) {
  const jobRef = firestore.collection(JOBS_COLLECTION).doc(jobId);
  await jobRef.update({
    status: 'failed',
    progress: 100,
    error: {
      code,
      title,
      message,
      canRetry,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });
}

const REEL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function timestampToMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const maybe = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
  if (typeof maybe.toMillis === 'function') return maybe.toMillis();
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  if (typeof maybe._seconds === 'number') return maybe._seconds * 1000;
  return 0;
}

export interface UserReelSummary {
  id: string;
  title: string;
  outputVideoUrl: string;
  durationSeconds?: number;
  aspectRatio?: string;
  voiceId?: string;
  createdAt: number;
  expiresAt: number;
  expired: boolean;
}

export async function listUserReels(userId: string): Promise<UserReelSummary[]> {
  const snap = await firestore.collection(JOBS_COLLECTION).where('userId', '==', userId).limit(80).get();
  const now = Date.now();
  const rows: UserReelSummary[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as VideoJobDocument;
    if (data.status !== 'completed' || !data.outputVideoUrl) continue;
    const created =
      timestampToMillis(data.completedAt) || timestampToMillis(data.updatedAt) || timestampToMillis(data.createdAt);
    const expiresAt = created + REEL_TTL_MS;
    const title = (data.branding?.title || data.productName || 'Your reel').trim() || 'Your reel';
    rows.push({
      id: doc.id,
      title: title.slice(0, 80),
      outputVideoUrl: data.outputVideoUrl,
      durationSeconds: data.durationSeconds,
      aspectRatio: data.aspectRatio,
      voiceId: data.voiceId,
      createdAt: created,
      expiresAt,
      expired: created > 0 ? now > expiresAt : false,
    });
  }
  rows.sort((a, b) => b.createdAt - a.createdAt);
  return rows.slice(0, 20);
}
