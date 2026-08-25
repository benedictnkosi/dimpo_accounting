import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { HomeFooter, HomeHeader } from '@/components/home/HomeChrome';
import { MasteryRing } from '@/components/home/MasteryRing';
import { ThemedText } from '@/components/ThemedText';
import { brand, SHARE_MESSAGE, SHARE_URL } from '@/constants/matric';
import { useAuth } from '@/contexts/AuthContext';
import { analytics } from '@/services/analytics';
import { fetchSubtopicsByMainTopic } from '@/services/accounting';
import {
  getAccountingTopicProgressView,
  getEffectiveStreak,
  LearnerProgress,
  loadLocalProgress,
  SubjectProgressView,
  syncProgressFromCloud,
} from '@/services/progress';
import { shareContent } from '@/utils/share';

import accountingData from '@/assets/accounting_full_33_subtopics.json';

interface Topic {
  id: string;
  name: string;
}

interface Subtopic {
  id: string;
  name: string;
  levels: { id: string; name: string; unlocked: boolean }[];
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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [openingTopicId, setOpeningTopicId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState('Share');

  const streakCount = getEffectiveStreak(progress);
  const slogan = 'Accounting prep that actually sticks.';

  const streakTitle =
    streakCount <= 0 ? 'Start a streak' : `${streakCount}-day streak`;
  const streakSubtitle =
    streakCount <= 0
      ? 'Practice today to begin.'
      : "Don't break it — practice today.";

  const topicProgress = useMemo(() => {
    const map: Record<string, SubjectProgressView> = {};
    if (!progress) return map;
    for (const topic of topics) {
      const source = accountingData.topics.find((item) => item.name === topic.name);
      const subtopicNames = source?.subtopics.map((subtopic) => subtopic.name) ?? [];
      map[topic.name] = getAccountingTopicProgressView(progress, subtopicNames);
    }
    return map;
  }, [progress, topics]);

  useEffect(() => {
    setTopics(
      accountingData.topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
      }))
    );
  }, []);

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
      console.error('Failed to load progress:', err);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void refreshProgress();
    }, [refreshProgress])
  );

  useEffect(() => {
    analytics.track('accounting_home_screen_viewed', {
      topics_count: topics.length,
      streak: streakCount,
    });
  }, [topics.length, streakCount]);

  const handleTopicPress = async (topic: Topic) => {
    if (openingTopicId) return;
    setOpeningTopicId(topic.id);
    setError(null);

    try {
      const subtopicsData = await fetchSubtopicsByMainTopic(topic.name);
      const subtopics: Subtopic[] = subtopicsData.map((subtopicData, index) => ({
        id: `${topic.id}-subtopic-${index}`,
        name: subtopicData.topic,
        levels: subtopicData.levels.map((levelName, levelIndex) => ({
          id: `${topic.id}-subtopic-${index}-level-${levelIndex}`,
          name: levelName,
          unlocked: true,
        })),
      }));

      analytics.track('accounting_topic_selected', {
        topic_id: topic.id,
        topic_name: topic.name,
        subtopics_count: subtopics.length,
      });

      router.push({
        pathname: '/subtopics',
        params: {
          topicId: topic.id,
          topicName: topic.name,
          subtopics: JSON.stringify(subtopics),
        },
      });
    } catch (err) {
      console.error('Error fetching subtopics:', err);
      setError('Failed to load topics. Please try again.');
    } finally {
      setOpeningTopicId(null);
    }
  };

  const handleShare = async () => {
    analytics.track('accounting_app_shared', {
      platform: 'home_screen',
      share_method: 'native_share',
    });
    const result = await shareContent({
      message: `${SHARE_MESSAGE}\n${SHARE_URL}`,
      url: SHARE_URL,
      title: 'Accounting CPA QUIZ',
    });
    if (!result.ok) return;
    setShareLabel('Shared');
    setTimeout(() => setShareLabel('Share'), 2000);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />
        <ThemedText style={styles.slogan}>{slogan}</ThemedText>

        <View style={styles.streakCard} accessibilityLabel={streakTitle}>
          <View style={styles.streakIcon}>
            <Ionicons name="flame" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.streakCopy}>
            <ThemedText style={styles.streakTitle}>{streakTitle}</ThemedText>
            <ThemedText style={styles.streakSubtitle}>{streakSubtitle}</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.sectionLabel}>SUBJECTS</ThemedText>
        {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
        <View style={styles.subjectList}>
          {topics.map((topic) => {
            const icon = TOPIC_ICONS[topic.name] || { name: 'book' as const, color: brand.primary };
            const stats = topicProgress[topic.name];
            const isOpening = openingTopicId === topic.id;
            return (
              <Pressable
                key={topic.id}
                disabled={!!openingTopicId}
                onPress={() => handleTopicPress(topic)}
                style={({ pressed }) => [styles.subjectCard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={topic.name}
              >
                <View style={[styles.subjectIcon, { backgroundColor: icon.color }]}>
                  {isOpening ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name={icon.name} size={20} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.cardCopy}>
                  <ThemedText style={styles.cardTitle} numberOfLines={2}>
                    {topic.name}
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    Level {stats?.level ?? 1} · {stats?.label ?? 'Not achieved'}
                  </ThemedText>
                </View>
                <MasteryRing percent={stats?.mastery ?? 0} />
                <Ionicons name="chevron-forward" size={18} color={brand.text} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <HomeFooter
          onProfile={() => router.push('/profile')}
          onShare={handleShare}
          shareLabel={shareLabel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brand.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 28,
  },
  slogan: {
    textAlign: 'center',
    color: brand.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    marginTop: 10,
    marginBottom: 22,
    paddingHorizontal: 24,
  },
  streakCard: {
    marginHorizontal: 20,
    marginBottom: 28,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.55)',
    backgroundColor: brand.card,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  streakIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCopy: {
    flex: 1,
  },
  streakTitle: {
    color: brand.text,
    fontSize: 18,
    fontWeight: '800',
  },
  streakSubtitle: {
    color: brand.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  sectionLabel: {
    color: brand.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  subjectList: {
    gap: 12,
    paddingHorizontal: 20,
  },
  subjectCard: {
    borderRadius: 22,
    backgroundColor: brand.card,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subjectIcon: {
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
    fontSize: 17,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: brand.textSecondary,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  errorText: {
    color: brand.rose,
    marginHorizontal: 20,
    marginBottom: 10,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
