import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { SharePromptModal } from '@/components/SharePromptModal';
import { brand } from '@/constants/matric';
import { shouldShowSharePrompt } from '@/utils/sharePrompt';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analytics } from '@/services/analytics';
import {
  AccountingLessonData,
  AccountingQuestion,
  fetchQuestionsByTopicAndLevel,
  shuffleQuestions,
} from '@/services/accounting';
import {
  getCompletedAccountingQuestionIds,
  isPremiumAccountingLevel,
  loadLocalProgress,
  markAccountingLevelCompleted,
  markAccountingQuestionCompleted,
  recordAccountingAttempt,
  resetAccountingLevelQuestions,
  syncProgressFromCloud,
} from '@/services/progress';

import { TapToSelectQuestion } from './components/TapToSelectQuestion';
import { CategoriseQuestion } from './components/CategoriseQuestion';
import { MatchingQuestion } from './components/MatchingQuestion';
import { TrueFalseQuestion } from './components/TrueFalseQuestion';
import { MultiStepQuestion } from './components/MultiStepQuestion';
import { StepFlowQuestion } from './components/StepFlowQuestion';
import { DragToSortQuestion } from './components/DragToSortQuestion';

const STEP_SIZE = 28;
const STEP_GAP = 6;

function levelVisual(name: string): { name: ComponentProps<typeof Ionicons>['name']; color: string } {
  if (name.includes('Level 1')) return { name: 'sparkles', color: '#818CF8' };
  if (name.includes('Level 2')) return { name: 'construct', color: '#FB923C' };
  if (name.includes('Level 3')) return { name: 'search', color: '#38BDF8' };
  return { name: 'flame', color: '#F97316' };
}

