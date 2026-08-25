import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { MasteryRing } from '@/components/home/MasteryRing';
import { brand } from '@/constants/matric';
import { useAuth } from '@/contexts/AuthContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analytics } from '@/services/analytics';
import {
  getAccountingLevelMastery,
  isAccountingLevelUnlocked,
  isPremiumAccountingLevel,
  loadLocalProgress,
  syncProgressFromCloud,
  type LearnerProgress,
} from '@/services/progress';

interface Topic {
  id: string;
  name: string;
  subtopics: Subtopic[];
}

interface Subtopic {
  id: string;
  name: string;
  levels: Level[];
}

interface Level {
  id: string;
  name: string;
  unlocked: boolean;
}

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const TOPIC_ICONS: Record<string, { name: IoniconName; color: string }> = {
  'Financial Statements': { name: 'document-text', color: '#F59E0B' },
  'Cash Flow & Equity': { name: 'cash', color: '#38BDF8' },
  'Ratio Analysis & Interpretation': { name: 'pie-chart', color: '#818CF8' },
  'Cost Concepts & Internal Control': { name: 'calculator', color: '#FB923C' },
  'Corporate Governance & Ethics': { name: 'briefcase', color: '#C084FC' },
  'Company Capital & Shareholders': { name: 'people', color: '#34D399' },
};

const SUBTOPIC_ICONS: { name: IoniconName; color: string }[] = [
  { name: 'layers', color: '#C084FC' },
  { name: 'reader', color: '#38BDF8' },
  { name: 'stats-chart', color: '#F59E0B' },
  { name: 'wallet', color: '#34D399' },
  { name: 'git-branch', color: '#FB923C' },
  { name: 'shield-checkmark', color: '#818CF8' },
];

const levelDetails: Record<string, { goal: string; useCase: string }> = {
  'Level 1: Basics': {
    goal: 'Recognize terms, categorize accounts, understand the purpose of the topic',
    useCase: 'Early learners, revision',
  },
  'Level 2: Core Practice': {
    goal: 'Perform core calculations and build the format step-by-step',
    useCase: 'Concept application, main content',
  },
  'Level 3: Adjustments': {
    goal: 'Apply real-world scenarios, journal updates, financial statement edits',
    useCase: 'Prep for complex examples',
  },
  'Level 3: Application': {
    goal: 'Apply real-world scenarios, journal updates, financial statement edits',
    useCase: 'Prep for complex examples',
  },
  'Level 3: Advanced': {
    goal: 'Apply real-world scenarios, journal updates, financial statement edits',
    useCase: 'Prep for complex examples',
  },
  'Level 4: Challenge Mode': {
    goal: 'Solve integrated exam-style problems with distractors or time pressure',
    useCase: 'Exam prep, confident learners',
  },
  'Level 4: Challenge': {
    goal: 'Solve integrated exam-style problems with distractors or time pressure',
    useCase: 'Exam prep, confident learners',
  },
  'Level 4: Expert': {
    goal: 'Solve integrated exam-style problems with distractors or time pressure',
    useCase: 'Exam prep, confident learners',
  },
};

function levelVisual(name: string): { name: IoniconName; color: string } {
  if (name.includes('Level 1')) return { name: 'sparkles', color: '#818CF8' };
  if (name.includes('Level 2')) return { name: 'construct', color: '#FB923C' };
  if (name.includes('Level 3')) return { name: 'search', color: '#38BDF8' };
  return { name: 'flame', color: '#F97316' };
}

