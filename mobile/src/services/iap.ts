import { Alert, Linking, Platform } from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
} from 'expo-iap';
import { getPricing, visibleCreditPacks, visibleSubscriptions } from './pricing';
import { ApiService } from './api';

export type CreditPackId = string;

let storeReady: Promise<boolean> | null = null;

function packIds(): string[] {
  const pricing = getPricing();
  return [...visibleCreditPacks(pricing), ...visibleSubscriptions(pricing)].map((p) => p.productId);
}

async function connectStore(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  if (!storeReady) {
    storeReady = initConnection()
      .then(() => true)
      .catch(() => {
        storeReady = null;
        return false;
      });
  }
  return storeReady;
}

function signedJws(purchase: Purchase): string {
  const token = purchase.purchaseToken || '';
  if (!token || token.split('.').length !== 3) {
    throw new Error('Apple did not return a signed purchase. Try again.');
  }
  return token;
}

function isCancel(err: any): boolean {
  const code = String(err?.code || err?.errorCode || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code.includes('UserCancelled') ||
    code.includes('E_USER_CANCELLED') ||
    msg.includes('cancelled') ||
    msg.includes('canceled')
  );
}

function waitForPurchase(productId: string): Promise<Purchase> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      success.remove();
      fail.remove();
      reject(new Error('Apple did not finish that purchase. Try again.'));
    }, 120000);
    const success = purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== productId) return;
      clearTimeout(timer);
      success.remove();
      fail.remove();
      resolve(purchase);
    });
    const fail = purchaseErrorListener((error) => {
      clearTimeout(timer);
      success.remove();
      fail.remove();
      reject(error);
    });
  });
}

async function redeem(
  userId: string,
  purchase: Purchase
): Promise<{ creditsRemaining: number; creditsAdded: number }> {
  const productId = purchase.productId as 'com.linkreel.credits.10' | 'com.linkreel.credits.25';
  const signedTransaction = signedJws(purchase);
  const result = await ApiService.confirmPurchase({
    userId,
    productId,
    signedTransaction,
  });
  try {
    await finishTransaction({ purchase, isConsumable: true });
  } catch {
    // Credits are already on the account.
  }
  return result;
}

export const IapService = {
  async purchasePack(userId: string, productId: CreditPackId): Promise<{ creditsRemaining: number } | null> {
    const pricing = getPricing();
    if (!pricing.flags.purchasesEnabled) {
      Alert.alert(pricing.paywall.purchasesOffTitle, pricing.paywall.purchasesOffMessage, [{ text: 'OK' }]);
      return null;
    }

    const pack = [...visibleCreditPacks(pricing), ...visibleSubscriptions(pricing)].find(
      (p) => p.productId === productId
    );
    if (!pack) return null;

    if (Platform.OS !== 'ios') {
      Alert.alert('iPhone only', 'Credit packs are sold through the App Store on iPhone.');
      return null;
    }

    try {
      const ok = await connectStore();
      if (!ok) throw new Error('Could not reach the App Store. Check your connection.');
      await fetchProducts({ skus: packIds(), type: 'in-app' });
      const pending = waitForPurchase(productId);
      await requestPurchase({
        request: { apple: { sku: productId } },
        type: 'in-app',
      });
      const purchase = await pending;
      return await redeem(userId, purchase);
    } catch (err: any) {
      if (isCancel(err)) return null;
      Alert.alert('Purchase did not finish', err.message || 'Try again, or tap Restore Purchases.');
      return null;
    }
  },

  async syncUnfinished(userId: string): Promise<{ creditsRemaining: number } | null> {
    if (Platform.OS !== 'ios') return null;
    try {
      const ok = await connectStore();
      if (!ok) return null;
      const pending = await getAvailablePurchases();
      const list = Array.isArray(pending) ? pending : [];
      const ours = list.filter((p) => packIds().includes(p.productId));
      if (ours.length === 0) return null;
      let last = 0;
      for (const purchase of ours) {
        last = (await redeem(userId, purchase)).creditsRemaining;
      }
      return { creditsRemaining: last };
    } catch {
      return null;
    }
  },

  async restorePurchases(userId: string): Promise<{ creditsRemaining: number } | null> {
    const pricing = getPricing();
    if (Platform.OS !== 'ios') {
      Alert.alert(pricing.paywall.restoreLabel, pricing.paywall.restoreMessage, [{ text: 'OK' }]);
      return null;
    }
    try {
      const ok = await connectStore();
      if (!ok) throw new Error('Could not reach the App Store.');
      const pending = await getAvailablePurchases();
      const list = Array.isArray(pending) ? pending : [];
      const ours = list.filter((p) => packIds().includes(p.productId));
      if (ours.length === 0) {
        Alert.alert(pricing.paywall.restoreLabel, pricing.paywall.restoreMessage, [{ text: 'OK' }]);
        return null;
      }
      let last = 0;
      let added = 0;
      for (const purchase of ours) {
        const result = await redeem(userId, purchase);
        last = result.creditsRemaining;
        added += result.creditsAdded || 0;
      }
      Alert.alert(
        added > 0 ? 'Credits added' : 'Already restored',
        added > 0 ? `Your balance is now ${last}.` : 'No new credits. Used packs cannot be restored.'
      );
      return { creditsRemaining: last };
    } catch (err: any) {
      Alert.alert('Restore failed', err.message || 'Try again in a moment.');
      return null;
    }
  },

  async openLegal(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open link', url);
    }
  },
};