export default function AccountingLessonScreen() {
  const { topicId, topicName, subtopicId, subtopicName, levelId, levelName, accessGranted } =
    useLocalSearchParams();
  const [lessonData, setLessonData] = useState<AccountingLessonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [completedQuestionIds, setCompletedQuestionIds] = useState<Set<string>>(new Set());
  const [isQuestionAnswered, setIsQuestionAnswered] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const { user } = useAuth();
  const { isPremium, isLoading: isBillingLoading, presentPaywall } = useRevenueCat();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const icon = levelVisual(String(levelName || ''));
  const stepperRef = useRef<ScrollView>(null);
  const requiresPremium = isPremiumAccountingLevel(String(levelName || ''));
  const grantedFromPaywall = String(accessGranted || '') === '1';
  const [premiumAllowed, setPremiumAllowed] = useState(!requiresPremium || grantedFromPaywall);
  const [showShareModal, setShowShareModal] = useState(false);
  const paywallShownRef = useRef(false);
  const sharePromptOpenRef = useRef(false);

  useEffect(() => {
    if (!requiresPremium || isPremium || grantedFromPaywall) {
      setPremiumAllowed(true);
      return;
    }
    if (isBillingLoading || paywallShownRef.current) return;
    paywallShownRef.current = true;

    const gatePremium = async () => {
      const unlocked = await presentPaywall(user?.uid);
      if (unlocked) {
        setPremiumAllowed(true);
        return;
      }
      router.back();
    };

    void gatePremium();
  }, [requiresPremium, isPremium, grantedFromPaywall, isBillingLoading, user?.uid]);

  useEffect(() => {
    if (!premiumAllowed) return;

    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await fetchQuestionsByTopicAndLevel(
          String(subtopicName),
          String(levelName)
        );

        let progress;
        if (user?.uid) {
          try {
            progress = await syncProgressFromCloud(user.uid);
          } catch {
            progress = await loadLocalProgress();
          }
        } else {
          progress = await loadLocalProgress();
        }

        const completedIds = getCompletedAccountingQuestionIds(
          progress,
          String(subtopicName || ''),
          String(levelName || '')
        );
        const completedSet = new Set(completedIds);
        const firstIncomplete = data.data.findIndex((question) => !completedSet.has(question.id));

        setCompletedQuestionIds(completedSet);
        setCurrentQuestionIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
        setLessonData(data);

        analytics.track('accounting_lesson_started', {
          topic_id: topicId,
          topic_name: topicName,
          subtopic_id: subtopicId,
          subtopic_name: subtopicName,
          level_id: levelId,
          level_name: levelName,
          question_count: data.data.length,
          resumed_at: firstIncomplete === -1 ? 0 : firstIncomplete,
        });
      } catch (err) {
        console.error('Error fetching accounting questions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load questions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [premiumAllowed, topicId, topicName, subtopicId, subtopicName, levelId, levelName, user?.uid]);

  const handleBackPress = () => {
    router.back();
  };

  const saveQuestionCompletion = async (questionId: string) => {
    setCompletedQuestionIds((prev) => {
      if (prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.add(questionId);
      return next;
    });

    try {
      await markAccountingQuestionCompleted({
        subtopicName: String(subtopicName || ''),
        levelName: String(levelName || ''),
        questionId,
        uid: user?.uid,
      });
    } catch (err) {
      console.error('Failed to save accounting question progress:', err);
    }
  };

  const handleNextQuestion = async () => {
    const currentQuestion = lessonData?.data[currentQuestionIndex];
    const completed = new Set(completedQuestionIds);
    if (currentQuestion) {
      completed.add(currentQuestion.id);
      await saveQuestionCompletion(currentQuestion.id);
    }

    const nextAfterCurrent = lessonData?.data.findIndex(
      (question, index) => index > currentQuestionIndex && !completed.has(question.id)
    ) ?? -1;
    const nextIncomplete =
      nextAfterCurrent !== -1
        ? nextAfterCurrent
        : lessonData?.data.findIndex((question) => !completed.has(question.id)) ?? -1;

    if (lessonData && nextIncomplete !== -1) {
      setCurrentQuestionIndex(nextIncomplete);
      setIsQuestionAnswered(false);
      return;
    }

    analytics.track('accounting_lesson_completed', {
      topic_id: topicId,
      topic_name: topicName,
      subtopic_id: subtopicId,
      subtopic_name: subtopicName,
      level_id: levelId,
      level_name: levelName,
      total_questions: lessonData?.data.length || 0,
    });

    try {
      await markAccountingLevelCompleted({
        subtopicName: String(subtopicName || ''),
        levelName: String(levelName || ''),
        uid: user?.uid,
      });
    } catch (err) {
      console.error('Failed to save accounting level completion:', err);
    }
  };

  const handleContinue = () => {
    if (showShareModal || sharePromptOpenRef.current) return;
    if (shouldShowSharePrompt()) {
      sharePromptOpenRef.current = true;
      analytics.track('share_prompt_shown', {
        source: 'lesson',
        topic_name: topicName,
        level_name: levelName,
      });
      setShowShareModal(true);
      return;
    }
    handleNextQuestion();
  };

  const handleShareModalClose = () => {
    sharePromptOpenRef.current = false;
    setShowShareModal(false);
    handleNextQuestion();
  };

  const handleAttempt = useCallback(
    (questionId: string) => (stepId: string, correct: boolean) => {
      void recordAccountingAttempt({
        subtopicName: String(subtopicName || ''),
        levelName: String(levelName || ''),
        questionId,
        stepId,
        correct,
        uid: user?.uid,
      });
    },
    [subtopicName, levelName, user?.uid]
  );

  const handleRestart = async () => {
    if (isRestarting) return;
    setIsRestarting(true);
    try {
      await resetAccountingLevelQuestions({
        subtopicName: String(subtopicName || ''),
        levelName: String(levelName || ''),
        uid: user?.uid,
      });
      setCompletedQuestionIds(new Set());
      setCurrentQuestionIndex(0);
      setIsQuestionAnswered(false);
      if (/level\s*1/i.test(String(levelName || '')) && lessonData) {
        setLessonData({
          ...lessonData,
          data: shuffleQuestions(lessonData.data),
        });
      }
      analytics.track('accounting_lesson_restarted', {
        topic_id: topicId,
        topic_name: topicName,
        subtopic_id: subtopicId,
        subtopic_name: subtopicName,
        level_id: levelId,
        level_name: levelName,
        question_count: lessonData?.data.length || 0,
      });
    } catch (err) {
      console.error('Failed to restart accounting lesson:', err);
    } finally {
      setIsRestarting(false);
    }
  };

  useEffect(() => {
    if (!lessonData) return;
    stepperRef.current?.scrollTo({
      x: Math.max(0, currentQuestionIndex * (STEP_SIZE + STEP_GAP) - 80),
      animated: true,
    });
  }, [currentQuestionIndex, lessonData]);

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
            onAttempt={handleAttempt(question.id)}
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
            onAttempt={handleAttempt(question.id)}
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
            onAttempt={handleAttempt(question.id)}
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
            onAttempt={handleAttempt(question.id)}
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
            onAttempt={handleAttempt(question.id)}
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
            onAttempt={handleAttempt(question.id)}
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
            onAttempt={handleAttempt(question.id)}
          />
        );

      default:
        return (
          <View key={question.id} style={styles.questionCard}>
            <ThemedText style={styles.questionTitle}>{question.prompt}</ThemedText>
            <ThemedText style={styles.unsupportedType}>
              Question type "{question.type}" is not yet supported
            </ThemedText>
          </View>
        );
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable
        onPress={handleBackPress}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={24} color={brand.primarySoft} />
      </Pressable>
      <View style={[styles.headerIcon, { backgroundColor: icon.color }]}>
        <Ionicons name={icon.name} size={18} color="#FFFFFF" />
      </View>
      <View style={styles.headerCopy}>
        <ThemedText style={styles.headerTitle} numberOfLines={2}>
          {String(subtopicName || 'Lesson')}
        </ThemedText>
        {!!levelName && (
          <ThemedText style={styles.headerSubtitle} numberOfLines={1}>
            {String(levelName)}
          </ThemedText>
        )}
      </View>
    </View>
  );

  const renderQuestionStepper = (allComplete: boolean) => {
    if (!lessonData) return null;

    return (
      <View style={styles.stepperCard}>
        <ThemedText style={styles.stepperLabel}>
          {completedQuestionIds.size} of {lessonData.data.length} done
        </ThemedText>
        <ScrollView
          ref={stepperRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stepperRow}
        >
          {lessonData.data.map((question, index) => {
            const done = completedQuestionIds.has(question.id);
            const current = !allComplete && index === currentQuestionIndex;
            return (
              <View
                key={question.id}
                style={[
                  styles.stepDot,
                  done && styles.stepDotDone,
                  current && styles.stepDotCurrent,
                ]}
                accessibilityLabel={
                  done
                    ? `Question ${index + 1}, done`
                    : current
                      ? `Question ${index + 1}, current`
                      : `Question ${index + 1}`
                }
              >
                {done && !current ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <ThemedText
                    style={[
                      styles.stepDotText,
                      current && styles.stepDotTextCurrent,
                      done && current && styles.stepDotTextDone,
                    ]}
                  >
                    {index + 1}
                  </ThemedText>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderCompleteCard = (questionCount: number) => (
    <View style={styles.completeCard}>
      <View style={styles.completeIcon}>
        <Ionicons name="checkmark-done" size={28} color={brand.primarySoft} />
      </View>
      <ThemedText style={styles.completeTitle}>Level complete</ThemedText>
      <ThemedText style={styles.completeBody}>
        You finished all {questionCount} question{questionCount === 1 ? '' : 's'}. Restart to practise them again.
      </ThemedText>
      <Pressable
        onPress={handleRestart}
        disabled={isRestarting}
        accessibilityRole="button"
        accessibilityLabel="Restart this level"
        style={({ pressed }) => [
          styles.restartButton,
          pressed && !isRestarting && styles.pressed,
          isRestarting && styles.restartButtonDisabled,
        ]}
      >
        {isRestarting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <ThemedText style={styles.restartButtonText}>Restart</ThemedText>
          </>
        )}
      </Pressable>
      <Pressable
        onPress={handleBackPress}
        disabled={isRestarting}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
      >
        <ThemedText style={styles.doneButtonText}>Done</ThemedText>
      </Pressable>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={brand.primary} />
          <ThemedText style={styles.muted}>Loading questions...</ThemedText>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={styles.centered}>
          <View style={styles.statusIcon}>
            <Ionicons name="alert-circle" size={28} color={brand.rose} />
          </View>
          <ThemedText style={styles.statusTitle}>{error}</ThemedText>
          <Pressable
            onPress={handleBackPress}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <ThemedText style={styles.primaryButtonText}>Go back</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!lessonData || lessonData.data.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={styles.centered}>
          <ThemedText style={styles.statusTitle}>No questions available for this level</ThemedText>
          <Pressable
            onPress={handleBackPress}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <ThemedText style={styles.primaryButtonText}>Go back</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const currentQuestion = lessonData.data[currentQuestionIndex];
  const completedCount = completedQuestionIds.size;
  const allComplete =
    lessonData.data.length > 0 &&
    lessonData.data.every((question) => completedQuestionIds.has(question.id));
  const progress = allComplete
    ? 100
    : (completedCount / lessonData.data.length) * 100;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {renderHeader()}

      <View style={styles.progressWrap}>
        <ThemedText style={styles.progressLabel}>
          {allComplete
            ? `${lessonData.data.length} OF ${lessonData.data.length} COMPLETE`
            : `QUESTION ${currentQuestionIndex + 1} OF ${lessonData.data.length}`}
        </ThemedText>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {renderQuestionStepper(allComplete)}
        {allComplete ? (
          renderCompleteCard(lessonData.data.length)
        ) : (
          <View style={styles.questionCard}>{renderQuestion(currentQuestion)}</View>
        )}
      </ScrollView>

      <SharePromptModal
        visible={showShareModal}
        source="lesson"
        onClose={handleShareModalClose}
      />
    </View>
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: brand.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: brand.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  progressWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  progressLabel: {
    color: brand.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: brand.cardElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: brand.primarySoft,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  questionCard: {
    backgroundColor: 'transparent',
    borderRadius: 22,
    padding: 0,
  },
  questionTitle: {
    color: brand.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  unsupportedType: {
    color: brand.textSecondary,
    fontSize: 15,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  muted: {
    color: brand.textSecondary,
    marginTop: 12,
    fontSize: 15,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: brand.oopsieBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statusTitle: {
    color: brand.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18,
  },
  primaryButton: {
    backgroundColor: brand.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  stepperCard: {
    marginBottom: 14,
  },
  stepperLabel: {
    color: brand.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: STEP_GAP,
    paddingRight: 8,
  },
  stepDot: {
    width: STEP_SIZE,
    height: STEP_SIZE,
    borderRadius: STEP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.cardElevated,
    borderWidth: 1,
    borderColor: brand.border,
  },
  stepDotDone: {
    backgroundColor: brand.emerald,
    borderColor: brand.emerald,
  },
  stepDotCurrent: {
    backgroundColor: brand.primary,
    borderColor: brand.primary,
  },
  stepDotText: {
    color: brand.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  stepDotTextCurrent: {
    color: '#FFFFFF',
  },
  stepDotTextDone: {
    color: '#FFFFFF',
  },
  completeCard: {
    backgroundColor: brand.cardElevated,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: brand.border,
  },
  completeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: brand.bullseyeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  completeTitle: {
    color: brand.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  completeBody: {
    color: brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
  },
  restartButton: {
    backgroundColor: brand.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minHeight: 52,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  restartButtonDisabled: {
    opacity: 0.7,
  },
  restartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  doneButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  doneButtonText: {
    color: brand.primarySoft,
    fontSize: 15,
    fontWeight: '700',
  },
});
