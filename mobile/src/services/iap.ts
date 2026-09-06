import { Alert, Linking } from 'react-native';
import { CREDIT_PACKS } from '../config/billing';

export type CreditPackId = (typeof CREDIT_PACKS)[number]['productId'];

/**
 * StoreKit hook. Products must exist in App Store Connect:
 * com.linkreel.credits.10 and com.linkreel.credits.25 (consumable).
 * Until those products are attached to a production/sandbox build, we refuse
 * to grant credits so the free tier cannot be bypassed.
 */
export const IapService = {
  async purchasePack(userId: string, productId: CreditPackId): Promise<{ creditsRemaining: number } | null> {
    const pack = CREDIT_PACKS.find((p) => p.productId === productId);
    if (!pack) return null;

    Alert.alert(
      'Apple In-App Purchase',
      `${pack.title} (${pack.displayPrice}) will charge your Apple ID once those products are live in App Store Connect. LinkReel will not add credits without a finished Apple transaction.`,
      [{ text: 'OK' }]
    );
    return null;
  },

  async restorePurchases(userId: string): Promise<void> {
    Alert.alert(
      'Restore Purchases',
      'Credit packs are one-time consumables. Used credits cannot be restored. Restore finishes a buy that was interrupted (Apple ID charged but credits not added). If nothing is pending, your balance stays the same.',
      [{ text: 'OK' }]
    );
  },

  async openLegal(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open link', url);
    }
  },
};
