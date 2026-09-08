import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Colors } from '../theme/colors';
import { ApiService, JobResponse, ReelSummary } from '../services/api';

interface Props {
  userId: string;
  onBack: () => void;
  onOpenReel: (job: JobResponse) => void;
}

function daysLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expired';
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 1) return 'Last day to save';
  return `${days} days left`;
}

export const MyReelsScreen: React.FC<Props> = ({ userId, onBack, onOpenReel }) => {
  const [reels, setReels] = useState<ReelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await ApiService.listReels(userId);
    setReels(list);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch(() => {
        if (!cancelled) Alert.alert('Could not load reels', 'Check your connection and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch {
      Alert.alert('Could not load reels', 'Check your connection and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const openReel = async (item: ReelSummary) => {
    if (item.expired) {
      Alert.alert('This reel expired', 'Save to Photos next time. Files stay in My reels for 7 days.');
      return;
    }
    setOpeningId(item.id);
    try {
      const job = await ApiService.getJob(item.id, userId);
      if (!job.outputVideoUrl) throw new Error('That reel is no longer available.');
      onOpenReel(job);
    } catch (err: any) {
      Alert.alert('Could not open reel', err.message || 'Try again in a moment.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My reels</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accentCyan} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={Colors.accentCyan} />
          }
          ListHeaderComponent={
            <Text style={styles.hint}>
              Finished reels stay here for 7 days. Open one to play, share, or save to Photos.
            </Text>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No finished reels yet. Generate one, then it shows up here.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, item.expired && styles.cardExpired]}
              onPress={() => void openReel(item)}
              disabled={openingId === item.id}
              activeOpacity={0.85}
            >
              <View style={styles.cardText}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.cardMeta, item.expired && styles.expiredMeta]}>
                  {item.aspectRatio || '9:16'}
                  {item.durationSeconds ? ` · ~${Math.round(item.durationSeconds)}s` : ''}
                  {` · ${daysLeft(item.expiresAt)}`}
                </Text>
              </View>
              {openingId === item.id ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.cardCta}>{item.expired ? 'Expired' : 'Open'}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
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
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 12 },
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardExpired: { opacity: 0.55 },
  cardText: { flex: 1, paddingRight: 12 },
  cardTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 4, fontWeight: '600' },
  expiredMeta: { color: Colors.textMuted },
  cardCta: { color: Colors.accentCyan, fontSize: 14, fontWeight: '800' },
});
