import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { HOST_URL } from '@/config/api';
import { useTheme } from '@/contexts/ThemeContext';
import { analytics } from '@/services/analytics';

// Import question components
import { TapToSelectQuestion } from './components/TapToSelectQuestion';
import { CategoriseQuestion } from './components/CategoriseQuestion';
import { MatchingQuestion } from './components/MatchingQuestion';
import { TrueFalseQuestion } from './components/TrueFalseQuestion';
import { MultiStepQuestion } from './components/MultiStepQuestion';
import { StepFlowQuestion } from './components/StepFlowQuestion';
import { DragToSortQuestion } from './components/DragToSortQuestion';

import subtopicEmojis from '@/assets/subtopic_emojis.json';

// Dev mode check
const __DEV__ = process.env.NODE_ENV === 'development';

interface AccountingQuestion {
  id: string;
  type: string;
  prompt: string;
  options?: string[];
  answer?: string;
  pairs?: Record<string, string>;
  categories?: string[];
  categorise_items?: Record<string, string>;
  items?: Record<string, string> | string[];
  explanation?: string;
  items_list?: string[];
  correct_order?: string[];
  context?: string;
  steps?: { prompt: string; options: string[]; answer: string }[];
}

interface AccountingLessonData {
  topic: string;
  level: string;
  data: AccountingQuestion[];
}

