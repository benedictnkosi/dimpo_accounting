import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Animated, ViewStyle } from 'react-native';
import { ThemedText } from './ThemedText';
import { brand } from '@/constants/matric';
import { Ionicons } from '@expo/vector-icons';

const CATEGORY_COLORS = [
  '#6366F1', // Indigo / purple — first category (e.g. Adjusting Entry)
  '#22D3EE', // Cyan — second category (e.g. Non-adjusting Entry)
  '#F59E42',
  '#10B981',
  '#F43F5E',
  '#A21CAF',
  '#FBBF24',
  '#3B82F6',
];

const CORRECT_DELAY_MS = 800;
const MIN_TOUCH_SIZE = 56;

interface CategoriseQuestionProps {
  id: string;
  prompt: string;
  categories: string[];
  items: Record<string, string>; // item -> correct category
  onContinue?: () => void;
  setIsQuestionAnswered: (answered: boolean) => void;
  onAttempt?: (stepId: string, correct: boolean) => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type Phase = 'list' | 'choose' | 'feedback';

export function CategoriseQuestion({
  id,
  prompt,
  categories,
  items,
  onContinue,
  setIsQuestionAnswered,
  onAttempt,
}: CategoriseQuestionProps) {
  const [shuffledItemKeys, setShuffledItemKeys] = useState<string[]>(() =>
    shuffleArray(Object.keys(items))
  );
  const [assignments, setAssignments] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {};
    Object.keys(items).forEach((item) => {
      initial[item] = null;
    });
    return initial;
  });
  const [currentItem, setCurrentItem] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('list');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [inputLocked, setInputLocked] = useState(false);

  const lockedRef = useRef(false);
  const mountedRef = useRef(true);
  const phaseRef = useRef<Phase>('list');
  const currentItemRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAssignmentsRef = useRef<Record<string, string | null> | null>(null);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslate = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;

  phaseRef.current = phase;
  currentItemRef.current = currentItem;

  const categoryColorMap = Object.fromEntries(
    categories.map((cat, idx) => [cat, CATEGORY_COLORS[idx % CATEGORY_COLORS.length]])
  );

  const remainingItems = shuffledItemKeys.filter((item) => assignments[item] == null);
  const answeredCount = shuffledItemKeys.filter((item) => assignments[item] != null).length;
  const totalCount = shuffledItemKeys.length;
  const itemNumber = currentItem
    ? phase === 'feedback'
      ? answeredCount
      : answeredCount + 1
    : 1;

  const clearAdvanceTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const animateIn = useCallback(() => {
    contentOpacity.setValue(0);
    contentTranslate.setValue(14);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentTranslate]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslate, {
          toValue: -10,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDone();
      });
    },
    [contentOpacity, contentTranslate]
  );

  const resetQuestion = useCallback(() => {
    clearAdvanceTimeout();
    lockedRef.current = false;
    const keys = shuffleArray(Object.keys(items));
    const initial: Record<string, string | null> = {};
    keys.forEach((item) => {
      initial[item] = null;
    });
    setShuffledItemKeys(keys);
    setAssignments(initial);
    setCurrentItem(null);
    setSelectedCategory(null);
    setPhase('list');
    setIsCorrect(null);
    setInputLocked(false);
    setIsQuestionAnswered(false);
    pendingAssignmentsRef.current = null;
    contentOpacity.setValue(1);
    contentTranslate.setValue(0);
    feedbackOpacity.setValue(0);
  }, [clearAdvanceTimeout, contentOpacity, contentTranslate, feedbackOpacity, items, setIsQuestionAnswered]);

  const questionIdRef = useRef(id);

  useEffect(() => {
    mountedRef.current = true;
    if (questionIdRef.current !== id) {
      questionIdRef.current = id;
      resetQuestion();
    }
    return () => {
      mountedRef.current = false;
      clearAdvanceTimeout();
    };
    // Reset only when the question identity changes — items come from the same question payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const enterChoose = useCallback(
    (item: string) => {
      lockedRef.current = false;
      currentItemRef.current = item;
      phaseRef.current = 'choose';
      setInputLocked(false);
      setCurrentItem(item);
      setSelectedCategory(null);
      setIsCorrect(null);
      setPhase('choose');
      feedbackOpacity.setValue(0);
      animateIn();
    },
    [animateIn, feedbackOpacity]
  );

  const handleItemTap = (item: string) => {
    if (lockedRef.current || phaseRef.current !== 'list') return;
    enterChoose(item);
  };

  const presentNextItem = useCallback(
    (nextAssignments: Record<string, string | null>) => {
      if (!mountedRef.current) return;
      const nextItem = shuffledItemKeys.find((item) => nextAssignments[item] == null);
      if (!nextItem) {
        lockedRef.current = true;
        setInputLocked(true);
        setIsQuestionAnswered(true);
        onContinue?.();
        return;
      }
      enterChoose(nextItem);
    },
    [enterChoose, onContinue, setIsQuestionAnswered, shuffledItemKeys]
  );

  const advanceFromFeedback = useCallback(() => {
    const nextAssignments = pendingAssignmentsRef.current;
    if (!nextAssignments) return;
    pendingAssignmentsRef.current = null;
    clearAdvanceTimeout();
    animateOut(() => {
      if (!mountedRef.current) return;
      presentNextItem(nextAssignments);
    });
  }, [animateOut, clearAdvanceTimeout, presentNextItem]);

  const handleNext = () => {
    if (phaseRef.current !== 'feedback') return;
    advanceFromFeedback();
  };

  const handleCategoryTap = (category: string) => {
    const item = currentItemRef.current;
    if (lockedRef.current || phaseRef.current !== 'choose' || !item) return;

    lockedRef.current = true;
    setInputLocked(true);
    const correct = items[item] === category;
    onAttempt?.(item, correct);
    const nextAssignments = { ...assignments, [item]: category };
    pendingAssignmentsRef.current = nextAssignments;

    setSelectedCategory(category);
    setAssignments(nextAssignments);
    setIsCorrect(correct);
    setPhase('feedback');

    feedbackOpacity.setValue(0);
    Animated.timing(feedbackOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    if (!correct) return;

    clearAdvanceTimeout();
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      advanceFromFeedback();
    }, CORRECT_DELAY_MS);
  };

  const getCategoryButtonStyle = (category: string): ViewStyle => {
    const color = categoryColorMap[category];
    const isSelected = selectedCategory === category;
    const showingFeedback = phase === 'feedback';
    const isTheCorrectCategory = currentItem != null && items[currentItem] === category;
    const selectedWrong = showingFeedback && isSelected && !isTheCorrectCategory;

    let borderColor = brand.border;
    let backgroundColor = brand.cardElevated;
    let borderWidth = 2;

    if (!showingFeedback && isSelected) {
      borderColor = color;
      backgroundColor = `${color}22`;
    }

    if (showingFeedback && isTheCorrectCategory) {
      borderColor = brand.emerald;
      backgroundColor = brand.bullseyeBg;
      borderWidth = 2;
    }

    if (selectedWrong) {
      borderColor = brand.rose;
      backgroundColor = brand.oopsieBg;
      borderWidth = 2;
    }

    return {
      borderColor,
      backgroundColor,
      borderWidth,
    };
  };

  const renderCategoryIcon = (category: string) => {
    const showingFeedback = phase === 'feedback';
    const isTheCorrectCategory = currentItem != null && items[currentItem] === category;
    const isSelected = selectedCategory === category;

    if (showingFeedback && isTheCorrectCategory) {
      return <Ionicons name="checkmark-circle" size={22} color={brand.emerald} />;
    }
    if (showingFeedback && isSelected && !isTheCorrectCategory) {
      return <Ionicons name="close-circle" size={22} color={brand.rose} />;
    }
    return (
      <View
        style={[styles.categoryDot, { backgroundColor: categoryColorMap[category] }]}
      />
    );
  };

  const renderList = () => (
    <View>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Items to Classify</ThemedText>
        {!!prompt && <ThemedText style={styles.promptText}>{prompt}</ThemedText>}
      </View>
      {remainingItems.map((item) => (
        <Pressable
          key={item}
          style={({ pressed }) => [
            styles.itemCard,
            pressed && styles.pressed,
          ]}
          onPress={() => handleItemTap(item)}
          accessibilityRole="button"
          accessibilityLabel={`Categorise ${item}`}
          accessibilityHint="Opens category choices for this item"
        >
          <ThemedText style={styles.itemText}>{item}</ThemedText>
          <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
        </Pressable>
      ))}
    </View>
  );

  const renderChoose = () => {
    if (!currentItem) return null;
    const correctCategory = items[currentItem];
    const showingFeedback = phase === 'feedback';
    const locked = showingFeedback || inputLocked;

    return (
      <View>
        <Animated.View
          key={currentItem}
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslate }],
          }}
          pointerEvents="box-none"
        >
          {totalCount > 1 && (
            <ThemedText style={styles.itemProgress}>
              Item {itemNumber} of {totalCount}
            </ThemedText>
          )}

          {showingFeedback && isCorrect !== null && (
            <Animated.View
              style={[
                styles.feedbackBanner,
                isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect,
                { opacity: feedbackOpacity },
              ]}
              accessibilityLiveRegion="polite"
            >
              <Ionicons
                name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={isCorrect ? brand.emerald : brand.rose}
              />
              <ThemedText
                style={[
                  styles.feedbackTitle,
                  { color: isCorrect ? brand.emerald : brand.rose },
                ]}
              >
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </ThemedText>
            </Animated.View>
          )}

          <View style={styles.itemFocusCard}>
            <ThemedText style={styles.itemFocusText}>{currentItem}</ThemedText>
            {showingFeedback && correctCategory ? (
              <View style={styles.resultRow}>
                <ThemedText style={styles.resultArrow}>→</ThemedText>
                <ThemedText
                  style={[
                    styles.resultCategory,
                    { color: categoryColorMap[correctCategory] },
                  ]}
                >
                  {correctCategory}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {!showingFeedback && (
            <ThemedText style={styles.chooseLabel}>Choose the correct category:</ThemedText>
          )}
        </Animated.View>

        <View style={styles.categoryList}>
          {categories.map((category) => {
            const showingFeedbackState = phase === 'feedback';
            const isTheCorrectCategory = items[currentItem] === category;
            const isSelected = selectedCategory === category;
            const selectedWrong = showingFeedbackState && isSelected && !isTheCorrectCategory;
            const labelColor = showingFeedbackState
              ? isTheCorrectCategory
                ? brand.emerald
                : selectedWrong
                  ? brand.rose
                  : brand.textSecondary
              : categoryColorMap[category];

            return (
              <Pressable
                key={`${currentItem}-${category}`}
                onPress={() => handleCategoryTap(category)}
                disabled={locked}
                accessibilityRole="button"
                accessibilityLabel={category}
                accessibilityState={{ disabled: locked, selected: isSelected }}
                accessibilityHint={
                  showingFeedbackState
                    ? isTheCorrectCategory
                      ? 'Correct category'
                      : 'Incorrect category'
                    : `Assign ${currentItem} to ${category}`
                }
                style={({ pressed }) => [
                  styles.categoryButton,
                  getCategoryButtonStyle(category),
                  pressed && !locked && styles.pressed,
                ]}
              >
                <View style={styles.categoryButtonInner}>
                  {renderCategoryIcon(category)}
                  <ThemedText style={[styles.categoryButtonText, { color: labelColor }]}>
                    {category}
                  </ThemedText>
                </View>
                {showingFeedbackState && isTheCorrectCategory && !isCorrect && (
                  <ThemedText style={styles.correctHint}>Correct category</ThemedText>
                )}
              </Pressable>
            );
          })}
        </View>

        {showingFeedback && isCorrect === false && (
          <Pressable
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next"
            style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
          >
            <ThemedText style={styles.nextButtonText}>Next</ThemedText>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {phase === 'list' ? renderList() : renderChoose()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 4,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    backgroundColor: brand.cardElevated,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: brand.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brand.text,
  },
  promptText: {
    fontSize: 14,
    color: brand.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },
  itemCard: {
    backgroundColor: brand.cardElevated,
    borderColor: brand.border,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_SIZE,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
    color: brand.text,
    flex: 1,
    marginRight: 8,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  feedbackCorrect: {
    backgroundColor: brand.bullseyeBg,
  },
  feedbackIncorrect: {
    backgroundColor: brand.oopsieBg,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  itemFocusCard: {
    backgroundColor: brand.cardElevated,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: brand.border,
    marginBottom: 16,
  },
  itemFocusText: {
    fontSize: 22,
    fontWeight: '800',
    color: brand.text,
    letterSpacing: -0.3,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  resultArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: brand.textSecondary,
  },
  resultCategory: {
    fontSize: 16,
    fontWeight: '700',
  },
  chooseLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: brand.text,
    marginBottom: 14,
  },
  itemProgress: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: brand.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  categoryList: {
    gap: 12,
  },
  categoryButton: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    minHeight: 64,
    justifyContent: 'center',
  },
  categoryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  correctHint: {
    marginTop: 8,
    marginLeft: 34,
    fontSize: 13,
    fontWeight: '600',
    color: brand.emerald,
  },
  nextButton: {
    marginTop: 18,
    backgroundColor: brand.primary,
    borderRadius: 16,
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
