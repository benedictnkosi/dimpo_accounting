import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { brand } from '@/constants/matric';
import { QUESTION_TYPE_EMOJIS } from '../constants/questionTypeEmojis';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface StepFlowQuestionProps {
  id: string;
  steps: {
    prompt: string;
    options: string[];
    answer: string;
    explanation?: string;
  }[];
  onContinue?: () => void;
  setIsQuestionAnswered: (answered: boolean) => void;
  onAttempt?: (stepId: string, correct: boolean) => void;
}

export function StepFlowQuestion({
  id,
  steps,
  onContinue,
  setIsQuestionAnswered,
  onAttempt,
}: StepFlowQuestionProps) {
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [stepResults, setStepResults] = useState<boolean[]>([]);
  const [stepAnswers, setStepAnswers] = useState<(string | null)[]>([]);
  const [stepFeedbacks, setStepFeedbacks] = useState<(string | null)[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<string[][]>([]);

  useEffect(() => {
    setCurrentStep(0);
    setSelected(null);
    setIsAnswered(false);
    setFeedback(null);
    setCompleted(false);
    setStepResults([]);
    setStepAnswers([]);
    setStepFeedbacks([]);
    setIsQuestionAnswered(false);
    // Shuffle options for each step
    const shuffle = (arr: string[]) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    setShuffledOptions(steps.map(step => shuffle(step.options)));
  }, [id]);

  useEffect(() => {
    setIsQuestionAnswered(completed);
  }, [completed, setIsQuestionAnswered]);

  const handleSelect = (value: string) => {
    if (isAnswered) return;
    setSelected(value);
    setIsAnswered(true);
    const isCorrect = value === steps[currentStep].answer;
    onAttempt?.(`step-${currentStep}`, isCorrect);
    const feedbackMsg = isCorrect ? 'Correct! 🎉' : `Incorrect. The answer is "${steps[currentStep].answer}"`;
    setFeedback(feedbackMsg);
    setStepResults(prev => {
      const updated = [...prev];
      updated[currentStep] = isCorrect;
      return updated;
    });
    setStepAnswers(prev => {
      const updated = [...prev];
      updated[currentStep] = value;
      return updated;
    });
    setStepFeedbacks(prev => {
      const updated = [...prev];
      updated[currentStep] = feedbackMsg;
      return updated;
    });
  };

  const handleContinue = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setSelected(stepAnswers[nextStep] ?? null);
      setIsAnswered(!!stepAnswers[nextStep]);
      setFeedback(stepFeedbacks[nextStep] ?? null);
    } else {
      setCompleted(true);
      onContinue?.();
    }
  };

  const getButtonStyle = (value: string) => {
    if (!isAnswered) {
      return [
        styles.button,
        selected === value && { borderColor: colors.primary, borderWidth: 2 },
      ];
    }
    if (value === steps[currentStep].answer) {
      return [
        styles.button,
        styles.correctButton,
        { borderColor: colors.success, borderWidth: 3 },
      ];
    }
    if (selected === value && value !== steps[currentStep].answer) {
      return [
        styles.button,
        styles.incorrectButton,
        { borderColor: colors.error, borderWidth: 3 },
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
    if (value === steps[currentStep].answer) {
      return [styles.buttonText, { color: brand.text, fontWeight: '700' as const }];
    }
    if (selected === value && value !== steps[currentStep].answer) {
      return [styles.buttonText, { color: brand.text, fontWeight: '700' as const }];
    }
    return [styles.buttonText, { color: colors.textSecondary }];
  };

  const getButtonIcon = (value: string) => {
    if (!isAnswered) return null;
    if (value === steps[currentStep].answer) {
      return <Ionicons name="checkmark-circle" size={22} color="#22c55e" style={{ marginLeft: 8 }} />;
    }
    if (selected === value && value !== steps[currentStep].answer) {
      return <Ionicons name="close-circle" size={22} color="#EF4444" style={{ marginLeft: 8 }} />;
    }
    return null;
  };

  // Progress bar calculation
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={[brand.card, brand.cardElevated]}
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.stepIndicator}>
          <ThemedText style={{ fontSize: 32, textAlign: 'center', marginBottom: 2 }}>
            {QUESTION_TYPE_EMOJIS.stepFlow}
          </ThemedText>
          <ThemedText style={styles.stepText}>
            Step {currentStep + 1} of {steps.length}
          </ThemedText>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>
        <ThemedText style={styles.prompt}>{steps[currentStep].prompt}</ThemedText>
        <View style={styles.buttonsContainer}>
          {shuffledOptions[currentStep]?.map(value => (
            <Pressable
              key={value}
              style={({ pressed }) => [
                ...getButtonStyle(value),
                pressed && !isAnswered && styles.buttonPressed,
              ]}
              onPress={() => handleSelect(value)}
              disabled={isAnswered}
              accessibilityRole="button"
              accessibilityLabel={`Select ${value}`}
            >
              <View style={styles.buttonContent}>
                <ThemedText style={getButtonTextStyle(value)}>{value}</ThemedText>
                {getButtonIcon(value)}
              </View>
            </Pressable>
          ))}
        </View>
        {isAnswered && feedback && (
          <View style={styles.feedbackContainer}>
            <ThemedText style={[styles.feedback, { color: feedback.startsWith('Correct') ? colors.success : colors.error }]}> 
              {feedback}
            </ThemedText>
            {steps[currentStep].explanation && (
              <ThemedText style={styles.explanation}>
                {steps[currentStep].explanation}
              </ThemedText>
            )}
          </View>
        )}
        {isAnswered && currentStep === steps.length - 1 && (
          <View style={styles.finishBanner}>
            <ThemedText style={[styles.completion, { color: colors.success, marginTop: 0 }]}>
              You finished this question!
            </ThemedText>
            <ThemedText style={styles.finishStatsText}>
              {stepResults.filter(Boolean).length} correct ·{' '}
              {stepResults.filter((value) => value === false).length} incorrect
            </ThemedText>
          </View>
        )}
        {isAnswered && !completed && (
          <Pressable
            style={{ width: '100%' }}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel={currentStep === steps.length - 1 ? "Next question" : "Next Step"}
          >
            <LinearGradient
              colors={[colors.primary, '#22c55e']}
              style={styles.nextButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <ThemedText style={styles.nextButtonText}>
                {currentStep === steps.length - 1 ? 'Next question' : 'Next Step'}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        )}
        {completed && (
          <ThemedText style={[styles.completion, { color: colors.success }]}>All steps completed!</ThemedText>
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
  stepIndicator: {
    marginBottom: 16,
    alignItems: 'center',
    width: '100%',
  },
  stepText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: brand.cardElevated,
    borderRadius: 3,
    marginTop: 4,
    marginBottom: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  prompt: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 18,
    color: brand.text,
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.1,
  },
  buttonsContainer: {
    gap: 18,
    marginTop: 8,
    width: '100%',
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
    backgroundColor: brand.card,
    borderColor: '#22c55e',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  incorrectButton: {
    backgroundColor: brand.card,
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
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
    color: brand.text,
  },
  feedbackContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  feedback: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  explanation: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 8,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  navigationButtonsContainer: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  nextButton: {
    marginTop: 8,
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
  nextButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 0.2,
  },
  completion: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    color: '#22C55E',
  },
  finishBanner: {
    width: '100%',
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
    padding: 14,
    alignItems: 'center',
  },
  finishStatsText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: brand.textSecondary,
    textAlign: 'center',
  },
}); 