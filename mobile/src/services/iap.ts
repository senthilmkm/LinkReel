import { Alert, Linking } from 'react-native';
import { getPricing, visibleCreditPacks, visibleSubscriptions } from './pricing';

export type CreditPackId = string;

/**
 * StoreKit hook. Product IDs come from pricing.json and must exist in
 * App Store Connect before a charge. Until then we refuse to grant credits.
 */
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

    Alert.alert(
      pricing.paywall.buyUnavailableTitle,
      `${pack.title} (${pack.displayPrice}). ${pricing.paywall.buyUnavailableMessage}`,
      [{ text: 'OK' }]
    );
    return null;
  },

  async restorePurchases(_userId: string): Promise<void> {
    const pricing = getPricing();
    Alert.alert(pricing.paywall.restoreLabel, pricing.paywall.restoreMessage, [{ text: 'OK' }]);
  },

  async openLegal(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open link', url);
    }
  },
};
