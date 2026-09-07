import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import { IapService } from '../services/iap';
import {
  getPricing,
  refreshPricing,
  subscribePricing,
  visibleCreditPacks,
  visibleSubscriptions,
  type PricingConfig,
} from '../services/pricing';

interface Props {
  userId: string;
  credits: number;
  onClose: () => void;
  onCreditsChanged: (creditsRemaining: number) => void;
}

function bannerColors(tone: PricingConfig['banner']['tone']) {
  if (tone === 'warning') return { border: Colors.statusError, title: Colors.statusError };
  if (tone === 'promo') return { border: Colors.accentAmber, title: Colors.accentAmber };
  return { border: Colors.accentCyan, title: Colors.accentCyan };
}

export const PaywallScreen: React.FC<Props> = ({ userId, credits, onClose, onCreditsChanged }) => {
  const [pricing, setPricing] = useState(getPricing);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePricing(setPricing);
    void refreshPricing().then(setPricing);
    return unsub;
  }, []);

  const packs = visibleCreditPacks(pricing);
  const subs = visibleSubscriptions(pricing);
  const legal = pricing.legal;
  const supportUrl = legal.supportUrl || 'https://senthilmkm.github.io/LinkReel/support.html';
  const banner = pricing.banner;
  const bannerTone = bannerColors(banner.tone);

  const buy = async (productId: string) => {
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
        <Text style={styles.kicker}>{pricing.paywall.kicker}</Text>
        <Text style={styles.headline}>{pricing.paywall.headline}</Text>
        <Text style={styles.subheadline}>{pricing.paywall.subheadline}</Text>

        {banner.enabled && Boolean(banner.message) && (
          <View style={[styles.banner, { borderColor: bannerTone.border }]}>
            {banner.title ? <Text style={[styles.bannerTitle, { color: bannerTone.title }]}>{banner.title}</Text> : null}
            <Text style={styles.bannerBody}>{banner.message}</Text>
          </View>
        )}

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{pricing.paywall.balanceLabel}</Text>
          <Text style={styles.balanceValue}>{credits}</Text>
        </View>

        {!pricing.flags.purchasesEnabled && (
          <Text style={styles.offNote}>{pricing.paywall.purchasesOffMessage}</Text>
        )}

        {packs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{pricing.paywall.packsSectionTitle}</Text>
            {packs.map((pack) => (
              <TouchableOpacity
                key={pack.productId}
                style={[styles.packCard, pack.highlighted && styles.packHighlight]}
                onPress={() => void buy(pack.productId)}
                disabled={Boolean(busy) || !pricing.flags.purchasesEnabled}
                activeOpacity={0.85}
              >
                <View style={styles.packText}>
                  <View style={styles.packTitleRow}>
                    <Text style={styles.packTitle}>{pack.title}</Text>
                    {pack.badge ? <Text style={styles.badge}>{pack.badge}</Text> : null}
                  </View>
                  <Text style={styles.packSub}>{pack.subtitle}</Text>
                  {pack.description ? <Text style={styles.packDesc}>{pack.description}</Text> : null}
                </View>
                {busy === pack.productId ? (
                  <ActivityIndicator color={Colors.textPrimary} />
                ) : (
                  <Text style={styles.packPrice}>{pack.displayPrice}</Text>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        {subs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{pricing.paywall.subscriptionsSectionTitle}</Text>
            {subs.map((sub) => (
              <TouchableOpacity
                key={sub.productId}
                style={[styles.packCard, sub.highlighted && styles.packHighlight]}
                onPress={() => void buy(sub.productId)}
                disabled={Boolean(busy) || !pricing.flags.purchasesEnabled}
                activeOpacity={0.85}
              >
                <View style={styles.packText}>
                  <View style={styles.packTitleRow}>
                    <Text style={styles.packTitle}>{sub.title}</Text>
                    {sub.badge ? <Text style={styles.badge}>{sub.badge}</Text> : null}
                  </View>
                  <Text style={styles.packSub}>{sub.subtitle}</Text>
                  {sub.description ? <Text style={styles.packDesc}>{sub.description}</Text> : null}
                  {sub.legalNote ? <Text style={styles.packLegal}>{sub.legalNote}</Text> : null}
                </View>
                {busy === sub.productId ? (
                  <ActivityIndicator color={Colors.textPrimary} />
                ) : (
                  <Text style={styles.packPrice}>{sub.displayPrice}</Text>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        {pricing.flags.purchasesEnabled && !pricing.flags.subscriptionsEnabled && (
          <Text style={styles.offNote}>{pricing.paywall.subscriptionsDisabledNote}</Text>
        )}

        <View style={styles.featuresCard}>
          {pricing.paywall.features.map((feat) => (
            <View key={feat} style={styles.featRow}>
              <Text style={styles.featMark}>•</Text>
              <Text style={styles.featText}>{feat}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.legalBody}>{pricing.paywall.legalBody}</Text>
      </ScrollView>

      <View style={styles.footer}>
        {pricing.flags.restorePurchasesEnabled && (
          <TouchableOpacity onPress={() => void restore()} disabled={Boolean(busy)} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>
              {busy === 'restore' ? pricing.paywall.restoreBusyLabel : pricing.paywall.restoreLabel}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.linkRow}>
          <TouchableOpacity onPress={() => void IapService.openLegal(supportUrl)}>
            <Text style={styles.link}>Support</Text>
          </TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={() => void IapService.openLegal(legal.termsUrl)}>
            <Text style={styles.link}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={() => void IapService.openLegal(legal.privacyUrl)}>
            <Text style={styles.link}>Privacy Policy</Text>
          </TouchableOpacity>
          {pricing.flags.showAppleEula && (
            <>
              <Text style={styles.linkDot}>·</Text>
              <TouchableOpacity onPress={() => void IapService.openLegal(legal.appleEulaUrl)}>
                <Text style={styles.link}>Apple EULA</Text>
              </TouchableOpacity>
            </>
          )}
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
  subheadline: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  banner: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  bannerTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  bannerBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
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
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  offNote: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12 },
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
  packHighlight: { borderColor: Colors.accentIndigo },
  packText: { flex: 1, paddingRight: 12 },
  packTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  packTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  badge: {
    color: Colors.accentAmber,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  packSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  packDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  packLegal: { color: Colors.textMuted, fontSize: 11, marginTop: 6, lineHeight: 16 },
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
