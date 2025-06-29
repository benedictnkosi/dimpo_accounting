import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, Alert, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analytics } from '@/services/analytics';
import { useDatabase } from '@/hooks/useDatabase';
import { getQuestionsByTopicAndLevel, getIncorrectQuestionsByTopicAndLevel, getTopicsByMainTopic, isLevelCompleted } from '@/services/database';
import { DailyLimitBanner } from './components/DailyLimitBanner';
import { MilestoneModal } from './components/MilestoneModal';
import { getCombinedLimitInfo } from '@/services/lifetimeStats';
import { CombinedLimitInfo } from '@/services/lifetimeStats';

// Import question components
import { TapToSelectQuestion } from './components/TapToSelectQuestion';
import { CategoriseQuestion } from './components/CategoriseQuestion';
import { TrueFalseQuestion } from './components/TrueFalseQuestion';
import { MultiStepQuestion } from './components/MultiStepQuestion';
import { StepFlowQuestion } from './components/StepFlowQuestion';
import { DragToSortQuestion } from './components/DragToSortQuestion';

import subtopicEmojis from '@/assets/subtopic_emojis.json';
import subtopicEmojisData from '@/assets/subtopic_emojis.json';

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

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function AccountingLessonScreen() {
  const { topicId, topicName, subtopicId, subtopicName, levelId, levelName, retry } = useLocalSearchParams();
  const [lessonData, setLessonData] = useState<AccountingLessonData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isQuestionAnswered, setIsQuestionAnswered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [combinedLimitInfo, setCombinedLimitInfo] = useState<CombinedLimitInfo | null>(null);
  const [milestoneModal, setMilestoneModal] = useState<{
    visible: boolean;
    milestone: '75' | '50' | '25';
    message: string;
  }>({
    visible: false,
    milestone: '75',
    message: ''
  });
  
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { isInitialized, isLoading: isDatabaseLoading } = useDatabase();
  const { customerInfo, showPaywall } = useRevenueCat();

  // Load combined limit info
  const loadCombinedLimitInfo = useCallback(async () => {
    if (customerInfo) {
      try {
        const limitInfo = await getCombinedLimitInfo(customerInfo);
        setCombinedLimitInfo(limitInfo);
      } catch (error) {
        console.error('Error loading combined limit info:', error);
      }
    }
  }, [customerInfo]);

  // Load combined limit info when customer info changes
  useEffect(() => {
    loadCombinedLimitInfo();
  }, [loadCombinedLimitInfo]);

  // 1. Add a handler to refresh combined limit info after a question is answered
  const handleQuestionAnswered = useCallback(() => {
    loadCombinedLimitInfo();
  }, [loadCombinedLimitInfo]);

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!isInitialized) {
        return; // Wait for database to be initialized
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // First, get the topic ID from the database using the subtopic name
        const topics = await getTopicsByMainTopic(topicName as string);
        const targetTopic = topics.find(topic => topic.sub_topic === subtopicName);
        
        if (!targetTopic) {
          throw new Error(`Topic not found: ${subtopicName}`);
        }

        // Check if we're in retry mode
        const isRetryMode = retry === 'true';
        
        // Get questions from database for this topic and level
        let dbQuestions;
        if (isRetryMode) {
          dbQuestions = await getIncorrectQuestionsByTopicAndLevel(targetTopic.id, levelName as string);
          if (dbQuestions.length === 0) {
            throw new Error('No incorrect questions found for this level. Great job!');
          }
        } else {
          dbQuestions = await getQuestionsByTopicAndLevel(targetTopic.id, levelName as string);
        }
        
        // Convert database questions to the expected format
        const convertedQuestions: AccountingQuestion[] = dbQuestions.map(dbQuestion => {
          const baseQuestion: AccountingQuestion = {
            id: dbQuestion.question_id,
            type: dbQuestion.question_type,
            prompt: dbQuestion.prompt,
            explanation: dbQuestion.explanation || undefined
          };

          // Parse JSON fields based on question type
          switch (dbQuestion.question_type) {
            case 'tap-to-select':
              if (dbQuestion.options) {
                baseQuestion.options = JSON.parse(dbQuestion.options);
              }
              baseQuestion.answer = dbQuestion.answer || undefined;
              break;
            
            case 'matching':
              if (dbQuestion.pairs) {
                baseQuestion.pairs = JSON.parse(dbQuestion.pairs);
              }
              break;
            
            case 'categorise':
              if (dbQuestion.categories) {
                baseQuestion.categories = JSON.parse(dbQuestion.categories);
              }
              if (dbQuestion.items) {
                baseQuestion.items = JSON.parse(dbQuestion.items);
              }
              break;
            
            case 'true-false':
              baseQuestion.answer = dbQuestion.answer || undefined;
              break;
            
            case 'multi-step':
              baseQuestion.context = dbQuestion.context || undefined;
              if (dbQuestion.steps) {
                baseQuestion.steps = JSON.parse(dbQuestion.steps);
              }
              break;
            
            case 'step-flow':
              if (dbQuestion.steps) {
                baseQuestion.steps = JSON.parse(dbQuestion.steps);
              }
              break;
            
            case 'drag-to-sort':
              if (dbQuestion.items) {
                baseQuestion.items = JSON.parse(dbQuestion.items);
              }
              if (dbQuestion.correct_order) {
                baseQuestion.correct_order = JSON.parse(dbQuestion.correct_order);
              }
              break;
          }

          return baseQuestion;
        });

        // Shuffle the questions
        const shuffledQuestions = shuffleArray(convertedQuestions);

        const lessonData: AccountingLessonData = {
          topic: topicName as string,
          level: levelName as string,
          data: shuffledQuestions
        };

        setLessonData(lessonData);
        
        analytics.track('accounting_lesson_started', {
          topic_id: topicId,
          topic_name: topicName,
          subtopic_id: subtopicId,
          subtopic_name: subtopicName,
          level_id: levelId,
          level_name: levelName,
          question_count: shuffledQuestions.length,
          is_retry_mode: isRetryMode
        });
        
      } catch (err) {
        console.error('Error fetching accounting questions from database:', err);
        setError(err instanceof Error ? err.message : 'Failed to load questions from database');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [isInitialized, topicId, topicName, subtopicId, subtopicName, levelId, levelName, retry]);

  const handleBackPress = () => {
    router.back();
  };

  const handleNextQuestion = async () => {
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

      // Check if level is completed
      try {
        if (topicId && levelName) {
          const topicIdNum = parseInt(topicId as string);
          if (!isNaN(topicIdNum)) {
            const levelCompleted = await isLevelCompleted(topicIdNum, levelName as string);
            if (levelCompleted) {
              analytics.track('level_completed', {
                topic_id: topicId,
                topic_name: topicName,
                subtopic_id: subtopicId,
                subtopic_name: subtopicName,
                level_id: levelId,
                level_name: levelName
              });
            }
          }
        }
      } catch (error) {
        console.error('Error checking level completion:', error);
      }
      
      // Navigate back to subtopics
      router.back();
    }
  };

  const handleContinue = () => {
    handleNextQuestion();
  };

  // Handle milestone notification
  const handleMilestoneNotification = (milestoneNotification: {
    shouldShow: boolean;
    milestone: '75' | '50' | '25' | null;
    message: string;
  }) => {
    if (milestoneNotification.shouldShow && milestoneNotification.milestone) {
      setMilestoneModal({
        visible: true,
        milestone: milestoneNotification.milestone,
        message: milestoneNotification.message
      });
    }
  };

  // Close milestone modal
  const handleCloseMilestoneModal = () => {
    setMilestoneModal(prev => ({ ...prev, visible: false }));
  };

  // 2. Pass onQuestionAnswered to each question component
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
            onMilestoneNotification={handleMilestoneNotification}
            onQuestionAnswered={handleQuestionAnswered}
          />
        );

      
      case 'categorise':
        return (
          <CategoriseQuestion
            key={question.id}
            id={question.id}
            prompt={question.prompt}
            categories={question.categories || []}
            items={(question.items as Record<string, string>) || {}}
            onContinue={handleContinue}
            setIsQuestionAnswered={setIsQuestionAnswered}
            onMilestoneNotification={handleMilestoneNotification}
            onQuestionAnswered={handleQuestionAnswered}
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
            onMilestoneNotification={handleMilestoneNotification}
            onQuestionAnswered={handleQuestionAnswered}
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
            onMilestoneNotification={handleMilestoneNotification}
            onQuestionAnswered={handleQuestionAnswered}
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
            onMilestoneNotification={handleMilestoneNotification}
            onQuestionAnswered={handleQuestionAnswered}
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
            onMilestoneNotification={handleMilestoneNotification}
            onQuestionAnswered={handleQuestionAnswered}
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
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: 0.1,
    },
    headerSubtitle: {
      fontSize: 14,
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
  });

  if (isLoading || isDatabaseLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.progressText}>Loading questions...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerWrapper}>
          <View style={styles.headerCard}>
            <Pressable style={styles.backButton} onPress={handleBackPress}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.headerTitle}>
                {subtopicName}
              </ThemedText>
              <ThemedText style={styles.headerSubtitle}>
                {levelName}
              </ThemedText>
            </View>
          </View>
          <View style={styles.headerShadow} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <ThemedText style={[styles.questionTitle, { textAlign: 'center', marginTop: 16 }]}>
            {error}
          </ThemedText>
          <Pressable style={styles.nextButton} onPress={handleBackPress}>
            <ThemedText style={styles.nextButtonText}>Go Back</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!lessonData) {
    return (
      <SafeAreaView style={styles.container}>
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

  // Check if any limit is reached
  const isAnyLimitReached = combinedLimitInfo?.daily.isLimitReached || combinedLimitInfo?.lifetime.isLimitReached;

  // Fix for TypeScript index signature error
  const emojiMap = (subtopicEmojisData as any).subtopic_emojis as Record<string, string>;
  const subtopicEmoji = emojiMap[subtopicName as string] || '📘';

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ['#181926', '#23243a'] : ['#F7F7FA', '#FFE3D6']}
        style={{ flex: 1 }}
      >
        <View style={styles.headerWrapper}>
          <LinearGradient
            colors={isDark ? ['#23243a', '#181926'] : ['#fff', '#f7e7e1']}
            style={styles.headerCard}
          >
            <Pressable style={styles.backButton} onPress={handleBackPress}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.headerTitle}>
                <Text>{subtopicEmoji} </Text>
                {subtopicName}
              </ThemedText>
              <ThemedText style={styles.headerSubtitle}>
                {levelName}
              </ThemedText>
            </View>
          </LinearGradient>
          <View style={styles.headerShadow} />
        </View>
        {/* Always show the limit banner if we have info */}
        {combinedLimitInfo && (
          <DailyLimitBanner 
            combinedLimitInfo={combinedLimitInfo}
            showUpgradeButton={isAnyLimitReached}
          />
        )}
        {/* Only show questions if no limit is reached */}
        {!isAnyLimitReached && (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
        )}
        {/* Milestone Modal */}
        <MilestoneModal
          visible={milestoneModal.visible}
          milestone={milestoneModal.milestone}
          message={milestoneModal.message}
          onClose={handleCloseMilestoneModal}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}