import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Colors } from '../theme/colors';
import { JobResponse } from '../services/api';
import { MediaService } from '../services/media';

const { width } = Dimensions.get('window');

interface Props {
  job: JobResponse;
  onBack: () => void;
}

function voiceLabel(voiceId?: string): string {
  if (voiceId === 'en-US-Neural2-D') return 'Alex';
  return 'Nora';
}

function reelTitle(job: JobResponse): string {
  const brand = job.branding?.title?.trim();
  if (brand) return brand;
  const raw = job.inputUrl || '';
  if (raw && !raw.includes('linkreel.app')) {
    return raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
  return 'Your reel';
}

export const VideoStudioScreen: React.FC<Props> = ({ job, onBack }) => {
  const [isSaved, setIsSaved] = useState(false);
  const videoUrl = job.outputVideoUrl;
  const duration = job.durationSeconds || 30;
  const aspect = job.aspectRatio || '9:16';
  const frameAspect = aspect === '16:9' ? 16 / 9 : aspect === '1:1' ? 1 : 9 / 16;
  const title = reelTitle(job);

  const videoPlayer = useVideoPlayer(videoUrl || '', (player) => {
    player.loop = true;
    if (videoUrl) player.play();
  });

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  const handleSaveToPhotos = async () => {
    if (!videoUrl) {
      Alert.alert('Not ready', 'This reel is not available to save.');
      return;
    }
    const success = await MediaService.saveToCameraRoll(videoUrl);
    if (success) {
      setIsSaved(true);
      Alert.alert(
        'Saved',
        `${title} is in Photos. Keep that copy — the in-app link expires in 7 days.`
      );
    }
  };

  const handleShare = () => {
    if (!videoUrl) {
      Alert.alert('Not ready', 'This reel is not available to share.');
      return;
    }
    MediaService.shareVideo(videoUrl, `LinkReel: ${title}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.playerContainer}>
          {videoUrl ? (
            <View style={[styles.videoFrame, { aspectRatio: frameAspect }]}>
              <VideoView
                style={StyleSheet.absoluteFill}
                player={videoPlayer}
                nativeControls
                contentFit="contain"
              />
            </View>
          ) : (
            <View style={[styles.videoFrame, styles.emptyFrame, { aspectRatio: frameAspect }]}>
              <Text style={styles.emptyText}>Video is not ready yet.</Text>
            </View>
          )}
          <Text style={styles.meta}>
            {aspect} · ~{duration}s · {voiceLabel(job.voiceId)}
          </Text>
        </View>

        <View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.saveButton, isSaved && styles.savedButton]}
              onPress={() => void handleSaveToPhotos()}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>
                {isSaved ? 'Saved to Photos' : 'Save to Photos'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.85}>
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.expiryNote}>
            The share link expires in 7 days. Save to Photos to keep your reel.
          </Text>
        </View>
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
    paddingTop: 10,
    paddingBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.accentIndigo,
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  playerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoFrame: {
    width: width * 0.82,
    maxHeight: '86%',
    backgroundColor: '#0F131D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  emptyFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  meta: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  expiryNote: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  savedButton: {
    borderColor: Colors.statusSuccess,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  shareButton: {
    flex: 1,
    backgroundColor: Colors.accentIndigo,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
