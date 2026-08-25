import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { brand } from '@/constants/matric';
import { QUESTION_TYPE_EMOJIS } from '../constants/questionTypeEmojis';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface TrueFalseQuestionProps {
  id: string;
  prompt: string;
  answer: 'True' | 'False' | string;
  explanation?: string;
  onContinue?: () => void;
  setIsQuestionAnswered: (answered: boolean) => void;
  onAttempt?: (stepId: string, correct: boolean) => void;
}

export function TrueFalseQuestion({
  id,
  prompt,
  answer,
  explanation,
  onContinue,
  setIsQuestionAnswered,
  onAttempt,
}: TrueFalseQuestionProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
    setIsAnswered(false);
    setFeedback(null);
    setIsQuestionAnswered(false);
  }, [id]);

  const handleSelect = (value: string) => {
    if (isAnswered) return;
    setSelected(value);
    setIsAnswered(true);
    setIsQuestionAnswered(true);
    const isCorrect = value === answer;
    onAttempt?.('answer', isCorrect);
    setFeedback(isCorrect ? 'Correct! 🎉' : `Incorrect. The answer is "${answer}"`);
  };

  const handleContinue = () => {
    setSelected(null);
    setIsAnswered(false);
    setFeedback(null);
    setIsQuestionAnswered(false);
    onContinue?.();
  };

  const getButtonStyle = (value: string) => {
    if (!isAnswered) {
      return [
        styles.button,
        selected === value && { borderColor: colors.primary, borderWidth: 2 },
      ];
    }
    if (value === answer) {
      return [
        styles.button,
        styles.correctButton,
        { backgroundColor: colors.success, borderColor: colors.success },
      ];
    }
    if (selected === value && value !== answer) {
      return [
        styles.button,
        styles.incorrectButton,
        { backgroundColor: colors.error, borderColor: colors.error },
      ];
    }
    return [styles.button, { opacity: 0.6 }];
  };

  const getButtonTextStyle = (value: string) => {
    if (!isAnswered) {
      return [
        styles.buttonText,
        selected === value && { color: colors.primary, fontWeight: '600' as const },
      ];
    }
    if (value === answer) {
      return [styles.buttonText, { color: '#fff', fontWeight: '700' as const }];
    }
    if (selected === value && value !== answer) {
      return [styles.buttonText, { color: '#fff', fontWeight: '700' as const }];
    }
    return [styles.buttonText, { color: colors.textSecondary }];
  };

  const getButtonIcon = (value: string) => {
    if (isAnswered) return null;
    return null;
  };

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={[brand.card, brand.cardElevated]}
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        
        <ThemedText style={styles.prompt}>{prompt}</ThemedText>
        <View style={styles.buttonsRow}>
          {[{ value: 'True', emoji: '✅' }, { value: 'False', emoji: '❌' }].map(({ value, emoji }) => (
            <Pressable
              key={value}
              style={({ pressed }) => [
                ...getButtonStyle(value),
                styles.emojiButton,
                pressed && !isAnswered && styles.buttonPressed,
              ]}
              onPress={() => handleSelect(value)}
              disabled={isAnswered}
              accessibilityRole="button"
              accessibilityLabel={`Select ${value}`}
            >
              <View style={styles.buttonContent}>
                <ThemedText style={[getButtonTextStyle(value), { fontSize: 32 }]}> {emoji} </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
        {isAnswered && feedback && (
          <ThemedText style={[styles.feedback, { color: feedback.startsWith('Correct') ? colors.success : colors.error }]}> 
            {feedback}
          </ThemedText>
        )}
        {isAnswered && explanation && (
          <ThemedText style={[styles.explanation, { color: colors.textSecondary }]}> 
            {explanation}
          </ThemedText>
        )}
        {isAnswered && (
          <Pressable
            style={{ width: '100%' }}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue to next question"
          >
            <LinearGradient
              colors={[colors.primary, '#22c55e']}
              style={styles.continueButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <ThemedText style={styles.continueButtonText}>Continue 🚀</ThemedText>
            </LinearGradient>
          </Pressable>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'transparent',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 32,
    padding: 32,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
    backgroundColor: brand.card,
    marginVertical: 24,
    alignItems: 'center',
  },
  prompt: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 18,
    color: brand.text,
    lineHeight: 32,
    letterSpacing: 0.1,
  },
  buttonsContainer: {
    gap: 18,
    marginTop: 8,
    width: '100%',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
  },
  emojiButton: {
    flex: 1,
    minWidth: 80,
    maxWidth: 180,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 2,
    minHeight: 60,
    backgroundColor: brand.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 2,
    marginTop: 2,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  correctButton: {
    backgroundColor: '#e6ffe6',
    borderColor: '#22c55e',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  incorrectButton: {
    backgroundColor: '#fff0f0',
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
    color: brand.text,
  },
  feedback: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 18,
  },
  explanation: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  continueButton: {
    marginTop: 24,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 0.2,
  },
}); 