export default function SubtopicsScreen() {
  const { topicId, topicName, subtopics } = useLocalSearchParams();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { isPremium, presentPaywall } = useRevenueCat();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const paywallOpenRef = useRef(false);

  useEffect(() => {
    try {
      let parsedSubtopics: Subtopic[] = [];
      if (subtopics && typeof subtopics === 'string') {
        try {
          parsedSubtopics = JSON.parse(subtopics);
        } catch (parseError) {
          console.error('Error parsing subtopics:', parseError);
        }
      }

      setTopic({
        id: topicId as string,
        name: topicName as string,
        subtopics: parsedSubtopics,
      });
    } catch (error) {
      console.error('Error loading topic:', error);
    } finally {
      setIsLoading(false);
    }
  }, [topicId, topicName, subtopics]);

  const refreshProgress = useCallback(async () => {
    try {
      if (user?.uid) {
        try {
          setProgress(await syncProgressFromCloud(user.uid));
          return;
        } catch {
          // Fall through to local progress.
        }
      }
      setProgress(await loadLocalProgress());
    } catch (err) {
      console.error('Failed to load accounting level progress:', err);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void refreshProgress();
    }, [refreshProgress])
  );

  const openLesson = (subtopic: Subtopic, level: Level, grantedFromPaywall = false) => {
    analytics.track('accounting_level_selected', {
      topic_id: topicId,
      topic_name: topicName,
      subtopic_id: subtopic.id,
      subtopic_name: subtopic.name,
      level_id: level.id,
      level_name: level.name,
    });

    router.push({
      pathname: '/accounting-lesson',
      params: {
        topicId: topicId as string,
        topicName: topicName as string,
        subtopicId: subtopic.id,
        subtopicName: subtopic.name,
        levelId: level.id,
        levelName: level.name,
        ...(grantedFromPaywall ? { accessGranted: '1' } : {}),
      },
    });
  };

  const handleLevelPress = async (
    subtopic: Subtopic,
    level: Level,
    progressUnlocked: boolean,
    premiumLocked: boolean
  ) => {
    if (!progressUnlocked) return;

    if (premiumLocked) {
      if (paywallOpenRef.current) return;
      paywallOpenRef.current = true;
      analytics.track('accounting_premium_level_locked', {
        topic_id: topicId,
        topic_name: topicName,
        subtopic_id: subtopic.id,
        subtopic_name: subtopic.name,
        level_id: level.id,
        level_name: level.name,
      });
      try {
        const unlockedPremium = await presentPaywall(user?.uid);
        if (!unlockedPremium) return;
        openLesson(subtopic, level, true);
      } finally {
        paywallOpenRef.current = false;
      }
      return;
    }

    openLesson(subtopic, level);
  };

  const topicIcon = TOPIC_ICONS[String(topicName)] || { name: 'book' as const, color: brand.primary };

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={brand.primary} />
          <ThemedText style={styles.muted}>Loading topics...</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={brand.primarySoft} />
        </Pressable>
        <View style={[styles.topicIcon, { backgroundColor: topicIcon.color }]}>
          <Ionicons name={topicIcon.name} size={18} color="#FFFFFF" />
        </View>
        <ThemedText style={styles.headerTitle} numberOfLines={2}>
          {topic?.name || 'Topics'}
        </ThemedText>
      </View>

      {!topic ? (
        <View style={styles.centered}>
          <ThemedText style={styles.muted}>Topic not found</ThemedText>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          {topic.subtopics.map((subtopic, index) => {
            const sectionIcon = SUBTOPIC_ICONS[index % SUBTOPIC_ICONS.length];
            return (
              <View key={subtopic.id} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: sectionIcon.color }]}>
                    <Ionicons name={sectionIcon.name} size={16} color="#FFFFFF" />
                  </View>
                  <ThemedText style={styles.sectionLabel} numberOfLines={2}>
                    {subtopic.name.toUpperCase()}
                  </ThemedText>
                </View>

                <View style={styles.levelList}>
                  {subtopic.levels.map((level, levelIndex) => {
                    const details = levelDetails[level.name] || {};
                    const visual = levelVisual(level.name);
                    const unlocked = isAccountingLevelUnlocked(
                      progress,
                      subtopic.name,
                      subtopic.levels,
                      levelIndex
                    );
                    const premiumLocked = isPremiumAccountingLevel(level.name) && !isPremium;
                    const mastery = unlocked
                      ? getAccountingLevelMastery(progress, subtopic.name, level.name)
                      : null;
                    const meta = unlocked
                      ? mastery && mastery.attempted > 0
                        ? `${mastery.correct} correct · ${mastery.incorrect} incorrect`
                        : details.useCase
                      : 'Complete the previous level to unlock';
                    return (
                      <Pressable
                        key={level.id}
                        disabled={!unlocked}
                        onPress={() => handleLevelPress(subtopic, level, unlocked, premiumLocked)}
                        style={({ pressed }) => [
                          styles.levelCard,
                          !unlocked && styles.levelCardLocked,
                          pressed && unlocked && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          unlocked
                            ? mastery && mastery.attempted > 0
                              ? `${level.name}, ${mastery.mastery} percent mastery`
                              : level.name
                            : `${level.name}, locked`
                        }
                        accessibilityState={{ disabled: !unlocked }}
                      >
                        <View style={[styles.levelIcon, { backgroundColor: visual.color }]}>
                          <Ionicons
                            name={unlocked ? visual.name : 'lock-closed'}
                            size={18}
                            color="#FFFFFF"
                          />
                        </View>
                        <View style={styles.cardCopy}>
                          <ThemedText
                            style={[styles.cardTitle, !unlocked && styles.lockedText]}
                            numberOfLines={1}
                          >
                            {level.name}
                          </ThemedText>
                          {!!details.goal && (
                            <ThemedText style={styles.cardSubtitle} numberOfLines={2}>
                              {details.goal}
                            </ThemedText>
                          )}
                          {!!meta && (
                            <ThemedText style={styles.cardMeta} numberOfLines={1}>
                              {meta}
                            </ThemedText>
                          )}
                        </View>
                        {unlocked ? (
                          <MasteryRing percent={mastery?.mastery ?? 0} size={44} />
                        ) : null}
                        <Ionicons
                          name={unlocked ? 'chevron-forward' : 'lock-closed'}
                          size={18}
                          color={unlocked ? brand.text : brand.textMuted}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
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
  topicIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: brand.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
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
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    flex: 1,
    color: brand.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  levelList: {
    gap: 12,
    paddingHorizontal: 20,
  },
  levelCard: {
    borderRadius: 22,
    backgroundColor: brand.card,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelCardLocked: {
    opacity: 0.55,
  },
  levelIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: brand.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: brand.textSecondary,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  cardMeta: {
    color: brand.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  lockedText: {
    color: brand.textSecondary,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
