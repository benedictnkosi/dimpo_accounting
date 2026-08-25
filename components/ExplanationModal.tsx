import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { MathText } from '@/components/math/MathText';
import { MarkdownContent } from '@/components/math/MarkdownContent';
import { brand } from '@/constants/matric';

interface ExplanationModalProps {
  visible: boolean;
  onClose: () => void;
  questionStem: string;
  correctAnswer: string;
  explanation: string;
  onGenerate?: () => Promise<void>;
}

export function ExplanationModal({
  visible,
  onClose,
  questionStem,
  correctAnswer,
  explanation,
  onGenerate,
}: ExplanationModalProps) {
  const insets = useSafeAreaInsets();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const hasExplanation = !!explanation.trim();

  async function handleGenerate() {
    if (!onGenerate || generating) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      await onGenerate();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not generate an explanation. Please try again.';
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={18} color={brand.primarySoft} />
            <ThemedText style={styles.title}>Explanation</ThemedText>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close explanation">
            <Ionicons name="close" size={22} color={brand.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <MathText
            content={questionStem}
            mode="inline"
            color={brand.text}
            fontWeight="700"
            style={styles.stem}
          />

          <View style={styles.correctBanner}>
            <View style={styles.correctHeader}>
              <Ionicons name="checkmark-circle" size={16} color={brand.emerald} />
              <ThemedText style={styles.correctLabel}>Correct answer</ThemedText>
            </View>
            <MathText
              content={correctAnswer}
              mode="inline"
              color={brand.text}
              fontWeight="700"
            />
          </View>

          {hasExplanation ? (
            <MarkdownContent content={explanation} color={brand.textSecondary} />
          ) : (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyBody}>
                No explanation is available for this question yet. Generate one now to see a
                step-by-step breakdown.
              </ThemedText>
              {!!generateError && (
                <ThemedText style={styles.errorText}>{generateError}</ThemedText>
              )}
              {!!onGenerate && (
                <Pressable
                  style={[styles.generateButton, generating && styles.disabled]}
                  onPress={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <View style={styles.generateRow}>
                      <ActivityIndicator color={brand.background} />
                      <ThemedText style={styles.generateText}>Generating...</ThemedText>
                    </View>
                  ) : (
                    <ThemedText style={styles.generateText}>Generate Explanation</ThemedText>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brand.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    backgroundColor: brand.frosted,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: brand.text,
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  stem: {
    fontSize: 16,
  },
  correctBanner: {
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderColor: 'rgba(34,197,94,0.35)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  correctHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  correctLabel: {
    color: brand.emerald,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empty: {
    paddingTop: 4,
    gap: 14,
  },
  emptyBody: {
    color: brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: brand.rose,
    fontSize: 14,
    lineHeight: 20,
  },
  generateButton: {
    backgroundColor: brand.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  generateText: {
    color: brand.background,
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.75,
  },
});
