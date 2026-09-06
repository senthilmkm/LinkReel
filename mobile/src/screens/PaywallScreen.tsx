import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import { CREDIT_PACKS, FREE_REEL_CREDITS, LEGAL_URLS } from '../config/billing';
import { IapService } from '../services/iap';

interface Props {
  userId: string;
  credits: number;
  onClose: () => void;
  onCreditsChanged: (creditsRemaining: number) => void;
}

export const PaywallScreen: React.FC<Props> = ({ userId, credits, onClose, onCreditsChanged }) => {
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (productId: (typeof CREDIT_PACKS)[number]['productId']) => {
    setBusy(productId);
    try {
      const result = await IapService.purchasePack(userId, productId);
      if (result) onCreditsChanged(result.creditsRemaining);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      await IapService.restorePurchases(userId);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={Boolean(busy)}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>ONE-TIME CREDIT PACKS</Text>
        <Text style={styles.headline}>Continue making reels</Text>
        <Text style={styles.subheadline}>
          New installs get {FREE_REEL_CREDITS} free finished reels — not unlimited, and not 10. Planning the 4 scenes stays free forever. Each Generate uses 1 credit. This is not a subscription. Nothing auto-renews.
        </Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Credits left</Text>
          <Text style={styles.balanceValue}>{credits}</Text>
        </View>

        {CREDIT_PACKS.map((pack) => (
          <TouchableOpacity
            key={pack.productId}
            style={styles.packCard}
            onPress={() => void buy(pack.productId)}
            disabled={Boolean(busy)}
            activeOpacity={0.85}
          >
            <View style={styles.packText}>
              <Text style={styles.packTitle}>{pack.title}</Text>
              <Text style={styles.packSub}>{pack.subtitle}</Text>
            </View>
            {busy === pack.productId ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <Text style={styles.packPrice}>{pack.displayPrice}</Text>
            )}
          </TouchableOpacity>
        ))}

        <View style={styles.featuresCard}>
          {[
            '1 credit = 1 finished reel. Planning does not use a credit',
            `Free: ${FREE_REEL_CREDITS} generates on this iPhone. Then a pack is required`,
            '$4.99 buys 10 reels. $9.99 buys 25 reels. One-time, not a subscription',
            'Nora or Alex voiceover, captions, 1080×1920',
            'App Store screenshots and preview video when Apple has one',
            'Save to Photos. The in-app video link expires in 7 days',
          ].map((feat) => (
            <View key={feat} style={styles.featRow}>
              <Text style={styles.featMark}>•</Text>
              <Text style={styles.featText}>{feat}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.legalBody}>
          Payment is charged to your Apple ID at confirmation. Prices above are USD; Apple shows and charges the price for your storefront. These are consumable In-App Purchases, not auto-renewing subscriptions. Unused credits stay on this iPhone account. Used credits cannot be restored or refunded except as Apple requires. Restore Purchases only finishes a buy that was interrupted (you were charged but credits were not added).
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => void restore()} disabled={Boolean(busy)} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>{busy === 'restore' ? 'Restoring…' : 'Restore Purchases'}</Text>
        </TouchableOpacity>
        <View style={styles.linkRow}>
          <TouchableOpacity onPress={() => void IapService.openLegal(LEGAL_URLS.terms)}>
            <Text style={styles.link}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={() => void IapService.openLegal(LEGAL_URLS.privacy)}>
            <Text style={styles.link}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={() => void IapService.openLegal(LEGAL_URLS.appleEula)}>
            <Text style={styles.link}>Apple EULA</Text>
          </TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={() => void IapService.openLegal(LEGAL_URLS.github)}>
            <Text style={styles.link}>GitHub</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgObsidian },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { fontSize: 16, color: Colors.textSecondary },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  kicker: { color: Colors.accentAmber, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  headline: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  subheadline: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 20 },
  balanceCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  balanceValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  packCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packText: { flex: 1, paddingRight: 12 },
  packTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  packSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  packPrice: { color: Colors.accentCyan, fontSize: 18, fontWeight: '800' },
  featuresCard: {
    marginTop: 10,
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 10,
  },
  featRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featMark: { color: Colors.textSecondary, fontSize: 14 },
  featText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  legalBody: { marginTop: 16, fontSize: 12, lineHeight: 18, color: Colors.textMuted },
  footer: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 8 },
  restoreBtn: { alignItems: 'center', paddingVertical: 10 },
  restoreText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  link: { color: Colors.accentCyan, fontSize: 13, fontWeight: '600' },
  linkDot: { color: Colors.textMuted, fontSize: 13 },
});
