import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { CAPTION_MAX, NARRATION_MAX } from '../utils/storyboardEdits';

interface Props {
  caption: string;
  narration: string;
  onCaptionChange: (value: string) => void;
  onNarrationChange: (value: string) => void;
  compact?: boolean;
}

export const SceneCopyFields: React.FC<Props> = ({
  caption,
  narration,
  onCaptionChange,
  onNarrationChange,
  compact = false,
}) => {
  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>ON SCREEN</Text>
        <Text style={styles.count}>
          {caption.length}/{CAPTION_MAX}
        </Text>
      </View>
      <TextInput
        value={caption}
        onChangeText={onCaptionChange}
        maxLength={CAPTION_MAX}
        placeholder="Short caption on the video"
        placeholderTextColor={Colors.textMuted}
        autoCorrect
        style={[styles.captionInput, compact && styles.captionInputCompact]}
      />

      <View style={styles.labelRow}>
        <Text style={styles.label}>VOICE</Text>
        <Text style={styles.count}>
          {narration.length}/{NARRATION_MAX}
        </Text>
      </View>
      <TextInput
        value={narration}
        onChangeText={onNarrationChange}
        maxLength={NARRATION_MAX}
        placeholder="What Nora or Alex says in this beat"
        placeholderTextColor={Colors.textMuted}
        multiline
        textAlignVertical="top"
        autoCorrect
        style={[styles.narrationInput, compact && styles.narrationInputCompact]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  count: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  captionInput: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    backgroundColor: Colors.bgObsidian,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  captionInputCompact: {
    fontSize: 16,
    paddingVertical: 8,
    marginBottom: 10,
  },
  narrationInput: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 72,
    backgroundColor: Colors.bgObsidian,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  narrationInputCompact: {
    fontSize: 13,
    lineHeight: 18,
    minHeight: 56,
    marginBottom: 10,
  },
});
