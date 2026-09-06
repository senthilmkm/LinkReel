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
  // 1. Check idempotency key for double-tap prevention
  const existingJobQuery = await firestore
    .collection(JOBS_COLLECTION)
    .where('userId', '==', userId)
    .where('idempotencyKey', '==', jobData.idempotencyKey)
    .limit(1)
    .get();

  if (!existingJobQuery.empty) {
    return { jobId: existingJobQuery.docs[0].id, isDuplicate: true };
  }

  const userRef = firestore.collection(USERS_COLLECTION).doc(userId);
  const jobRef = firestore.collection(JOBS_COLLECTION).doc();

  await firestore.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
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

    // Create job in queued status
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
  });

  return { jobId: jobRef.id, isDuplicate: false };
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
