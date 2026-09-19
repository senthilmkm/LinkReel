import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';

export interface BrandSettings {
  ctaText: string;
  accentColor: string;
  watermarkText: string;
  aspectRatio: '9:16' | '1:1' | '16:9';
}

interface BrandCustomizerProps {
  settings: BrandSettings;
  onChange: (updated: BrandSettings) => void;
}

const CTA_OPTIONS = [
  'Download on App Store',
  'Get it Now',
  'Try for Free',
  'Install Now',
  'Explore Today',
];

const ACCENT_COLORS = [
  { name: 'Electric Cyan', hex: '#00F0FF' },
  { name: 'Vibrant Violet', hex: '#A855F7' },
  { name: 'Hot Coral', hex: '#FF4B4B' },
  { name: 'Neon Gold', hex: '#FFB800' },
  { name: 'Emerald Wave', hex: '#10B981' },
];

const ASPECT_RATIOS: Array<{ id: '9:16' | '1:1' | '16:9'; label: string; desc: string }> = [
  { id: '9:16', label: '9:16 Reel', desc: 'TikTok, Shorts, IG Reels' },
  { id: '1:1', label: '1:1 Square', desc: 'Instagram Feed, LinkedIn' },
  { id: '16:9', label: '16:9 Wide', desc: 'YouTube, Web Banner' },
];

export const BrandCustomizer: React.FC<BrandCustomizerProps> = ({ settings, onChange }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>BRAND & REEL CUSTOMIZATION</Text>

      {/* Aspect Ratio Picker */}
      <Text style={styles.label}>Video Format / Aspect Ratio</Text>
      <View style={styles.aspectRow}>
        {ASPECT_RATIOS.map((item) => {
          const isSelected = settings.aspectRatio === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.aspectCard, isSelected && styles.aspectCardSelected]}
              onPress={() => onChange({ ...settings, aspectRatio: item.id })}
              activeOpacity={0.7}
            >
              <Text style={[styles.aspectLabel, isSelected && styles.aspectLabelSelected]}>
                {item.label}
              </Text>
              <Text style={styles.aspectDesc}>{item.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Accent Color Picker */}
      <Text style={styles.label}>Brand Accent Color</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorRow}>
        {ACCENT_COLORS.map((c) => {
          const isSelected = settings.accentColor === c.hex;
          return (
            <TouchableOpacity
              key={c.hex}
              style={[
                styles.colorChip,
                { backgroundColor: c.hex },
                isSelected && styles.colorChipSelected,
              ]}
              onPress={() => onChange({ ...settings, accentColor: c.hex })}
              activeOpacity={0.8}
            >
              {isSelected && <View style={styles.colorCheckInner} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Call To Action Badge Picker */}
      <Text style={styles.label}>Ending Scene CTA Badge</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ctaRow}>
        {CTA_OPTIONS.map((cta) => {
          const isSelected = settings.ctaText === cta;
          return (
            <TouchableOpacity
              key={cta}
              style={[styles.ctaChip, isSelected && styles.ctaChipSelected]}
              onPress={() => onChange({ ...settings, ctaText: cta })}
              activeOpacity={0.7}
            >
              <Text style={[styles.ctaText, isSelected && styles.ctaTextSelected]}>{cta}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F131D',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionTitle: {
    color: Colors.accentCyan,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  aspectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  aspectCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  aspectCardSelected: {
    borderColor: Colors.accentCyan,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
  },
  aspectLabel: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  aspectLabelSelected: {
    color: Colors.accentCyan,
  },
  aspectDesc: {
    color: '#64748B',
    fontSize: 9,
    textAlign: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  colorChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorChipSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  colorCheckInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  ctaRow: {
    flexDirection: 'row',
  },
  ctaChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ctaChipSelected: {
    backgroundColor: Colors.accentCyan,
    borderColor: Colors.accentCyan,
  },
  ctaText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  ctaTextSelected: {
    color: '#07090E',
    fontWeight: '700',
  },
});