export default function AccountingLessonScreen() {
  const { topicId, topicName, subtopicId, subtopicName, levelId, levelName } = useLocalSearchParams();
  const [lessonData, setLessonData] = useState<AccountingLessonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isQuestionAnswered, setIsQuestionAnswered] = useState(false);
  const router = useRouter();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const url = `${HOST_URL}/api/accounting-questions/topic/${subtopicName}/level/${levelName}`;
        console.log('Fetching questions from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: AccountingLessonData = await response.json();
        console.log('Questions fetched:', data);
        setLessonData(data);
        
        analytics.track('accounting_lesson_started', {
          topic_id: topicId,
          topic_name: topicName,
          subtopic_id: subtopicId,
          subtopic_name: subtopicName,
          level_id: levelId,
          level_name: levelName,
          question_count: data.data.length
        });
        
      } catch (err) {
        console.error('Error fetching accounting questions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load questions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [topicId, topicName, subtopicId, subtopicName, levelId, levelName]);

  const handleBackPress = () => {
    router.back();
  };

  const handleNextQuestion = () => {
    if (lessonData && currentQuestionIndex < lessonData.data.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setIsQuestionAnswered(false);
    } else {
      // Lesson completed
      analytics.track('accounting_lesson_completed', {
        topic_id: topicId,
        topic_name: topicName,
        subtopic_id: subtopicId,
        subtopic_name: subtopicName,
        level_id: levelId,
        level_name: levelName,
        total_questions: lessonData?.data.length || 0
      });
      
      // Navigate back to subtopics
      router.back();
    }
  };

  const handleContinue = () => {
    handleNextQuestion();
  };

  // Dev function to skip to next question
  const handleDevSkip = () => {
    if (lessonData && currentQuestionIndex < lessonData.data.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setIsQuestionAnswered(false);
    }
  };

  // Dev function to go to previous question
  const handleDevPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setIsQuestionAnswered(false);
    }
  };

  // Dev function to go to specific question
  const handleDevJumpTo = (index: number) => {
    if (lessonData && index >= 0 && index < lessonData.data.length) {
      setCurrentQuestionIndex(index);
      setIsQuestionAnswered(false);
    }
  };

  const renderQuestion = (question: AccountingQuestion) => {
    switch (question.type) {
      case 'tap-to-select':
        return (
          <TapToSelectQuestion
            key={question.id}
            id={question.id}
            prompt={question.prompt}
            options={question.options || []}
            answer={question.answer || ''}
            onContinue={handleContinue}
            setIsQuestionAnswered={setIsQuestionAnswered}
          />
        );
      
      case 'matching':
        return (
          <MatchingQuestion
            key={question.id}
            id={question.id}
            prompt={question.prompt}
            pairs={question.pairs || {}}
            onContinue={handleContinue}
            setIsQuestionAnswered={setIsQuestionAnswered}
          />
        );
      
      case 'categorise':
        console.log('promt', question.prompt);
        console.log('items', question.items);
        console.log('categories', question.categories);
        console.log('id', question.id);
        return (
          <CategoriseQuestion
            key={question.id}
            id={question.id}
            prompt={question.prompt}
            categories={question.categories || []}
            items={(question.items as Record<string, string>) || {}}
            onContinue={handleContinue}
            setIsQuestionAnswered={setIsQuestionAnswered}
          />
        );
      
      case 'true-false':
        return (
          <TrueFalseQuestion
            key={question.id}
            id={question.id}
            prompt={question.prompt}
            answer={question.answer || ''}
            explanation={question.explanation}
            onContinue={handleContinue}
            setIsQuestionAnswered={setIsQuestionAnswered}
          />
        );
      
      case 'multi-step':
        return (
          <MultiStepQuestion
            key={question.id}
            id={question.id}
            context={question.context || ''}
            steps={question.steps || []}
            onContinue={handleContinue}
            setIsQuestionAnswered={setIsQuestionAnswered}
          />
        );
      
      case 'step-flow':
        return (
          <StepFlowQuestion
            key={question.id}
            id={question.id}
            steps={question.steps || []}
            onContinue={handleContinue}
            setIsQuestionAnswered={setIsQuestionAnswered}
          />
        );
      
      case 'drag-to-sort':
        return (
          <DragToSortQuestion
            key={question.id}
            id={question.id}
            prompt={question.prompt}
            items={(question.items as string[]) || []}
            correct_order={question.correct_order || []}
            onContinue={handleContinue}
            setIsQuestionAnswered={setIsQuestionAnswered}
          />
        );
      
      default:
        return (
          <View key={question.id} style={styles.questionContainer}>
            <ThemedText style={styles.questionTitle}>
              {question.prompt}
            </ThemedText>
            <ThemedText style={styles.unsupportedType}>
              Question type "{question.type}" is not yet supported
            </ThemedText>
          </View>
        );
    }
  };

  const renderDevControls = () => {
    if (!__DEV__ || !lessonData) return null;

    return (
      <View style={styles.devControlsContainer}>
        <View style={styles.devControlsRow}>
          <Pressable
            style={[styles.devButton, styles.devButtonSecondary]}
            onPress={handleDevPrevious}
            disabled={currentQuestionIndex === 0}
          >
            <Ionicons name="chevron-back" size={16} color={colors.primary} />
            <ThemedText style={[styles.devButtonText, { color: colors.primary }]}>Prev</ThemedText>
          </Pressable>
          
          <View style={styles.devQuestionInfo}>
            <ThemedText style={styles.devQuestionText}>
              {currentQuestionIndex + 1} / {lessonData.data.length}
            </ThemedText>
            <ThemedText style={styles.devQuestionType}>
              {lessonData.data[currentQuestionIndex]?.type}
            </ThemedText>
          </View>
          
          <Pressable
            style={[styles.devButton, styles.devButtonPrimary]}
            onPress={handleDevSkip}
            disabled={currentQuestionIndex === lessonData.data.length - 1}
          >
            <ThemedText style={styles.devButtonText}>Skip</ThemedText>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </Pressable>
        </View>
        
        {/* Quick jump buttons for first few questions */}
        <View style={styles.devQuickJumpRow}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Pressable
              key={index}
              style={[
                styles.devQuickJumpButton,
                currentQuestionIndex === index && styles.devQuickJumpButtonActive
              ]}
              onPress={() => handleDevJumpTo(index)}
              disabled={index >= lessonData.data.length}
            >
              <ThemedText style={[
                styles.devQuickJumpText,
                currentQuestionIndex === index && styles.devQuickJumpTextActive
              ]}>
                {index + 1}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#181926' : '#F7F7FA',
    },
    headerWrapper: {
      paddingHorizontal: 0,
      paddingTop: 0,
      backgroundColor: 'transparent',
    },
    headerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 0,
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderRadius: 22,
      backgroundColor: isDark ? colors.surface : '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.10,
      shadowRadius: 16,
      elevation: 8,
      zIndex: 2,
    },
    headerShadow: {
      height: 12,
      marginHorizontal: 32,
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.04)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
      zIndex: 1,
    },
    backButton: {
      padding: 8,
      marginRight: 10,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(120,120,120,0.08)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextContainer: {
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 21,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.1,
    },
    headerSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: '500',
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    progressText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    progressBar: {
      flex: 1,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginHorizontal: 12,
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    questionContainer: {
      backgroundColor: isDark ? colors.surface : '#fff',
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    questionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    unsupportedType: {
      fontSize: 16,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    nextButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 16,
    },
    nextButtonDisabled: {
      backgroundColor: colors.textSecondary,
    },
    nextButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: '600',
    },
    // Dev controls styles
    devControlsContainer: {
      backgroundColor: isDark ? '#2A2A3A' : '#F0F0F5',
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      padding: 12,
      borderWidth: 2,
      borderColor: '#FF6B35',
      borderStyle: 'dashed',
    },
    devControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    devButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 4,
    },
    devButtonPrimary: {
      backgroundColor: '#FF6B35',
    },
    devButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    devButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#fff',
    },
    devQuestionInfo: {
      alignItems: 'center',
    },
    devQuestionText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FF6B35',
    },
    devQuestionType: {
      fontSize: 10,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      fontWeight: '500',
    },
    devQuickJumpRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    devQuickJumpButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? '#3A3A4A' : '#E0E0E5',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    devQuickJumpButtonActive: {
      backgroundColor: '#FF6B35',
      borderColor: '#FF6B35',
    },
    devQuickJumpText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    devQuickJumpTextActive: {
      color: '#fff',
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerWrapper}>
          <View style={styles.headerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <ThemedText style={{ fontSize: 22, marginRight: 8 }}>
                {(subtopicEmojis.subtopic_emojis as any)[subtopicName as string] || '📚'}
              </ThemedText>
              <ThemedText style={[styles.headerTitle, { fontSize: 15, flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">
                {subtopicName}
              </ThemedText>
            </View>
            <Pressable style={styles.backButton} onPress={handleBackPress} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.headerShadow} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={{ marginTop: 12, color: colors.textSecondary }}>
            Loading questions...
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerWrapper}>
          <View style={styles.headerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <ThemedText style={{ fontSize: 22, marginRight: 8 }}>
                {(subtopicEmojis.subtopic_emojis as any)[subtopicName as string] || '📚'}
              </ThemedText>
              <ThemedText style={[styles.headerTitle, { fontSize: 15, flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">
                {subtopicName}
              </ThemedText>
            </View>
            <Pressable style={styles.backButton} onPress={handleBackPress} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.headerShadow} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <ThemedText style={{ marginTop: 16, fontSize: 16, color: colors.text, textAlign: 'center' }}>
            {error}
          </ThemedText>
          <Pressable
            style={[styles.nextButton, { marginTop: 20 }]}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.nextButtonText}>
              Go Back
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!lessonData || lessonData.data.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerWrapper}>
          <View style={styles.headerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <ThemedText style={{ fontSize: 22, marginRight: 8 }}>
                {(subtopicEmojis.subtopic_emojis as any)[subtopicName as string] || '📚'}
              </ThemedText>
              <ThemedText style={[styles.headerTitle, { fontSize: 15, flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">
                {subtopicName}
              </ThemedText>
            </View>
            <Pressable style={styles.backButton} onPress={handleBackPress} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.headerShadow} />
        </View>
        <View style={styles.errorContainer}>
          <ThemedText style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center' }}>
            No questions available for this level
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = lessonData.data[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / lessonData.data.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerWrapper}>
        <View style={styles.headerCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <ThemedText style={{ fontSize: 22, marginRight: 8 }}>
              {(subtopicEmojis.subtopic_emojis as any)[subtopicName as string] || '📚'}
            </ThemedText>
            <ThemedText style={[styles.headerTitle, { fontSize: 15, flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">
              {subtopicName}
            </ThemedText>
          </View>
          <Pressable style={styles.backButton} onPress={handleBackPress} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.primary} />
          </Pressable>
        </View>
        <View style={styles.headerShadow} />
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderDevControls()}
        <View style={styles.progressContainer}>
          <ThemedText style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {lessonData.data.length}
          </ThemedText>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
        {renderQuestion(currentQuestion)}
      </ScrollView>
    </SafeAreaView>
  );
}