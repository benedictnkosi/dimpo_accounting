import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Pressable, Animated, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { brand } from '@/constants/matric';
import { useFeedback } from '../contexts/FeedbackContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { QUESTION_TYPE_EMOJIS } from '../constants/questionTypeEmojis';

interface TapToSelectQuestionProps {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  onContinue?: () => void;
  setIsQuestionAnswered: (answered: boolean) => void;
  emojis?: string[];
  subtext?: string;
  onAttempt?: (stepId: string, correct: boolean) => void;
}

export function TapToSelectQuestion({
  id,
  prompt,
  options,
  answer,
  onContinue,
  setIsQuestionAnswered,
  emojis,
  subtext,
  onAttempt,
}: TapToSelectQuestionProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const { colors, isDark } = useTheme();
  const { setFeedback, resetFeedback } = useFeedback();
  
  // Create animation values for each option
  const animationValues = useRef(
    options.reduce((acc, option) => {
      acc[option] = new Animated.Value(1);
      return acc;
    }, {} as Record<string, Animated.Value>)
  ).current;

  const handleOptionPress = (option: string) => {
    if (isAnswered) return; // Prevent multiple selections
    
    setSelectedOption(option);
    setIsQuestionAnswered(true);
    setIsAnswered(true);
    onAttempt?.('answer', option === answer);

    // Animate only the selected option
    const selectedAnim = animationValues[option];
    Animated.sequence([
      Animated.timing(selectedAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(selectedAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCheck = () => {
    const isCorrect = selectedOption === answer;
    
    if (!isCorrect && selectedOption) {
      // Shake animation for wrong answer - only on selected option
      const selectedAnim = animationValues[selectedOption];
      Animated.sequence([
        Animated.timing(selectedAnim, {
          toValue: 1.05,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(selectedAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(selectedAnim, {
          toValue: 1.05,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(selectedAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }

    setFeedback({
      isChecked: true,
      isCorrect,
      feedbackText: isCorrect ? 'Correct! 🎉' : `That's not quite right. The answer is "${answer}"`,
      correctAnswer: answer,
      questionId: id,
    });
  };

  const resetQuestion = () => {
    resetFeedback();
    setSelectedOption(null);
    setIsAnswered(false);
    setIsQuestionAnswered(false);
    // Reset all animation values
    Object.values(animationValues).forEach(anim => anim.setValue(1));
  };

  const handleContinue = () => {
    resetQuestion();
    // Call the parent's onContinue function
    onContinue?.();
  };

  useEffect(() => {
    // No need to set up callbacks anymore since we're using direct props
  }, []);

  useEffect(() => {
    // Reset state when a new question is loaded
    setSelectedOption(null);
    setIsAnswered(false);
    setIsQuestionAnswered(false);
    // Reset all animation values
    Object.values(animationValues).forEach(anim => anim.setValue(1));
    resetFeedback();
  }, [id]);

  const getOptionStyle = (option: string) => {
    const isSelected = selectedOption === option;
    const isCorrect = option === answer;
    
    if (!isAnswered) {
      return [
        styles.optionButton,
        {
          backgroundColor: brand.cardElevated,
          borderColor: isSelected ? colors.primary : colors.border,
        },
        isSelected && styles.selectedOption,
      ];
    }

    // Answered state
    if (isCorrect) {
      return [
        styles.optionButton,
        styles.correctOption,
        {
          backgroundColor: colors.success,
          borderColor: colors.success,
        },
      ];
    }

    if (isSelected && !isCorrect) {
      return [
        styles.optionButton,
        styles.incorrectOption,
        {
          backgroundColor: colors.error,
          borderColor: colors.error,
        },
      ];
    }

    return [
      styles.optionButton,
      {
        backgroundColor: brand.cardElevated,
        borderColor: colors.border,
        opacity: 0.6,
      },
    ];
  };

  const getOptionTextStyle = (option: string) => {
    const isSelected = selectedOption === option;
    const isCorrect = option === answer;
    
    if (!isAnswered) {
      return [
        styles.optionText,
        {
          color: isSelected ? colors.primary : colors.text,
          fontWeight: isSelected ? '600' as const : '400' as const,
        },
      ];
    }

    if (isCorrect) {
      return [
        styles.optionText,
        {
          color: '#111827',
          fontWeight: '700' as const,
        },
      ];
    }

    if (isSelected && !isCorrect) {
      return [
        styles.optionText,
        {
          color: '#111827',
          fontWeight: '700' as const,
        },
      ];
    }

    return [
      styles.optionText,
      {
        color: colors.textSecondary,
      },
    ];
  };

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={isAnswered ? [brand.card, brand.cardElevated] : [brand.card, brand.cardElevated]}
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ThemedText style={{ fontSize: 32, textAlign: 'center', marginBottom: 2 }}>
          {QUESTION_TYPE_EMOJIS.tapToSelect}
        </ThemedText>
        {emojis && (
          <View style={styles.emojiRow}>
            {emojis.map((emoji, idx) => (
              <ThemedText key={idx} style={styles.emoji}>{emoji}</ThemedText>
            ))}
          </View>
        )}
        <ThemedText style={[styles.prompt, { color: colors.text }]}> 
          {prompt}
        </ThemedText>
        {subtext && (
          <ThemedText style={styles.subtext}>{subtext}</ThemedText>
        )}
        <View style={styles.optionsContainer}>
          {options.map((option, index) => {
            const isSelected = selectedOption === option;
            const isCorrect = option === answer;
            const isWrong = isSelected && isAnswered && !isCorrect;
            return (
              <Animated.View
                key={option}
                style={[
                  {
                    transform: [
                      { scale: animationValues[option] },
                    ],
                  },
                  styles.animatedOption,
                ]}
              >
                <Pressable
                  style={({ pressed }) => [
                    getOptionStyle(option),
                    pressed && !isAnswered && styles.optionPressed,
                    isCorrect && isAnswered && styles.correctOption,
                    isWrong && styles.incorrectOption,
                  ]}
                  onPress={() => handleOptionPress(option)}
                  disabled={isAnswered}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${option}`}
                >
                  <View style={styles.optionContent}>
                    <ThemedText style={getOptionTextStyle(option)}>
                      {option}
                    </ThemedText>
                    {isAnswered && isSelected && (
                      <View style={styles.iconContainer}>
                        {isCorrect ? (
                          <Ionicons name="checkmark" size={22} color={colors.success} />
                        ) : (
                          <Ionicons name="close" size={22} color={colors.error} />
                        )}
                      </View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
        {/* Motivation message: only show after answering, and change based on correctness */}
      {isAnswered && (
        <ThemedText style={styles.motivation}>
          {selectedOption === answer
            ? "Keep going! You've got this! 💪"
            : "Don't worry, try the next one!"}
        </ThemedText>
      )}
      
        {isAnswered && (
          <Pressable
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue to next question"
            style={{ width: '100%' }}
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
    maxWidth: 440,
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
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
  },
  emoji: {
    fontSize: 36,
    marginHorizontal: 2,
  },
  prompt: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  subtext: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 18,
    marginTop: 2,
  },
  optionsContainer: {
    gap: 18,
    marginTop: 8,
    width: '100%',
  },
  animatedOption: {
    width: '100%',
  },
  optionButton: {
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
  optionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  selectedOption: {
    borderWidth: 3,
  },
  correctOption: {
    backgroundColor: '#e6ffe6',
    borderColor: '#22c55e',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  incorrectOption: {
    backgroundColor: '#fff0f0',
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
    color: brand.text,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconContainer: {
    marginLeft: 12,
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
  motivation: {
    marginTop: 18,
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '700',
    textAlign: 'center',
  },
}); 