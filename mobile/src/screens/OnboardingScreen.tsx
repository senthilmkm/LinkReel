import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions } from 'react-native';
import { Colors } from '../theme/colors';
import { getPricing } from '../services/pricing';

const { width } = Dimensions.get('window');

interface Props {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const slides = [
    {
      emoji: '🔗 ➔ 🎬',
      title: 'Paste your App Store link.',
      description: 'We read the listing and screenshots, then lock 4 scenes — before you spend a credit.',
    },
    {
      emoji: '📱 ➔ 🖼️',
      title: 'Check the 4 scenes. Fix words, change or skip.',
      description: 'Tap a caption or voice line if a line is off. Change the screen if one is wrong. Skip uses a caption card. Still free until you generate.',
    },
    {
      emoji: '🚀 ➔ 📤',
      title: 'Export a reel people actually watch',
      description: getPricing().messages.onboardingGenerate,
    },
  ];

  const handleNext = () => {
    if (currentStep < slides.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const slide = slides[currentStep];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logoText}>LinkReel <Text style={styles.sparkle}>✦</Text></Text>
        <TouchableOpacity onPress={onComplete}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.emojiText}>{slide.emoji}</Text>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
      </View>

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, currentStep === i ? styles.activeDot : styles.inactiveDot]}
          />
        ))}
      </View>

      {/* CTA Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>
            {currentStep === slides.length - 1 ? 'Get Started 🚀' : 'Continue'}
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
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  sparkle: {
    color: Colors.accentIndigo,
  },
  skipText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  emojiText: {
    fontSize: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: Colors.accentIndigo,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: Colors.surfaceBorder,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  primaryButton: {
    backgroundColor: Colors.accentIndigo,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
