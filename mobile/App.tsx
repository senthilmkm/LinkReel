import React, { useState, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Alert, ActivityIndicator } from 'react-native';
import { registerRootComponent } from 'expo';
import { Colors } from './src/theme/colors';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DashboardScreen, StoryDraft } from './src/screens/DashboardScreen';
import { SceneShotsScreen } from './src/screens/SceneShotsScreen';
import { StorePreviewScreen } from './src/screens/StorePreviewScreen';
import { GenerationTrackerScreen } from './src/screens/GenerationTrackerScreen';
import { VideoStudioScreen } from './src/screens/VideoStudioScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { MyReelsScreen } from './src/screens/MyReelsScreen';
import { ApiService, JobResponse, SceneShotRef, Storyboard } from './src/services/api';
import { getStableUserId } from './src/services/deviceUser';
import { IapService } from './src/services/iap';
import { refreshPricing } from './src/services/pricing';
import { CAPTION_STYLES } from './src/config/captionStyles';
import { MUSIC_TRACKS } from './src/config/musicTracks';

const ONBOARDING_KEY = 'linkreel_seen_onboarding';

export default function App() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [credits, setCredits] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<JobResponse | null>(null);
  const [activeScreen, setActiveScreen] = useState<'dashboard' | 'shots' | 'preview' | 'tracking' | 'studio' | 'paywall' | 'reels'>('dashboard');
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [returnAfterPaywall, setReturnAfterPaywall] = useState<'dashboard' | 'shots' | 'preview'>('dashboard');
  const [studioReturn, setStudioReturn] = useState<'dashboard' | 'reels'>('dashboard');
  const [generating, setGenerating] = useState(false);
  const generatingLock = useRef(false);
  const inflightJobKey = useRef<string | null>(null);

  useEffect(() => {
    void refreshPricing();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync(ONBOARDING_KEY).then((value) => {
      if (!cancelled) setHasSeenOnboarding(value === '1');
    }).catch(() => {
      if (!cancelled) setHasSeenOnboarding(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getStableUserId().then(async (id) => {
      if (cancelled) return;
      setUserId(id);
      try {
        const data = await ApiService.getUser(id);
        if (!cancelled) setCredits(data.creditsRemaining);
      } catch {
        if (!cancelled) setCredits(0);
      }
      try {
        const pending = await IapService.syncUnfinished(id);
        if (!cancelled && pending) setCredits(pending.creditsRemaining);
      } catch {
        // StoreKit only exists on a real iOS build.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let interval: any;
    const jobId = currentJob?.id;

    if (activeScreen === 'tracking' && jobId) {
      const pollJob = async () => {
        try {
          const updated = await ApiService.getJob(jobId, userId || undefined);
          setCurrentJob(updated);

          if (updated.status === 'completed') {
            clearInterval(interval);
            setActiveScreen('studio');
          } else if (updated.status === 'failed') {
            clearInterval(interval);
            Alert.alert(
              updated.error?.title || 'Generation Error',
              updated.error?.message || 'Failed to render video.'
            );
            setActiveScreen('dashboard');
          }
        } catch (err) {
          // Ignore network blips during render
        }
      };

      pollJob();
      interval = setInterval(pollJob, 2000);
    }
    return () => clearInterval(interval);
  }, [activeScreen, currentJob?.id, userId]);

  const refreshCredits = async (id: string): Promise<number | null> => {
    try {
      const data = await ApiService.getUser(id);
      setCredits(data.creditsRemaining);
      return data.creditsRemaining;
    } catch {
      return null;
    }
  };

  const openPaywall = (from: 'dashboard' | 'shots' | 'preview' = 'dashboard') => {
    setReturnAfterPaywall(from);
    setActiveScreen('paywall');
    if (userId) void refreshCredits(userId);
  };

  const handleGenerate = async (sceneShots: SceneShotRef[], storyboard?: Storyboard) => {
    if (!userId || generatingLock.current) return;
    if (!draft) {
      Alert.alert('Start with the story', 'Write your story first so we can lock the 4 scenes.');
      setActiveScreen('dashboard');
      return;
    }
    const lockedScript = storyboard || draft.storyboard;
    if (storyboard) {
      setDraft((prev) => (prev ? { ...prev, storyboard } : prev));
    }
    const latest = await refreshCredits(userId);
    if ((latest ?? credits) < 1) {
      openPaywall(draft.source === 'store' ? 'preview' : 'shots');
      return;
    }
    generatingLock.current = true;
    setGenerating(true);
    try {
      if (!inflightJobKey.current) {
        inflightJobKey.current = `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      }
      const res = await ApiService.createJob({
        userId,
        inputUrl: draft.url || undefined,
        productName: draft.productName,
        userDescription: draft.userDescription,
        enableWebScraping: draft.enableWebScraping,
        lockedScript,
        sceneShots,
        idempotencyKey: inflightJobKey.current,
        aspectRatio: draft.aspectRatio,
        stylePreset: draft.stylePreset,
        voiceId: draft.voiceId,
        captionStyle: draft.captionStyle,
        musicTrack: draft.musicTrack,
        musicVolume: draft.musicVolume,
      });

      inflightJobKey.current = null;
      await refreshCredits(userId);
      setStudioReturn('dashboard');
      setCurrentJob({
        id: res.jobId,
        userId,
        inputUrl: draft.url || 'https://linkreel.app',
        userDescription: draft.userDescription,
        enableWebScraping: draft.enableWebScraping,
        aspectRatio: draft.aspectRatio,
        stylePreset: draft.stylePreset,
        voiceId: draft.voiceId,
        status: 'queued',
        progress: 10,
      });
      setActiveScreen('tracking');
    } catch (error: any) {
      const msg = String(error.message || '');
      if (msg.includes('INSUFFICIENT_CREDITS')) {
        inflightJobKey.current = null;
        openPaywall(draft.source === 'store' ? 'preview' : 'shots');
      } else {
        Alert.alert('Error', error.message || 'Unable to queue video generation.');
      }
    } finally {
      generatingLock.current = false;
      setGenerating(false);
    }
  };

  const goDashboard = () => {
    setActiveScreen('dashboard');
    if (userId) void refreshCredits(userId);
  };

  if (hasSeenOnboarding === null || !userId) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <ActivityIndicator color={Colors.accentCyan} style={{ flex: 1 }} />
      </View>
    );
  }

  if (!hasSeenOnboarding) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <OnboardingScreen
          onComplete={() => {
            setHasSeenOnboarding(true);
            void SecureStore.setItemAsync(ONBOARDING_KEY, '1');
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {activeScreen === 'dashboard' && (
        <DashboardScreen
          credits={credits}
          userId={userId}
          onPlanned={(next) => {
            setDraft(next);
            setActiveScreen(next.source === 'store' ? 'preview' : 'shots');
          }}
          onOpenPaywall={() => openPaywall('dashboard')}
          onOpenMyReels={() => setActiveScreen('reels')}
        />
      )}

      {activeScreen === 'shots' && draft && (
        <SceneShotsScreen
          userId={userId}
          credits={credits}
          generating={generating}
          storyboard={draft.storyboard}
          productName={draft.productName}
          onBack={() => setActiveScreen('dashboard')}
          onOpenPaywall={() => openPaywall('shots')}
          onScriptChange={(storyboard) =>
            setDraft((prev) => (prev ? { ...prev, storyboard } : prev))
          }
          onFinish={(shots, storyboard) => void handleGenerate(shots, storyboard)}
        />
      )}

      {activeScreen === 'preview' && draft?.listing && (
        <StorePreviewScreen
          credits={credits}
          generating={generating}
          productName={draft.productName}
          listing={draft.listing}
          storyboard={draft.storyboard}
          assignedShots={draft.assignedShots || []}
          captionStyleLabel={CAPTION_STYLES.find((s) => s.id === draft.captionStyle)?.title}
          musicLabel={
            draft.musicTrack === 'none'
              ? 'Off'
              : `${MUSIC_TRACKS.find((t) => t.id === draft.musicTrack)?.title || 'Pulse'} · ${draft.musicVolume || 'medium'}`
          }
          onBack={() => setActiveScreen('dashboard')}
          onOpenPaywall={() => openPaywall('preview')}
          onScriptChange={(storyboard) =>
            setDraft((prev) => (prev ? { ...prev, storyboard } : prev))
          }
          onGenerate={(shots, storyboard) => void handleGenerate(shots, storyboard)}
        />
      )}

      {activeScreen === 'tracking' && (
        <GenerationTrackerScreen
          job={currentJob}
          onCancel={goDashboard}
        />
      )}

      {activeScreen === 'reels' && (
        <MyReelsScreen
          userId={userId}
          onBack={goDashboard}
          onOpenReel={(job) => {
            setCurrentJob(job);
            setStudioReturn('reels');
            setActiveScreen('studio');
          }}
        />
      )}

      {activeScreen === 'studio' && currentJob && (
        <VideoStudioScreen
          job={currentJob}
          onBack={() => {
            if (studioReturn === 'reels') {
              setActiveScreen('reels');
              return;
            }
            goDashboard();
          }}
        />
      )}

      {activeScreen === 'paywall' && (
        <PaywallScreen
          userId={userId}
          credits={credits}
          onClose={() => setActiveScreen(returnAfterPaywall === 'preview' && !draft?.listing ? 'dashboard' : returnAfterPaywall)}
          onCreditsChanged={(next) => {
            setCredits(next);
            if (next > 0) {
              setActiveScreen(returnAfterPaywall === 'preview' && !draft?.listing ? 'dashboard' : returnAfterPaywall);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgObsidian,
  },
});

registerRootComponent(App);
