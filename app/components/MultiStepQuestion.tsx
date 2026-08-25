import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { brand } from '@/constants/matric';
import { QUESTION_TYPE_EMOJIS } from '../constants/questionTypeEmojis';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface MultiStepQuestionProps {
  id: string;
  context: string;
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

// Utility function to parse HTML tables
const parseHtmlTables = (text: string) => {
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/(th|td)>/gi;
  
  let result = text;
  let tableIndex = 0;
  
  // Replace each table with a placeholder
  result = result.replace(tableRegex, (match, tableContent) => {
    const rows: string[][] = [];
    let rowMatch;
    
    // Parse rows
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const row: string[] = [];
      let cellMatch;
      
      // Parse cells in this row
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        row.push(cellMatch[2].trim());
      }
      
      if (row.length > 0) {
        rows.push(row);
      }
    }
    
    // Return a special marker that we'll replace later
    return `__TABLE_${tableIndex++}__`;
  });
  
  return { text: result, tables: [] };
};

// Component to render a table
const TableRenderer = ({ data }: { data: string[][] }) => {
  const { colors } = useTheme();
  
  if (!data || data.length === 0) return null;
  
  return (
    <View style={styles.tableContainer}>
      {data.map((row, rowIndex) => (
        <View 
          key={rowIndex} 
          style={[
            styles.tableRow,
            rowIndex === data.length - 1 && { borderBottomWidth: 0 }
          ]}
        >
          {row.map((cell, cellIndex) => (
            <View 
              key={cellIndex} 
              style={[
                styles.tableCell,
                rowIndex === 0 && styles.tableHeader,
                cellIndex === row.length - 1 && { borderRightWidth: 0 },
                { borderColor: colors.border }
              ]}
            >
              <ThemedText 
                style={[
                  styles.tableCellText,
                  rowIndex === 0 && styles.tableHeaderText,
                  { color: rowIndex === 0 ? '#374151' : '#6B7280' }
                ]}
              >
                {cell}
              </ThemedText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

// Component to render context with tables
const ContextRenderer = ({ context }: { context: string }) => {
  const { colors } = useTheme();
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/(th|td)>/gi;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let tableIndex = 0;
  
  // Find all tables in the context
  let match;
  while ((match = tableRegex.exec(context)) !== null) {
    // Add text before the table
    if (match.index > lastIndex) {
      const textBefore = context.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        parts.push(
          <ThemedText key={`text-${tableIndex}`} style={styles.contextText}>
            {textBefore}
          </ThemedText>
        );
      }
    }
    
    // Parse and render the table
    const tableContent = match[1];
    const rows: string[][] = [];
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const row: string[] = [];
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        row.push(cellMatch[2].trim());
      }
      
      if (row.length > 0) {
        rows.push(row);
      }
    }
    
    if (rows.length > 0) {
      parts.push(
        <TableRenderer key={`table-${tableIndex}`} data={rows} />
      );
    }
    
    lastIndex = match.index + match[0].length;
    tableIndex++;
  }
  
  // Add remaining text after the last table
  if (lastIndex < context.length) {
    const remainingText = context.slice(lastIndex);
    if (remainingText.trim()) {
      parts.push(
        <ThemedText key="text-final" style={styles.contextText}>
          {remainingText}
        </ThemedText>
      );
    }
  }
  
  // If no tables found, render as plain text
  if (parts.length === 0) {
    return (
      <ThemedText style={styles.contextText}>
        {context}
      </ThemedText>
    );
  }
  
  return <>{parts}</>;
};

// Component to render previous answers table
const PreviousAnswersTable = ({ 
  steps, 
  stepAnswers, 
  currentStep 
}: { 
  steps: any[]; 
  stepAnswers: (string | null)[]; 
  currentStep: number; 
}) => {
  // Get completed steps (excluding current step)
  const completedSteps = stepAnswers
    .map((answer, index) => ({ 
      prompt: steps[index]?.prompt || '', 
      answer: answer
    }))
    .filter((step, index) => step.answer !== null && index < currentStep);
  
  if (completedSteps.length === 0) return null;
  
  return (
    <View style={styles.previousAnswersContainer}>
      <View style={styles.previousAnswersTable}>
        <View style={styles.previousAnswersHeader}>
          <View style={[styles.previousAnswersCell, { flex: 2 }]}>
            <ThemedText style={styles.previousAnswersHeaderText}>Question</ThemedText>
          </View>
          <View style={[styles.previousAnswersCell, { flex: 1.2 }]}>
            <ThemedText style={styles.previousAnswersHeaderText}>Answer</ThemedText>
          </View>
        </View>
        {completedSteps.map((step, index) => (
          <View key={index} style={[
            styles.previousAnswersRow,
            index === completedSteps.length - 1 && { borderBottomWidth: 0 }
          ]}>
            <View style={[styles.previousAnswersCell, { flex: 2 }]}>
              <ThemedText style={styles.previousAnswersCellText} numberOfLines={2}>
                {step.prompt}
              </ThemedText>
            </View>
            <View style={[styles.previousAnswersCell, { flex: 1.2 }]}>
              <ThemedText style={styles.previousAnswersCellText}>
                {step.answer}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export function MultiStepQuestion({
  id,
  context,
  steps,
  onContinue,
  setIsQuestionAnswered,
  onAttempt,
}: MultiStepQuestionProps) {
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
  const [showPreviousAnswers, setShowPreviousAnswers] = useState(false);

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
    // Don't set completed here - let the continue button handle it
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      setSelected(stepAnswers[prevStep] ?? null);
      setIsAnswered(!!stepAnswers[prevStep]);
      setFeedback(stepFeedbacks[prevStep] ?? null);
      setCompleted(false);
    }
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
            {QUESTION_TYPE_EMOJIS.multiStep}
          </ThemedText>
          <ThemedText style={styles.stepText}>
            Step {currentStep + 1} of {steps.length}
          </ThemedText>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>
        
        <View style={styles.contextContainer}>
          <ContextRenderer context={context} />
        </View>
        <ThemedText style={styles.prompt}>{steps[currentStep].prompt}</ThemedText>
        
        {/* Previous Answers Toggle Button */}
        {currentStep > 0 && (
          <Pressable
            style={styles.previousAnswersToggle}
            onPress={() => setShowPreviousAnswers(!showPreviousAnswers)}
            accessibilityRole="button"
            accessibilityLabel={showPreviousAnswers ? "Hide Previous Answers" : "Show Previous Answers"}
          >
            <ThemedText style={styles.previousAnswersToggleText}>
              {showPreviousAnswers ? "Hide Previous Answers" : "Show Previous Answers"}
            </ThemedText>
            <Ionicons 
              name={showPreviousAnswers ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={colors.primary} 
            />
          </Pressable>
        )}
        
        {/* Previous Answers Section */}
        {currentStep > 0 && showPreviousAnswers && (
          <PreviousAnswersTable 
            steps={steps}
            stepAnswers={stepAnswers}
            currentStep={currentStep}
          />
        )}
        
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
            <ThemedText style={[styles.completion, { color: colors.success }]}>
              You finished this question!
            </ThemedText>
            <ThemedText style={styles.finishStatsText}>
              {stepResults.filter(Boolean).length} correct ·{' '}
              {stepResults.filter((value) => value === false).length} incorrect
            </ThemedText>
          </View>
        )}
        
        {isAnswered && !completed && (
          <View style={styles.navigationButtonsContainer}>
            {currentStep > 0 && (
              <Pressable
                style={{ flex: 1, marginRight: 8 }}
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel="Previous Step"
              >
                <LinearGradient
                  colors={['#64748B', '#475569']}
                  style={styles.backButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <ThemedText style={styles.backButtonText}>Back</ThemedText>
                </LinearGradient>
              </Pressable>
            )}
            {(currentStep < steps.length - 1 || currentStep === steps.length - 1) && (
              <Pressable
                style={{ flex: 1, marginLeft: currentStep > 0 ? 8 : 0 }}
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
                    {currentStep === steps.length - 1 ? 'Next question' : 'Next'}
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            )}
          </View>
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
    padding: 8,
    backgroundColor: 'transparent',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 32,
    padding: 16,
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
  contextContainer: {
    marginBottom: 8,
    width: '100%',
  },
  context: {
    fontSize: 15,
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
    color: '#64748B',
    fontWeight: '500',
  },
  contextText: {
    fontSize: 15,
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 22,
  },
  prompt: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 18,
    color: brand.text,
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
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
    color: brand.text,
  },
  feedbackContainer: {
    marginTop: 18,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  backButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.2,
  },
  nextButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
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
  tableContainer: {
    width: '100%',
    marginVertical: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.card,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  tableCell: {
    flex: 1,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: brand.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: brand.cardElevated,
  },
  tableHeaderText: {
    fontWeight: '700',
    fontSize: 14,
    color: brand.textSecondary,
  },
  tableCellText: {
    fontSize: 14,
    fontWeight: '500',
    color: brand.textSecondary,
    textAlign: 'center',
  },
  previousAnswersContainer: {
    marginTop: 16,
    width: '100%',
  },
  previousAnswersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brand.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  previousAnswersTable: {
    width: '100%',
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: brand.card,
  },
  previousAnswersHeader: {
    flexDirection: 'row',
    backgroundColor: brand.cardElevated,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  previousAnswersHeaderText: {
    fontWeight: '700',
    fontSize: 12,
    color: brand.textSecondary,
    textAlign: 'center',
  },
  previousAnswersRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  previousAnswersCell: {
    flex: 1,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previousAnswersCellText: {
    fontSize: 12,
    fontWeight: '500',
    color: brand.textSecondary,
    textAlign: 'center',
  },
  previousAnswersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: brand.cardElevated,
  },
  previousAnswersToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginRight: 6,
  },
}); 