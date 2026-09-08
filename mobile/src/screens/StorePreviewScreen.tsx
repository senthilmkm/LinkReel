import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Colors } from '../theme/colors';
import { SceneShotRef, StoreListing, StoreSceneShot, Storyboard } from '../services/api';
import { creditBadgeText, getPricing } from '../services/pricing';
import { SceneCopyFields } from '../components/SceneCopyFields';
import { scriptReadyMessage, withSceneCopy } from '../utils/storyboardEdits';

interface Props {
  credits: number;
  generating?: boolean;
  productName?: string;
  listing: StoreListing;
  storyboard: Storyboard;
  assignedShots: StoreSceneShot[];
  captionStyleLabel?: string;
  musicLabel?: string;
  onBack: () => void;
  onOpenPaywall?: () => void;
  onScriptChange?: (storyboard: Storyboard) => void;
  onGenerate: (shots: SceneShotRef[], storyboard: Storyboard) => void;
}

export const StorePreviewScreen: React.FC<Props> = ({
  credits,
  generating = false,
  productName,
  listing,
  storyboard,
  assignedShots,
  captionStyleLabel,
  musicLabel,
  onBack,
  onOpenPaywall,
  onScriptChange,
  onGenerate,
}) => {
  const shots = listing.screenshotUrls || [];
  const initial = useMemo(() => {
    const map: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
    for (const shot of assignedShots) {
      map[shot.sceneId] = shot.imageIndex;
    }
    return map;
  }, [assignedShots]);

  const [board, setBoard] = useState(storyboard);
  const [picked, setPicked] = useState<Record<number, number | null>>(initial);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const updateScene = (sceneId: number, patch: { caption?: string; narrationText?: string }) => {
    const next = withSceneCopy(board, sceneId, patch);
    setBoard(next);
    onScriptChange?.(next);
  };

  const choose = (sceneId: number, imageIndex: number) => {
    setPicked((prev) => ({ ...prev, [sceneId]: imageIndex }));
    setPickerFor(null);
  };

  const skip = (sceneId: number) => {
    setPicked((prev) => ({ ...prev, [sceneId]: null }));
    setPickerFor(null);
  };

  const handleGenerate = () => {
    if (generating) return;
    const blocked = scriptReadyMessage(board);
    if (blocked) {
      Alert.alert('Fix the words first', blocked);
      return;
    }
    const sceneShots: SceneShotRef[] = [];
    for (const sceneId of [1, 2, 3, 4]) {
      const idx = picked[sceneId];
      if (idx === null || idx === undefined || !shots[idx]) continue;
      sceneShots.push({ sceneId, imageUrl: shots[idx] });
    }
    onGenerate(sceneShots, board);
  };

  const generateLabel = credits < 1
    ? 'Get credits to generate'
    : generating
      ? 'Starting…'
      : 'Generate my reel · 1 credit';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{productName || listing.name}</Text>
        <TouchableOpacity onPress={onOpenPaywall} disabled={!onOpenPaywall}>
          <Text style={styles.creditChip}>{creditBadgeText(credits, getPricing())}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          {listing.previewVideoUrls && listing.previewVideoUrls.length > 0 ? (
            <>
              This listing has an <Text style={styles.hintEm}>App Store preview</Text>. We cut it into the 4 scenes, then add leftover screenshots.
            </>
          ) : (
            'We matched a listing screen to each scene. Extra iPhone screens from the listing also play in the reel. Change or skip only if one is wrong.'
          )}
          {' Tap a caption or voice line to fix it — free until you generate.'}
          {captionStyleLabel ? ` Caption style: ${captionStyleLabel}.` : ''}
          {musicLabel ? ` Music: ${musicLabel}.` : ''}
        </Text>

        {board.scenes.map((scene) => {
          const idx = picked[scene.id];
          const imageUrl = idx !== null && idx !== undefined ? shots[idx] : undefined;
          const open = pickerFor === scene.id;
          return (
            <View key={scene.id} style={styles.card}>
              <Text style={styles.kicker}>Scene {scene.id}</Text>
              <SceneCopyFields
                compact
                caption={scene.caption}
                narration={scene.narrationText}
                onCaptionChange={(value) => updateScene(scene.id, { caption: value })}
                onNarrationChange={(value) => updateScene(scene.id, { narrationText: value })}
              />

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setPickerFor(open ? null : scene.id)}
                disabled={shots.length === 0}
              >
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.shot} resizeMode="contain" />
                ) : (
                  <View style={[styles.shot, styles.emptyShot]}>
                    <Text style={styles.emptyText}>Skipped — caption card</Text>
                  </View>
                )}
              </TouchableOpacity>

              {open && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs}>
                  {shots.map((uri, imageIndex) => (
                    <TouchableOpacity
                      key={`${scene.id}-${imageIndex}`}
                      onPress={() => choose(scene.id, imageIndex)}
                      style={[styles.thumbWrap, idx === imageIndex && styles.thumbActive]}
                    >
                      <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() => setPickerFor(open ? null : scene.id)}
                  disabled={shots.length === 0}
                >
                  <Text style={styles.smallBtnText}>{open ? 'Close' : 'Change screen'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallBtn} onPress={() => skip(scene.id)}>
                  <Text style={styles.smallBtnText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generate, generating && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating}
          activeOpacity={0.85}
        >
          <Text style={styles.generateText}>{generateLabel}</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgObsidian },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  creditChip: { color: Colors.accentCyan, fontSize: 12, fontWeight: '800', marginLeft: 8 },
  body: { paddingHorizontal: 20, paddingBottom: 20 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 16 },
  hintEm: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
    marginBottom: 12,
  },
  kicker: {
    color: Colors.accentAmber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  shot: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#0B1016',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  emptyShot: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
  thumbs: { marginTop: 10 },
  thumbWrap: {
    marginRight: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbActive: { borderColor: Colors.accentIndigo },
  thumb: { width: 64, height: 110, backgroundColor: '#0B1016' },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  smallBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  smallBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  footer: { paddingHorizontal: 20, paddingBottom: 20 },
  generate: {
    backgroundColor: Colors.accentIndigo,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  generateText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
});
