import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors } from '../theme/colors';
import { ApiService, SceneShotRef, Storyboard } from '../services/api';

interface LocalShot {
  sceneId: number;
  objectPath: string;
  previewUri: string;
}

interface Props {
  userId: string;
  storyboard: Storyboard;
  productName?: string;
  onBack: () => void;
  onFinish: (shots: SceneShotRef[]) => void;
}

export const SceneShotsScreen: React.FC<Props> = ({ userId, storyboard, productName, onBack, onFinish }) => {
  const scenes = storyboard.scenes || [];
  const [index, setIndex] = useState(0);
  const [shots, setShots] = useState<Record<number, LocalShot>>({});
  const [skipped, setSkipped] = useState<Record<number, true>>({});
  const [confirmed, setConfirmed] = useState<Record<number, true>>({});
  const [busy, setBusy] = useState(false);

  const scene = scenes[index];
  const isLast = index >= scenes.length - 1;
  const needsShot = scene?.shotKind === 'product_shot';
  const attached = scene ? shots[scene.id] : undefined;
  const wasSkipped = scene ? Boolean(skipped[scene.id]) : false;
  const isConfirmed = scene ? Boolean(confirmed[scene.id]) : false;
  const needsConfirm = Boolean(attached) && !isConfirmed;

  const missingProduct = useMemo(() => {
    return scenes.filter((s) => s.shotKind === 'product_shot' && !shots[s.id]).length;
  }, [scenes, shots]);

  const goNext = () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    if (missingProduct > 0) {
      Alert.alert(
        'One product screen is missing',
        'You can still generate. That beat will use a caption card, so the reel will look less like your app.',
        [
          { text: 'Add a shot', style: 'cancel' },
          { text: 'Generate anyway', onPress: () => onFinish(Object.values(shots).map(({ sceneId, objectPath }) => ({ sceneId, objectPath }))) },
        ]
      );
      return;
    }
    onFinish(Object.values(shots).map(({ sceneId, objectPath }) => ({ sceneId, objectPath })));
  };

  const markSkip = () => {
    if (!scene) return;
    setSkipped((prev) => ({ ...prev, [scene.id]: true }));
    goNext();
  };

  const pickAndUpload = async () => {
    if (!scene || busy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photos needed', 'Allow photo access so you can attach the matching screen.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
        exif: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      if ((asset.width || 0) < 720 && (asset.height || 0) < 720) {
        Alert.alert('Too small', 'Use a clearer screenshot — at least 720px on one side.');
        return;
      }

      setBusy(true);
      const actions: ImageManipulator.Action[] = [];
      if ((asset.width || 0) > 1080) {
        actions.push({ resize: { width: 1080 } });
      } else if ((asset.height || 0) > 1920) {
        actions.push({ resize: { height: 1920 } });
      }
      const prepared = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const imageBase64 = await FileSystem.readAsStringAsync(prepared.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!imageBase64 || imageBase64.length < 100) {
        throw new Error('Could not read that photo. Try another screenshot.');
      }
      if (imageBase64.length > 10_000_000) {
        throw new Error('That photo is still too large. Use a screenshot, not a camera photo.');
      }

      const direct = await ApiService.uploadShot({
        userId,
        sceneId: scene.id,
        contentType: 'image/jpeg',
        imageBase64,
      });
      if (!direct.objectPath) throw new Error('Could not save that photo. Try again.');

      setShots((prev) => ({
        ...prev,
        [scene.id]: {
          sceneId: scene.id,
          objectPath: direct.objectPath,
          previewUri: `data:image/jpeg;base64,${imageBase64}`,
        },
      }));
      setConfirmed((prev) => {
        const next = { ...prev };
        delete next[scene.id];
        return next;
      });
      setSkipped((prev) => {
        const next = { ...prev };
        delete next[scene.id];
        return next;
      });
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not attach that photo.');
    } finally {
      setBusy(false);
    }
  };

  if (!scene) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.empty}>No scenes. Go back and write the story again.</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={index === 0 ? onBack : () => setIndex((i) => i - 1)}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.step}>Scene {index + 1} of {scenes.length}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>{needsShot ? 'NEEDS YOUR SCREEN' : 'CAPTION CARD — SHOT OPTIONAL'}</Text>
        <Text style={styles.caption}>{scene.caption}</Text>

        <View style={styles.previewWrap}>
          {attached ? (
            <Image
              source={{ uri: attached.previewUri }}
              style={styles.preview}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.preview, styles.previewEmpty]}>
              <Text style={styles.previewHint}>
                {wasSkipped ? 'Skipped — we will use a caption card.' : 'No photo yet'}
              </Text>
            </View>
          )}
          {needsConfirm ? (
            <Text style={styles.confirmAsk}>
              Look at the full image. Is this the correct shot for this scene?
            </Text>
          ) : attached && isConfirmed ? (
            <Text style={styles.attachedBadge}>Confirmed — this shot will appear in the reel</Text>
          ) : null}
        </View>

        <Text style={styles.narration}>{scene.narrationText}</Text>
        <Text style={styles.prompt}>{scene.shotPrompt}</Text>
        {productName ? <Text style={styles.product}>For {productName}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        {needsConfirm ? (
          <>
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={() => {
                if (!scene) return;
                setConfirmed((prev) => ({ ...prev, [scene.id]: true }));
                goNext();
              }}
              disabled={busy}
            >
              <Text style={styles.continueText}>Yes — this is the right shot</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => void pickAndUpload()}
              disabled={busy}
            >
              <Text style={styles.secondaryText}>No — choose a different photo</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
              onPress={() => void pickAndUpload()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.primaryText}>
                  {attached ? 'Replace photo' : 'Upload matching shot'}
                </Text>
              )}
            </TouchableOpacity>

            {attached && isConfirmed ? (
              <TouchableOpacity style={styles.continueBtn} onPress={goNext} disabled={busy}>
                <Text style={styles.continueText}>{isLast ? 'Generate my reel · 1 credit' : 'Continue'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.secondaryBtn} onPress={markSkip} disabled={busy}>
                <Text style={styles.secondaryText}>
                  {isLast
                    ? needsShot && !attached
                      ? 'Skip and generate · 1 credit'
                      : 'Skip this scene'
                    : 'Skip this scene'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
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
  step: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 16 },
  previewWrap: { marginTop: 8, marginBottom: 16 },
  attachedBadge: {
    marginTop: 8,
    color: Colors.statusSuccess,
    fontSize: 13,
    fontWeight: '700',
  },
  kicker: {
    color: Colors.accentAmber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  caption: { color: Colors.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 12 },
  narration: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  prompt: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  product: { color: Colors.textMuted, fontSize: 12, marginBottom: 14 },
  confirmAsk: {
    marginTop: 10,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  preview: {
    width: '100%',
    height: 420,
    borderRadius: 18,
    backgroundColor: '#0B1016',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  previewEmpty: { alignItems: 'center', justifyContent: 'center' },
  previewHint: { color: Colors.textMuted, fontSize: 13 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  footer: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  primaryBtn: {
    backgroundColor: Colors.accentIndigo,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  secondaryText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  continueBtn: {
    backgroundColor: Colors.statusSuccess,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  continueText: { color: '#04120C', fontSize: 16, fontWeight: '800' },
});
