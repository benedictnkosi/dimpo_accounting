import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/ThemedText';
import { MathText } from '@/components/math/MathText';
import { ExplanationModal } from '@/components/ExplanationModal';
import { SharePromptModal } from '@/components/SharePromptModal';
import { brand, SHARE_URL } from '@/constants/matric';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPracticedTotal,
  loadPracticeQuestion,
  pickPracticeQuestion,
  PracticeStep,
  prepareStepOptions,
} from '@/services/practice';
import {
  LearnerProgress,
  loadLocalProgress,
  markPracticeCompleted,
} from '@/services/progress';
import { QuizQuestion, resolveStorageImageUrl } from '@/services/questions';
import { generateExplanation } from '@/services/explanation';
import { logAnalyticsEvent } from '@/services/analytics';
import { shareContent } from '@/utils/share';
import { shouldShowSharePrompt } from '@/utils/sharePrompt';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function PracticeWalkthroughScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    questionId?: string;
    topic?: string;
    from?: string;
  }>();

  const fromHub = params.from !== 'quiz';
  const topicParam = typeof params.topic === 'string' ? params.topic : '';

  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [steps, setSteps] = useState<PracticeStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSkipping, setIsSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState('Share');
  const [showExplain, setShowExplain] = useState(false);
  const [sessionExplanation, setSessionExplanation] = useState('');
  const [showPreviousAnswers, setShowPreviousAnswers] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<
    { prompt: string; answer: string; correct: boolean }[]
  >([]);
  const loggedStartId = useRef<string | null>(null);
  const stepResultsRef = useRef<boolean[]>([]);
  const pendingProgressRef = useRef<LearnerProgress | null>(null);

  const practicedCount = progress ? getPracticedTotal(progress) : 0;
  const currentStep = steps[stepIndex];
  const isChecked = selected != null;
  const isCorrect = !!selected && !!currentStep && selected === currentStep.answer;
  const progressRatio = steps.length
    ? (isComplete ? 1 : (stepIndex + (isChecked ? 1 : 0)) / steps.length)
    : 0;
  const explanation =
    sessionExplanation.trim() || question?.aiExplanation?.trim() || '';

  const backLabel = fromHub ? 'Back to home' : 'Back to quiz';

  const handleBack = useCallback(() => {
    if (fromHub) {
      router.replace('/(tabs)');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, [fromHub]);

  const bootstrapQuestion = useCallback(async (questionId: string) => {
    setIsLoading(true);
    setError(null);
    setIsComplete(false);
    setSelected(null);
    setShowHint(false);
    setStepIndex(0);
    setBanner(null);
    setSessionExplanation('');
    setShowExplain(false);

    try {
      const local = await loadLocalProgress();
      setProgress(local);

      const result = await loadPracticeQuestion(questionId);
      if ('error' in result) {
        setError(result.error);
        setQuestion(null);
        setSteps([]);
        return;
      }

      setQuestion(result.question);
      setSteps(result.steps);
      setOptions(prepareStepOptions(result.steps[0]));
      setCompletedSteps([]);
      setShowPreviousAnswers(false);
      stepResultsRef.current = [];

      if (loggedStartId.current !== result.question.id) {
        loggedStartId.current = result.question.id;
        logAnalyticsEvent('start_practice', {
          question_id: result.question.id,
          subject: result.question.name,
        });
      }

      const urls = await Promise.all([
        resolveStorageImageUrl(result.question.image_path),
        resolveStorageImageUrl(result.question.image_path_2),
      ]);
      setImageUrls(urls.filter((url): url is string => !!url));
    } catch (err) {
      console.error('Failed to load practice walkthrough:', err);
      setError('This question could not be found.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const questionId = typeof params.questionId === 'string' ? params.questionId : '';
    if (!questionId) {
      setError('This question could not be found.');
      setIsLoading(false);
      return;
    }
    bootstrapQuestion(questionId);
  }, [params.questionId, bootstrapQuestion]);

  const topicName = useMemo(() => {
    return topicParam || question?.topic || 'Accounting';
  }, [topicParam, question?.topic]);

  const handleSelect = useCallback(
    (option: string) => {
      if (selected || !currentStep) return;
      setSelected(option);
      const stepCorrect = option === currentStep.answer;
      stepResultsRef.current[stepIndex] = stepCorrect;
      setCompletedSteps((prev) => {
        const next = [...prev];
        next[stepIndex] = {
          prompt: currentStep.prompt,
          answer: currentStep.answer,
          correct: stepCorrect,
        };
        return next;
      });
    },
    [selected, currentStep, stepIndex]
  );

  const isLastStep = stepIndex >= steps.length - 1;
  const lastStepSummary = useMemo(() => {
    if (!isChecked || !isLastStep || !currentStep) return null;
    const lastCorrect = selected === currentStep.answer;
    const priorCorrect = completedSteps
      .slice(0, stepIndex)
      .filter((step) => step.correct).length;
    const correctCount = priorCorrect + (lastCorrect ? 1 : 0);
    const incorrectCount = Math.max(0, steps.length - correctCount);
    return { correctCount, incorrectCount };
  }, [isChecked, isLastStep, currentStep, selected, completedSteps, stepIndex, steps.length]);

  const goToNextQuestion = useCallback(
    async (
      fromProgress: LearnerProgress,
      options?: { excludeId?: string; completeOnFail?: boolean }
    ) => {
      if (isSkipping) return;
      setIsSkipping(true);
      setBanner(null);
      try {
        const result = await pickPracticeQuestion(
          topicName,
          fromProgress,
          options?.excludeId ?? question?.id
        );
        if (result.status === 'exhausted') {
          if (options?.completeOnFail) setIsComplete(true);
          setBanner(
            `You've practiced all questions for ${topicName.split(':')[0].trim()}. Choose another topic.`
          );
          return;
        }
        if (result.status === 'error') {
          if (options?.completeOnFail) setIsComplete(true);
          setBanner(result.message || 'Could not load the next question.');
          return;
        }

        router.replace({
          pathname: '/practice-walkthrough',
          params: {
            questionId: result.question.id,
            topic: topicName,
            from: fromHub ? 'hub' : 'quiz',
          },
        });
      } catch (err) {
        console.error('Failed to load next practice question:', err);
        if (options?.completeOnFail) setIsComplete(true);
        setBanner('Could not load the next question.');
      } finally {
        setIsSkipping(false);
      }
    },
    [fromHub, isSkipping, question?.id, topicName]
  );

  const handleNextStep = useCallback(async () => {
    if (!currentStep || !question || showShareModal) return;
    const stepCorrect = selected === currentStep.answer;
    stepResultsRef.current[stepIndex] = stepCorrect;
    const nextCompleted = [...completedSteps];
    nextCompleted[stepIndex] = {
      prompt: currentStep.prompt,
      answer: currentStep.answer,
      correct: stepCorrect,
    };
    setCompletedSteps(nextCompleted);
    logAnalyticsEvent('practice_step_complete', {
      question_id: question.id,
      subject: question.name,
      step_number: currentStep.step_number,
      step_index: stepIndex + 1,
      total_steps: steps.length,
      correct: stepCorrect ? 'true' : 'false',
    });

    if (stepIndex >= steps.length - 1) {
      const results = stepResultsRef.current;
      logAnalyticsEvent('maths_steps_question_complete', {
        question_id: question.id,
        subject: question.name,
        topic: question.topic,
        sub_topic: question.subTopic,
        total_steps: steps.length,
        steps_correct: results.filter(Boolean).length,
        steps_incorrect: results.filter((value) => value === false).length,
        completed_to_end: 'true',
      });
      const nextProgress = await markPracticeCompleted({
        questionId: question.id,
        topicName,
        uid: user?.uid,
      });
      setProgress(nextProgress);
      pendingProgressRef.current = nextProgress;
      if (shouldShowSharePrompt()) {
        logAnalyticsEvent('share_prompt_shown', {
          source: 'practice',
          question_id: question.id,
          subject: question.name,
        });
        setShowShareModal(true);
        return;
      }
      await goToNextQuestion(nextProgress, { excludeId: question.id, completeOnFail: true });
      return;
    }

    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    setOptions(prepareStepOptions(steps[nextIndex]));
    setSelected(null);
    setShowHint(false);
  }, [
    completedSteps,
    currentStep,
    goToNextQuestion,
    question,
    selected,
    showShareModal,
    stepIndex,
    steps,
    topicName,
    user?.uid,
  ]);

  const loadNextQuestion = useCallback(async () => {
    if (!progress || showShareModal) return;
    await goToNextQuestion(progress);
  }, [goToNextQuestion, progress, showShareModal]);

  const handleShareModalClose = useCallback(async () => {
    setShowShareModal(false);
    const nextProgress = pendingProgressRef.current || progress;
    if (!nextProgress) return;
    await goToNextQuestion(nextProgress, { excludeId: question?.id, completeOnFail: true });
  }, [goToNextQuestion, progress, question?.id]);

  const handlePracticeAgain = useCallback(() => {
    if (!steps.length) return;
    setIsComplete(false);
    setStepIndex(0);
    setOptions(prepareStepOptions(steps[0]));
    setSelected(null);
    setShowHint(false);
    setBanner(null);
    setCompletedSteps([]);
    setShowPreviousAnswers(false);
    stepResultsRef.current = [];
  }, [steps]);

  const handleShare = useCallback(async () => {
    if (!question) return;
    const message = `Practice this Grade 12 Accounting question step-by-step with Accounting CPA QUIZ.\n${SHARE_URL}`;
    const result = await shareContent({ message, url: SHARE_URL, title: 'Accounting CPA QUIZ' });
    if (!result.ok || !result.method) return;
    logAnalyticsEvent('share', {
      method: result.method,
      content_type: 'question',
      question_id: question.id,
      subject: question.name,
    });
    setShareLabel('Copied');
    setTimeout(() => setShareLabel('Share'), 2000);
  }, [question]);

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={brand.primary} />
      </View>
    );
  }

  if (error || !question || !currentStep) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.localHeader}>
          <Pressable onPress={handleBack} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={20} color={brand.primary} />
            <ThemedText style={styles.headerBackText}>{backLabel}</ThemedText>
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={36} color={brand.amber} />
          <ThemedText style={styles.errorText}>
            {error || 'This question could not be found.'}
          </ThemedText>
          <Pressable style={styles.primaryButton} onPress={handleBack}>
            <ThemedText style={styles.primaryButtonText}>{backLabel}</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isComplete) {
    const correctCount = completedSteps.filter((step) => step.correct).length;
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.localHeader}>
          <Pressable onPress={handleBack} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={20} color={brand.primary} />
            <ThemedText style={styles.headerBackText}>{backLabel}</ThemedText>
          </Pressable>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.completeContent, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.partyIcon}>
            <Ionicons name="checkmark-done" size={28} color={brand.primarySoft} />
          </View>
          <ThemedText style={styles.completeTitle}>All steps completed</ThemedText>
          <ThemedText style={styles.completeBody}>
            You finished all {steps.length} step{steps.length === 1 ? '' : 's'} of this question.
          </ThemedText>
          <ThemedText style={styles.completeMeta}>
            {correctCount} of {steps.length} correct · {practicedCount} question
            {practicedCount === 1 ? '' : 's'} practiced
          </ThemedText>

          <View style={styles.recapCard}>
            <ThemedText style={styles.recapLabel}>YOUR STEPS</ThemedText>
            {completedSteps.map((step, index) => (
              <View
                key={`${step.prompt}-${index}`}
                style={[
                  styles.recapRow,
                  index === completedSteps.length - 1 && styles.recapRowLast,
                ]}
              >
                <View
                  style={[
                    styles.recapBadge,
                    step.correct ? styles.recapBadgeCorrect : styles.recapBadgeIncorrect,
                  ]}
                >
                  <Ionicons
                    name={step.correct ? 'checkmark' : 'close'}
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.recapCopy}>
                  <ThemedText style={styles.recapStep}>Step {index + 1}</ThemedText>
                  <MathText
                    content={step.prompt}
                    color={brand.textSecondary}
                    style={styles.recapPrompt}
                  />
                  <MathText
                    content={step.answer}
                    color={brand.text}
                    style={styles.recapAnswer}
                  />
                </View>
              </View>
            ))}
          </View>

          {!!banner && (
            <View style={styles.banner}>
              <ThemedText style={styles.bannerText}>{banner}</ThemedText>
            </View>
          )}

          <Pressable
            style={[styles.primaryButton, isSkipping && styles.disabled]}
            disabled={isSkipping}
            onPress={loadNextQuestion}
          >
            {isSkipping ? (
              <ThemedText style={styles.primaryButtonText}>Loading next question…</ThemedText>
            ) : (
              <ThemedText style={styles.primaryButtonText}>Next question →</ThemedText>
            )}
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handlePracticeAgain}>
            <ThemedText style={styles.secondaryButtonText}>Practice again</ThemedText>
          </Pressable>

          <Pressable onPress={() => router.replace('/(tabs)')}>
            <ThemedText style={styles.textLink}>Choose another topic</ThemedText>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.localHeader}>
        <Pressable onPress={handleBack} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={20} color={brand.primary} />
          <ThemedText style={styles.headerBackText}>{backLabel}</ThemedText>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setShowExplain(true)} style={styles.headerAction}>
            <Ionicons name="sparkles" size={16} color={brand.primarySoft} />
            <ThemedText style={styles.headerActionText}>
              {explanation ? 'Explanation' : 'Explain'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={handleShare} style={styles.headerAction}>
            <Ionicons name="share-outline" size={18} color={brand.textSecondary} />
            <ThemedText style={styles.headerActionText}>{shareLabel}</ThemedText>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepMetaRow}>
          <View style={styles.stepChip}>
            <ThemedText style={styles.stepChipText}>
              Step {stepIndex + 1} of {steps.length}
            </ThemedText>
          </View>
          <ThemedText style={styles.practicedMeta}>{practicedCount} practiced</ThemedText>
        </View>

        <View style={styles.progressTrack}>
          <LinearGradient
            colors={['#14B8A6', '#22C55E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${Math.max(6, progressRatio * 100)}%` }]}
          />
        </View>

        {!!banner && (
          <View style={styles.banner}>
            <ThemedText style={styles.bannerText}>{banner}</ThemedText>
          </View>
        )}

        <View style={styles.questionCard}>
          {!!question.context && (
            <MathText
              content={question.context}
              color={brand.textSecondary}
              style={styles.contextText}
            />
          )}
          <MathText
            content={question.question}
            color={brand.text}
            centered
            style={styles.questionText}
          />
          {imageUrls.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.diagram} resizeMode="contain" />
          ))}
        </View>

        <View style={styles.stepCard}>
          <MathText
            content={currentStep.prompt}
            color={brand.text}
            style={styles.promptText}
          />
          {!!currentStep.expression && (
            <View style={styles.expressionGap}>
              <MathText content={currentStep.expression} mode="expression" centered />
            </View>
          )}
          {!!currentStep.hint && !showHint && (
            <Pressable style={styles.hintButton} onPress={() => setShowHint(true)}>
              <Ionicons name="bulb-outline" size={16} color={brand.amber} />
              <ThemedText style={styles.hintButtonText}>Show hint</ThemedText>
            </Pressable>
          )}
          {!!currentStep.hint && showHint && (
            <View style={styles.hintCallout}>
              <MathText content={currentStep.hint} color={brand.amber} style={styles.hintText} />
            </View>
          )}
        </View>

        {stepIndex > 0 && completedSteps.length > 0 && (
          <View style={styles.previousWrap}>
            <Pressable
              style={styles.previousToggle}
              onPress={() => setShowPreviousAnswers((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={
                showPreviousAnswers ? 'Hide previous answers' : 'Show previous answers'
              }
            >
              <ThemedText style={styles.previousToggleText}>
                {showPreviousAnswers ? 'Hide previous answers' : 'Show previous answers'}
              </ThemedText>
              <Ionicons
                name={showPreviousAnswers ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={brand.primary}
              />
            </Pressable>
            {showPreviousAnswers && (
              <View style={styles.previousTable}>
                <View style={styles.previousHeader}>
                  <ThemedText style={[styles.previousHeaderText, styles.previousQuestionCol]}>
                    Question
                  </ThemedText>
                  <ThemedText style={[styles.previousHeaderText, styles.previousAnswerCol]}>
                    Answer
                  </ThemedText>
                </View>
                {completedSteps.slice(0, stepIndex).map((step, index) => (
                  <View
                    key={`${step.prompt}-${index}`}
                    style={[
                      styles.previousRow,
                      index === stepIndex - 1 && styles.previousRowLast,
                    ]}
                  >
                    <View style={styles.previousQuestionCol}>
                      <ThemedText style={styles.previousStepLabel}>Step {index + 1}</ThemedText>
                      <MathText
                        content={step.prompt}
                        color={brand.textSecondary}
                        style={styles.previousCellText}
                      />
                    </View>
                    <View style={styles.previousAnswerCol}>
                      <MathText
                        content={step.answer}
                        color={brand.text}
                        style={styles.previousAnswerText}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.options}>
          {options.map((option, index) => {
            const letter = OPTION_LETTERS[index] || `${index + 1}`;
            const isSelected = selected === option;
            const isAnswer = option === currentStep.answer;
            const showCorrect = isChecked && isAnswer;
            const showIncorrect = isChecked && isSelected && !isAnswer;
            const dimOthers = isChecked && !showCorrect && !showIncorrect;

            return (
              <Pressable
                key={`${option}-${index}`}
                disabled={isChecked}
                onPress={() => handleSelect(option)}
                style={[
                  styles.optionCard,
                  showCorrect && styles.optionCorrect,
                  showIncorrect && styles.optionIncorrect,
                  dimOthers && styles.optionDimmed,
                ]}
              >
                <View
                  style={[
                    styles.optionBadge,
                    showCorrect && styles.optionBadgeCorrect,
                    showIncorrect && styles.optionBadgeIncorrect,
                  ]}
                >
                  {showCorrect ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : showIncorrect ? (
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.optionLetter}>{letter}</ThemedText>
                  )}
                </View>
                <View style={styles.optionContent}>
                  <MathText
                    content={option}
                    color={brand.text}
                    strikethrough={showIncorrect}
                    style={styles.optionText}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        {isChecked && (
          <View style={[styles.teachPanel, isCorrect ? styles.teachCorrect : styles.teachIncorrect]}>
            <ThemedText style={styles.teachHeading}>
              {isCorrect ? 'Correct!' : "Not quite — here's how it works:"}
            </ThemedText>
            {!!currentStep.teach && (
              <MathText
                content={currentStep.teach}
                color={brand.textSecondary}
                style={styles.teachBody}
              />
            )}
            {!!currentStep.final_expression && (
              <View style={styles.expressionGap}>
                <MathText content={currentStep.final_expression} mode="expression" centered />
              </View>
            )}
            {isLastStep && lastStepSummary && (
              <View style={styles.finishBanner}>
                <View style={styles.finishIcon}>
                  <Ionicons name="trophy" size={22} color={brand.amber} />
                </View>
                <ThemedText style={styles.finishTitle}>You finished this question!</ThemedText>
                <ThemedText style={styles.finishBody}>
                  Nice work working through all {steps.length} step
                  {steps.length === 1 ? '' : 's'}.
                </ThemedText>
                <View style={styles.finishStats}>
                  <View style={styles.finishStat}>
                    <ThemedText style={styles.finishStatValue}>
                      {lastStepSummary.correctCount}
                    </ThemedText>
                    <ThemedText style={styles.finishStatLabel}>correct</ThemedText>
                  </View>
                  <View style={styles.finishStatDivider} />
                  <View style={styles.finishStat}>
                    <ThemedText style={[styles.finishStatValue, styles.finishStatIncorrect]}>
                      {lastStepSummary.incorrectCount}
                    </ThemedText>
                    <ThemedText style={styles.finishStatLabel}>incorrect</ThemedText>
                  </View>
                </View>
              </View>
            )}
            <Pressable
              style={[styles.primaryButton, isSkipping && styles.disabled]}
              disabled={isSkipping}
              onPress={handleNextStep}
            >
              <ThemedText style={styles.primaryButtonText}>
                {isSkipping
                  ? 'Loading next question…'
                  : isLastStep
                    ? 'Next question'
                    : 'Next step'}
              </ThemedText>
            </Pressable>
          </View>
        )}

        {!(isLastStep && isChecked) && (
          <Pressable
            style={[styles.nextQuestionButton, isSkipping && styles.disabled]}
            disabled={isSkipping}
            onPress={loadNextQuestion}
          >
            <ThemedText style={styles.nextQuestionText}>
              {isSkipping ? 'Loading next question…' : 'Next question →'}
            </ThemedText>
          </Pressable>
        )}

        <Pressable onPress={handleBack}>
          <ThemedText style={styles.textLink}>{backLabel}</ThemedText>
        </Pressable>
      </ScrollView>

      <ExplanationModal
        visible={showExplain}
        onClose={() => setShowExplain(false)}
        questionStem={question.question}
        correctAnswer={question.answer}
        explanation={explanation}
        onGenerate={async () => {
          const result = await generateExplanation(question);
          if (!result.success || !result.explanation) {
            throw new Error(
              result.message || 'Could not generate an explanation. Please try again.'
            );
          }
          setSessionExplanation(result.explanation);
          setQuestion((prev) =>
            prev ? { ...prev, aiExplanation: result.explanation } : prev
          );
        }}
      />
      <SharePromptModal
        visible={showShareModal}
        source="practice"
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  localHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    backgroundColor: brand.frosted,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerBackText: {
    color: brand.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionText: {
    color: brand.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  stepMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepChipText: {
    color: brand.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  practicedMeta: {
    color: brand.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  questionCard: {
    backgroundColor: brand.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 16,
    marginBottom: 14,
  },
  contextText: {
    fontSize: 13,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 17,
    fontWeight: '700',
  },
  diagram: {
    width: '100%',
    height: 180,
    marginTop: 12,
    borderRadius: 12,
  },
  stepCard: {
    backgroundColor: brand.cardElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 16,
    marginBottom: 14,
  },
  promptText: {
    fontSize: 15,
    lineHeight: 22,
  },
  expressionGap: {
    marginTop: 12,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  hintButtonText: {
    color: brand.amber,
    fontSize: 14,
    fontWeight: '700',
  },
  hintCallout: {
    marginTop: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    padding: 12,
  },
  hintText: {
    fontSize: 14,
  },
  options: {
    gap: 10,
    marginBottom: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: brand.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionCorrect: {
    borderColor: brand.emerald,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  optionIncorrect: {
    borderColor: brand.rose,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  optionDimmed: {
    opacity: 0.45,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.backgroundElevated,
  },
  optionBadgeCorrect: {
    backgroundColor: brand.emerald,
    borderColor: brand.emerald,
  },
  optionBadgeIncorrect: {
    backgroundColor: brand.rose,
    borderColor: brand.rose,
  },
  optionLetter: {
    color: brand.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  optionContent: {
    flex: 1,
    minWidth: 0,
  },
  optionText: {
    fontSize: 15,
  },
  teachPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  teachCorrect: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },
  teachIncorrect: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderColor: 'rgba(244, 63, 94, 0.24)',
  },
  finishBanner: {
    marginTop: 14,
    backgroundColor: brand.backgroundElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 16,
    alignItems: 'center',
  },
  finishIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  finishTitle: {
    color: brand.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  finishBody: {
    color: brand.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
  },
  finishStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  finishStat: {
    alignItems: 'center',
    minWidth: 72,
  },
  finishStatValue: {
    color: brand.emerald,
    fontSize: 22,
    fontWeight: '800',
  },
  finishStatIncorrect: {
    color: brand.rose,
  },
  finishStatLabel: {
    color: brand.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  finishStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: brand.border,
  },
  teachHeading: {
    color: brand.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  teachBody: {
    fontSize: 14,
    marginBottom: 4,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: brand.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: brand.background,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    color: brand.text,
    fontSize: 15,
    fontWeight: '700',
  },
  nextQuestionButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  nextQuestionText: {
    color: brand.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  textLink: {
    color: brand.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  completeContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  partyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(20, 184, 166, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  completeTitle: {
    color: brand.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  completeBody: {
    color: brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 10,
  },
  completeMeta: {
    color: brand.primary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 22,
    textAlign: 'center',
  },
  recapCard: {
    width: '100%',
    backgroundColor: brand.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 16,
    marginBottom: 18,
  },
  recapLabel: {
    color: brand.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  recapRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  recapRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  recapBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  recapBadgeCorrect: {
    backgroundColor: brand.emerald,
  },
  recapBadgeIncorrect: {
    backgroundColor: brand.rose,
  },
  recapCopy: {
    flex: 1,
    minWidth: 0,
  },
  recapStep: {
    color: brand.primarySoft,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  recapPrompt: {
    fontSize: 13,
    marginBottom: 4,
  },
  recapAnswer: {
    fontSize: 15,
    fontWeight: '700',
  },
  previousWrap: {
    marginBottom: 14,
  },
  previousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  previousToggleText: {
    color: brand.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  previousTable: {
    backgroundColor: brand.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.border,
    overflow: 'hidden',
  },
  previousHeader: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    backgroundColor: brand.backgroundElevated,
  },
  previousHeaderText: {
    color: brand.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  previousRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  previousRowLast: {
    borderBottomWidth: 0,
  },
  previousQuestionCol: {
    flex: 2,
    minWidth: 0,
  },
  previousAnswerCol: {
    flex: 1.2,
    minWidth: 0,
  },
  previousStepLabel: {
    color: brand.primarySoft,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  previousCellText: {
    fontSize: 13,
  },
  previousAnswerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  banner: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    padding: 12,
    marginBottom: 14,
    width: '100%',
  },
  bannerText: {
    color: brand.amber,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: brand.text,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  disabled: {
    opacity: 0.7,
  },
});
