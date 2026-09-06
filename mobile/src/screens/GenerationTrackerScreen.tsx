import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { JobResponse } from '../services/api';

interface Props {
  job: JobResponse | null;
  onCancel: () => void;
}

export const GenerationTrackerScreen: React.FC<Props> = ({ job, onCancel }) => {
  const progress = job?.progress || 10;
  const status = job?.status || 'queued';

  const stages = [
    { key: 'scraping', label: 'Collect your inputs', desc: 'Story, scenes, and any shots you attached' },
    { key: 'scripting', label: 'Keep your 4 scenes', desc: 'We use the script you already approved' },
    { key: 'generating_audio', label: 'Record the voiceover', desc: 'Nora or Alex, plus captions' },
    { key: 'rendering', label: 'Render the reel', desc: 'Put scenes, voice, and captions together' },
  ];

  const targetLabel = (() => {
    const brand = job?.branding?.title?.trim();
    if (brand) return brand;
    const url = job?.inputUrl || '';
    if (url && !url.includes('linkreel.app')) {
      return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }
    return 'Your reel';
  })();

  const getStageStatus = (stageKey: string, index: number) => {
    const statusOrder = ['queued', 'scraping', 'scripting', 'generating_audio', 'rendering', 'completed'];
    const currentIdx = statusOrder.indexOf(status);
    const stageIdx = index + 1;

    if (currentIdx > stageIdx || status === 'completed') return 'done';
    if (currentIdx === stageIdx) return 'active';
    return 'pending';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Making your reel</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        {/* Glowing Radial Orb Mock */}
        <View style={styles.orbContainer}>
          <View style={styles.orbRing}>
            <Text style={styles.percentageText}>{progress}%</Text>
            <Text style={styles.statusLabel}>
              {status === 'completed' ? 'Done' : 'Working…'}
            </Text>
          </View>
        </View>

        <Text style={styles.urlLabel} numberOfLines={1}>
          {targetLabel}
        </Text>

        {/* 4 Pipeline Stages */}
        <View style={styles.stepperContainer}>
          {stages.map((stage, idx) => {
            const st = getStageStatus(stage.key, idx);
            return (
              <View key={stage.key} style={styles.stageRow}>
                <View style={[styles.stageIndicator, st === 'done' && styles.stageDone, st === 'active' && styles.stageActive]}>
                  <Text style={styles.indicatorText}>
                    {st === 'done' ? '✓' : st === 'active' ? '●' : '○'}
                  </Text>
                </View>
                <View style={styles.stageInfo}>
                  <Text style={[styles.stageTitle, st === 'active' && styles.activeStageTitle]}>
                    {stage.label}
                  </Text>
                  <Text style={styles.stageDesc}>{stage.desc}</Text>
                </View>
              </View>
            );
          })}
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
    paddingTop: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbContainer: {
    marginBottom: 20,
  },
  orbRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: Colors.accentIndigo,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  percentageText: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.accentCyan,
    marginTop: 4,
    fontWeight: '600',
  },
  urlLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  stepperContainer: {
    width: '100%',
    backgroundColor: Colors.surfaceCard,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: 20,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  stageIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stageDone: {
    backgroundColor: Colors.statusSuccess,
  },
  stageActive: {
    backgroundColor: Colors.accentIndigo,
  },
  indicatorText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  stageInfo: {
    flex: 1,
  },
  stageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeStageTitle: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  stageDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
