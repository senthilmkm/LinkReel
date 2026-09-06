import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../theme/colors';
import { ApiService, StoreListing, StoreSceneShot, Storyboard } from '../services/api';

export interface StoryDraft {
  source: 'store' | 'story';
  url: string;
  productName?: string;
  userDescription: string;
  enableWebScraping: boolean;
  aspectRatio: '9:16' | '1:1' | '16:9';
  stylePreset: 'saas_dark' | 'ecommerce_punchy' | 'minimal_editorial';
  voiceId: 'en-US-Neural2-F' | 'en-US-Neural2-D';
  storyboard: Storyboard;
  listing?: StoreListing;
  assignedShots?: StoreSceneShot[];
}

interface Props {
  credits: number;
  userId: string;
  onPlanned: (draft: StoryDraft) => void;
  onOpenPaywall: () => void;
}

export const DashboardScreen: React.FC<Props> = ({ credits, userId, onPlanned, onOpenPaywall }) => {
  const [mode, setMode] = useState<'store' | 'story'>('store');
  const [storeUrl, setStoreUrl] = useState('');
  const [url, setUrl] = useState('');
  const [productName, setProductName] = useState('');
  const [userDescription, setUserDescription] = useState('');
  const [enableWebScraping, setEnableWebScraping] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '16:9'>('9:16');
  const [voiceId, setVoiceId] = useState<'en-US-Neural2-F' | 'en-US-Neural2-D'>('en-US-Neural2-F');
  const [playStoreEnabled, setPlayStoreEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void ApiService.getFeatures().then((flags) => {
      if (!cancelled) setPlayStoreEnabled(flags.playStore);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sharedDraft = {
    aspectRatio,
    stylePreset: 'saas_dark' as const,
    voiceId,
  };

  const handleStorePlan = async () => {
    const link = storeUrl.trim();
    if (link.length < 12) {
      Alert.alert(
        playStoreEnabled ? 'Store link' : 'App Store link',
        playStoreEnabled
          ? 'Paste a public App Store or Play Store URL.'
          : 'Paste a public App Store URL, like apps.apple.com/app/id…'
      );
      return;
    }
    if (!playStoreEnabled && /play\.google\.com|market\.android\.com/i.test(link)) {
      Alert.alert('Play Store is off', 'Play Store links are hidden for now. Paste an App Store URL.');
      return;
    }

    setPlanning(true);
    try {
      const { storyboard, listing, assignedShots } = await ApiService.planFromStore({
        userId,
        storeUrl: link,
        stylePreset: 'saas_dark',
      });
      if (!storyboard?.scenes || storyboard.scenes.length < 4) {
        throw new Error('Could not lock 4 scenes. Try again.');
      }
      onPlanned({
        source: 'store',
        url: listing.storeUrl,
        productName: listing.name,
        userDescription: listing.story,
        enableWebScraping: false,
        storyboard,
        listing,
        assignedShots,
        ...sharedDraft,
      });
    } catch (err: any) {
      Alert.alert('Could not read listing', err.message || 'Check the App Store link and try again.');
    } finally {
      setPlanning(false);
    }
  };

  const handleStoryPlan = async () => {
    const story = userDescription.trim();
    if (story.length < 24) {
      Alert.alert('Story first', 'Write the before/after in at least a couple of sentences. That becomes the 4 scenes.');
      return;
    }

    setPlanning(true);
    try {
      const { storyboard } = await ApiService.planStoryboard({
        userId,
        userDescription: story,
        productName: productName.trim() || undefined,
        inputUrl: url.trim() || undefined,
        stylePreset: 'saas_dark',
      });
      if (!storyboard?.scenes || storyboard.scenes.length < 4) {
        throw new Error('Could not lock 4 scenes. Try again.');
      }
      onPlanned({
        source: 'story',
        url: url.trim(),
        productName: productName.trim() || undefined,
        userDescription: story,
        enableWebScraping: enableWebScraping && Boolean(url.trim()),
        storyboard,
        ...sharedDraft,
      });
    } catch (err: any) {
      Alert.alert('Could not write scenes', err.message || 'Check your connection and try again.');
    } finally {
      setPlanning(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logoTitle}>LinkReel <Text style={styles.sparkle}>✦</Text></Text>
          <Text style={styles.subtitle}>
            {mode === 'store'
              ? playStoreEnabled
                ? 'Store link → reel'
                : 'App Store link → reel'
              : 'Story → scenes → your screens'}
          </Text>
        </View>
        <TouchableOpacity style={styles.creditBadge} onPress={onOpenPaywall}>
          <Text style={styles.creditIcon}>⚡</Text>
          <Text style={styles.creditText}>{credits < 1 ? 'Get credits' : `${credits} Credits`}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {mode === 'store' ? (
          <>
            <Text style={styles.sectionLabel}>
              {playStoreEnabled ? 'APP STORE OR PLAY STORE LINK' : 'APP STORE LINK'}
            </Text>
            <View style={styles.inputCard}>
              <Text style={styles.urlIcon}>{playStoreEnabled ? '🔗' : ''}</Text>
              <TextInput
                style={styles.textInput}
                value={storeUrl}
                onChangeText={setStoreUrl}
                placeholder={
                  playStoreEnabled
                    ? 'apps.apple.com/app/id… or play.google.com/store/apps/details?id=…'
                    : 'https://apps.apple.com/app/id…'
                }
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {storeUrl.length > 0 && (
                <TouchableOpacity onPress={() => setStoreUrl('')}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.storyHint}>
              We read the listing and screenshots. Planning is free. Generate uses 1 credit.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>PRODUCT NAME (OPTIONAL)</Text>
            <View style={styles.inputCard}>
              <Text style={styles.urlIcon}>✦</Text>
              <TextInput
                style={styles.textInput}
                value={productName}
                onChangeText={setProductName}
                placeholder="Predict, your app, your site…"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <Text style={styles.sectionLabel}>WEBSITE URL (OPTIONAL)</Text>
            <View style={styles.inputCard}>
              <Text style={styles.urlIcon}>🌐</Text>
              <TextInput
                style={styles.textInput}
                value={url}
                onChangeText={setUrl}
                placeholder="https://example.com/product"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {url.length > 0 && (
                <TouchableOpacity onPress={() => setUrl('')}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {url.trim().length > 0 && (
              <View style={styles.toggleRowCard}>
                <View style={styles.toggleTextInfo}>
                  <Text style={styles.toggleTitle}>Also scrape the website</Text>
                  <Text style={styles.toggleSub}>
                    Off by default. Turn on only if you have no screenshots and want page colors.
                  </Text>
                </View>
                <Switch
                  value={enableWebScraping}
                  onValueChange={setEnableWebScraping}
                  trackColor={{ false: '#374151', true: Colors.accentIndigo }}
                  thumbColor={enableWebScraping ? Colors.accentCyan : '#9CA3AF'}
                />
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>STORY FOR THE REEL (REQUIRED)</Text>
              <Text style={[styles.charCountText, userDescription.length > 3500 && { color: Colors.accentAmber }]}>
                {userDescription.length} / 4000
              </Text>
            </View>
            <Text style={styles.storyHint}>
              We write 4 scenes from this. Next, you attach the matching screen — or skip and we use a caption card.
            </Text>
            <View style={styles.textAreaCard}>
              <TextInput
                style={styles.textAreaInput}
                value={userDescription}
                onChangeText={setUserDescription}
                placeholder="Example: You sit in front of the app all day watching the price, then rush to place the order. With this product you set your rules once, walk away, and it handles the rest."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={5}
                maxLength={4000}
                textAlignVertical="top"
              />
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>SIZE</Text>
        <View style={styles.aspectContainer}>
          {[
            { key: '9:16', title: '9:16', sub: 'Reels' },
            { key: '1:1', title: '1:1', sub: 'Square' },
            { key: '16:9', title: '16:9', sub: 'Landscape' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.aspectCard, aspectRatio === item.key && styles.activeCard]}
              onPress={() => setAspectRatio(item.key as '9:16' | '1:1' | '16:9')}
            >
              <Text style={[styles.aspectTitle, aspectRatio === item.key && styles.activeText]}>
                {item.title}
              </Text>
              <Text style={styles.aspectSub}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>VOICE</Text>
        <View style={styles.voiceContainer}>
          <TouchableOpacity
            style={[styles.voicePill, voiceId === 'en-US-Neural2-F' && styles.activeCard]}
            onPress={() => setVoiceId('en-US-Neural2-F')}
          >
            <Text style={[styles.voiceText, voiceId === 'en-US-Neural2-F' && styles.activeText]}>
              Nora · Female
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.voicePill, voiceId === 'en-US-Neural2-D' && styles.activeCard]}
            onPress={() => setVoiceId('en-US-Neural2-D')}
          >
            <Text style={[styles.voiceText, voiceId === 'en-US-Neural2-D' && styles.activeText]}>
              Alex · Male
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generateButton, planning && { opacity: 0.7 }]}
          onPress={() => void (mode === 'store' ? handleStorePlan() : handleStoryPlan())}
          activeOpacity={0.85}
          disabled={planning}
        >
          {planning ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <Text style={styles.generateButtonText}>
              {mode === 'store' ? 'Continue — build from listing' : 'Continue — see your 4 scenes'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.altLink}
          onPress={() => setMode(mode === 'store' ? 'story' : 'store')}
          disabled={planning}
        >
          <Text style={styles.altLinkText}>
            {mode === 'store'
              ? 'Or write the story yourself'
              : playStoreEnabled
                ? 'Or paste a store link'
                : 'Or paste an App Store link'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgObsidian,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  logoTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sparkle: {
    color: Colors.accentIndigo,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  creditIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  creditText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accentAmber,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 14,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceCard,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  urlIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  clearIcon: {
    fontSize: 16,
    color: Colors.textMuted,
    paddingHorizontal: 6,
  },
  toggleRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceCard,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginTop: 10,
  },
  toggleTextInfo: {
    flex: 1,
    marginRight: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  toggleSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 14,
  },
  textAreaCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
  },
  storyHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
    marginTop: 10,
  },
  textAreaInput: {
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 110,
    lineHeight: 20,
  },
  aspectContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aspectCard: {
    flex: 1,
    backgroundColor: Colors.surfaceCard,
    padding: 12,
    borderRadius: 14,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  aspectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  aspectSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  voiceContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  voicePill: {
    flex: 1,
    backgroundColor: Colors.surfaceCard,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
  },
  voiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeCard: {
    borderColor: Colors.accentIndigo,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  activeText: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  generateButton: {
    backgroundColor: Colors.accentIndigo,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: Colors.accentIndigo,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  altLink: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 4,
  },
  altLinkText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
