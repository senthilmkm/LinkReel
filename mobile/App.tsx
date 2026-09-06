import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Alert } from 'react-native';
import { registerRootComponent } from 'expo';
import { Colors } from './src/theme/colors';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DashboardScreen, StoryDraft } from './src/screens/DashboardScreen';
import { SceneShotsScreen } from './src/screens/SceneShotsScreen';
import { StorePreviewScreen } from './src/screens/StorePreviewScreen';
import { GenerationTrackerScreen } from './src/screens/GenerationTrackerScreen';
import { VideoStudioScreen } from './src/screens/VideoStudioScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { ApiService, JobResponse, SceneShotRef } from './src/services/api';
import { getStableUserId } from './src/services/deviceUser';
import { refreshPricing } from './src/services/pricing';

export default function App() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [credits, setCredits] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<JobResponse | null>(null);
  const [activeScreen, setActiveScreen] = useState<'dashboard' | 'shots' | 'preview' | 'tracking' | 'studio' | 'paywall'>('dashboard');
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [returnAfterPaywall, setReturnAfterPaywall] = useState<'dashboard' | 'shots' | 'preview'>('dashboard');

  useEffect(() => {
    void refreshPricing();
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
          const updated = await ApiService.getJob(jobId);
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
  }, [activeScreen, currentJob?.id]);

  const refreshCredits = async (id: string) => {
    try {
      const data = await ApiService.getUser(id);
      setCredits(data.creditsRemaining);
      return data.creditsRemaining;
    } catch {
      setCredits(0);
      return 0;
    }
  };

  const openPaywall = (from: 'dashboard' | 'shots' | 'preview' = 'dashboard') => {
    setReturnAfterPaywall(from);
    setActiveScreen('paywall');
    if (userId) void refreshCredits(userId);
  };

  const handleGenerate = async (sceneShots: SceneShotRef[]) => {
    if (!userId) return;
    if (!draft) {
      Alert.alert('Start with the story', 'Write your story first so we can lock the 4 scenes.');
      setActiveScreen('dashboard');
      return;
    }
    if (credits < 1) {
      openPaywall(draft.source === 'store' ? 'preview' : 'shots');
      return;
    }
    try {
      const idempotencyKey = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const res = await ApiService.createJob({
        userId,
        inputUrl: draft.url || undefined,
        productName: draft.productName,
        userDescription: draft.userDescription,
        enableWebScraping: draft.enableWebScraping,
        lockedScript: draft.storyboard,
        sceneShots,
        idempotencyKey,
        aspectRatio: draft.aspectRatio,
        stylePreset: draft.stylePreset,
        voiceId: draft.voiceId,
      });

      setCredits((prev) => Math.max(0, prev - 1));
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
        openPaywall(draft.source === 'store' ? 'preview' : 'shots');
      } else {
        Alert.alert('Error', error.message || 'Unable to queue video generation.');
      }
    }
  };

  if (!hasSeenOnboarding) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <OnboardingScreen onComplete={() => setHasSeenOnboarding(true)} />
      </View>
    );
  }

  if (!userId) {
    return <View style={styles.container}><StatusBar style="light" /></View>;
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
        />
      )}

      {activeScreen === 'shots' && draft && (
        <SceneShotsScreen
          userId={userId}
          storyboard={draft.storyboard}
          productName={draft.productName}
          onBack={() => setActiveScreen('dashboard')}
          onFinish={(shots) => void handleGenerate(shots)}
        />
      )}

      {activeScreen === 'preview' && draft?.listing && (
        <StorePreviewScreen
          productName={draft.productName}
          listing={draft.listing}
          storyboard={draft.storyboard}
          assignedShots={draft.assignedShots || []}
          onBack={() => setActiveScreen('dashboard')}
          onGenerate={(shots) => void handleGenerate(shots)}
        />
      )}

      {activeScreen === 'tracking' && (
        <GenerationTrackerScreen
          job={currentJob}
          onCancel={() => setActiveScreen('dashboard')}
        />
      )}

      {activeScreen === 'studio' && currentJob && (
        <VideoStudioScreen
          job={currentJob}
          onBack={() => setActiveScreen('dashboard')}
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
