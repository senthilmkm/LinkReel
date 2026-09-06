import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { Colors } from '../theme/colors';
import { SceneShotRef, StoreListing, StoreSceneShot, Storyboard } from '../services/api';

interface Props {
  productName?: string;
  listing: StoreListing;
  storyboard: Storyboard;
  assignedShots: StoreSceneShot[];
  onBack: () => void;
  onGenerate: (shots: SceneShotRef[]) => void;
}

export const StorePreviewScreen: React.FC<Props> = ({
  productName,
  listing,
  storyboard,
  assignedShots,
  onBack,
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

  const [picked, setPicked] = useState<Record<number, number | null>>(initial);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const choose = (sceneId: number, imageIndex: number) => {
    setPicked((prev) => ({ ...prev, [sceneId]: imageIndex }));
    setPickerFor(null);
  };

  const skip = (sceneId: number) => {
    setPicked((prev) => ({ ...prev, [sceneId]: null }));
    setPickerFor(null);
  };

  const handleGenerate = () => {
    const sceneShots: SceneShotRef[] = [1, 2, 3, 4]
      .map((sceneId) => {
        const idx = picked[sceneId];
        if (idx === null || idx === undefined || !shots[idx]) return null;
        return { sceneId, imageUrl: shots[idx] };
      })
      .filter((s): s is SceneShotRef => Boolean(s));
    onGenerate(sceneShots);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{productName || listing.name}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>
          {listing.previewVideoUrls && listing.previewVideoUrls.length > 0 ? (
            <>
              This listing has an <Text style={styles.hintEm}>App Store preview</Text>. We cut it into the 4 scenes, then add leftover screenshots.
            </>
          ) : (
            'We matched a listing screen to each scene. Extra iPhone screens from the listing also play in the reel. Change or skip only if one is wrong.'
          )}
        </Text>

        {storyboard.scenes.map((scene) => {
          const idx = picked[scene.id];
          const imageUrl = idx !== null && idx !== undefined ? shots[idx] : undefined;
          const open = pickerFor === scene.id;
          return (
            <View key={scene.id} style={styles.card}>
              <Text style={styles.kicker}>Scene {scene.id}</Text>
              <Text style={styles.caption}>{scene.caption}</Text>
              <Text style={styles.narration} numberOfLines={3}>{scene.narrationText}</Text>

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
        <TouchableOpacity style={styles.generate} onPress={handleGenerate} activeOpacity={0.85}>
          <Text style={styles.generateText}>Generate my reel · 1 credit</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 6,
  },
  caption: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  narration: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 10 },
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
