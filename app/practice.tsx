import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { HomeFooter, HomeHeader } from '@/components/home/HomeChrome';
import { brand, SHARE_MESSAGE, SHARE_URL } from '@/constants/matric';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPracticeTopicRows,
  getPracticedTotal,
  pickPracticeQuestion,
  PracticeTopicRow,
} from '@/services/practice';
import {
  LearnerProgress,
  loadLocalProgress,
  resetPracticeCompleted,
  syncProgressFromCloud,
} from '@/services/progress';
import { logAnalyticsEvent } from '@/services/analytics';
import { shareContent } from '@/utils/share';

export default function PracticeHubScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [topics, setTopics] = useState<PracticeTopicRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [launchingTopic, setLaunchingTopic] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share');

  const firstName = useMemo(() => {
    const raw = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
    if (!raw) return null;
    return raw.split(' ')[0];
  }, [user?.displayName, user?.email]);

  const practicedTotal = progress ? getPracticedTotal(progress) : 0;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let nextProgress: LearnerProgress;
      if (user?.uid) {
        try {
          nextProgress = await syncProgressFromCloud(user.uid);
        } catch {
          nextProgress = await loadLocalProgress();
        }
      } else {
        nextProgress = await loadLocalProgress();
      }
      setProgress(nextProgress);
      const rows = await getPracticeTopicRows(nextProgress);
      setTopics(rows);
    } catch (error) {
      console.error('Failed to load practice topics:', error);
      setLoadError('Could not load practice topics. Please try again.');
      setTopics([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4500);
    return () => clearTimeout(timer);
  }, [banner]);

  const handleTopicPress = useCallback(
    async (topic: PracticeTopicRow) => {
      if (launchingTopic || topic.isDone || !progress) return;
      setLaunchingTopic(topic.topicName);
      setBanner(null);
      logAnalyticsEvent('practice_topic_select', {
        topic_name: topic.displayName,
        topic_id: topic.topicId,
        subject: 'Accounting',
      });

      try {
        const result = await pickPracticeQuestion(topic.topicName, progress);
        if (result.status === 'exhausted') {
          setBanner(
            `You've practiced all questions for ${topic.displayName}. Pick another topic.`
          );
          return;
        }
        if (result.status === 'error') {
          setBanner(result.message || 'Something went wrong starting practice. Please try again.');
          return;
        }

        router.push({
          pathname: '/practice-walkthrough',
          params: {
            questionId: result.question.id,
            topic: topic.topicName,
            from: 'hub',
          },
        });
      } catch (error) {
        console.error('Practice launch failed:', error);
        setBanner('Something went wrong starting practice. Please try again.');
      } finally {
        setLaunchingTopic(null);
      }
    },
    [launchingTopic, progress]
  );

  const handleReset = useCallback(async () => {
    logAnalyticsEvent('practice_progress_reset');
    const next = await resetPracticeCompleted(user?.uid);
    setProgress(next);
    setShowResetModal(false);
    try {
      const rows = await getPracticeTopicRows(next);
      setTopics(rows);
    } catch (error) {
      console.error('Failed to refresh topics after reset:', error);
    }
  }, [user?.uid]);

  const handleShare = useCallback(async () => {
    const message = `${SHARE_MESSAGE}\n${SHARE_URL}`;
    const result = await shareContent({ message, url: SHARE_URL, title: 'Accounting CPA QUIZ' });
    if (!result.ok || !result.method) return;
    logAnalyticsEvent('share', {
      method: result.method,
      content_type: 'app',
    });
    setShareLabel('Copied');
    setTimeout(() => setShareLabel('Share'), 2000);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <HomeHeader firstName={firstName} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.eyebrow}>Accounting</ThemedText>
        <ThemedText style={styles.title}>Step-by-step practice</ThemedText>
        <ThemedText style={styles.subtitle}>
          Choose a topic to work through exam questions one step at a time.
        </ThemedText>

        {!isLoading && !loadError && (
          <ThemedText style={styles.progressLine}>
            {practicedTotal} question{practicedTotal === 1 ? '' : 's'} practiced
          </ThemedText>
        )}

        {!!banner && (
          <View style={styles.banner}>
            <ThemedText style={styles.bannerText}>{banner}</ThemedText>
          </View>
        )}

        {isLoading && (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={brand.primary} />
          </View>
        )}

        {!isLoading && !!loadError && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={28} color={brand.amber} />
            <ThemedText style={styles.errorTitle}>{loadError}</ThemedText>
            <Pressable style={styles.errorButton} onPress={refresh}>
              <ThemedText style={styles.errorButtonText}>Try again</ThemedText>
            </Pressable>
          </View>
        )}

        {!isLoading && !loadError && topics.length === 0 && (
          <View style={styles.emptyCard}>
            <ThemedText style={styles.emptyTitle}>No practice topics yet</ThemedText>
            <ThemedText style={styles.emptyBody}>
              No practice topics are available yet. Check back soon.
            </ThemedText>
          </View>
        )}

        {!isLoading && !loadError && topics.length > 0 && (
          <>
            <ThemedText style={styles.sectionLabel}>TOPICS</ThemedText>
            <View style={styles.topicList}>
              {topics.map((topic) => {
                const isLaunching = launchingTopic === topic.topicName;
                const isDisabled = topic.isDone || !!launchingTopic;
                return (
                  <Pressable
                    key={topic.topicName}
                    disabled={isDisabled}
                    onPress={() => handleTopicPress(topic)}
                    style={({ pressed }) => [
                      styles.topicCard,
                      topic.isDone && styles.topicCardDone,
                      !topic.isDone && pressed && styles.pressed,
                      isLaunching && styles.topicCardActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.topicIcon,
                        topic.isDone && styles.topicIconDone,
                      ]}
                    >
                      {isLaunching ? (
                        <ActivityIndicator size="small" color={brand.primarySoft} />
                      ) : topic.isDone ? (
                        <Ionicons name="checkmark" size={18} color={brand.emerald} />
                      ) : (
                        <Ionicons name="book-outline" size={18} color="#A5B4FC" />
                      )}
                    </View>
                    <View style={styles.topicCopy}>
                      <ThemedText
                        style={[styles.topicTitle, topic.isDone && styles.topicMuted]}
                        numberOfLines={2}
                      >
                        {topic.displayName}
                      </ThemedText>
                      <ThemedText style={styles.topicSubtitle}>
                        {topic.isDone
                          ? `All ${topic.practiceCount} practiced`
                          : `${topic.practiced} of ${topic.practiceCount} practiced`}
                      </ThemedText>
                    </View>
                    {!topic.isDone && (
                      <ThemedText style={styles.topicTrailing}>
                        {topic.remaining} left
                      </ThemedText>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {practicedTotal > 0 && (
              <Pressable style={styles.resetButton} onPress={() => setShowResetModal(true)}>
                <ThemedText style={styles.resetText}>Reset practice progress</ThemedText>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom }}>
        <HomeFooter
          onProfile={() => router.push('/profile')}
          onShare={handleShare}
          shareLabel={shareLabel}
        />
      </View>

      <Modal visible={showResetModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Reset practice progress?</ThemedText>
            <ThemedText style={styles.modalBody}>
              This clears your completed accounting practice questions so they can appear again.
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setShowResetModal(false)}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={styles.modalReset} onPress={handleReset}>
                <ThemedText style={styles.modalResetText}>Reset</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backText: {
    color: brand.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  eyebrow: {
    color: brand.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  title: {
    color: brand.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  progressLine: {
    color: brand.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 18,
  },
  banner: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    padding: 12,
    marginBottom: 16,
  },
  bannerText: {
    color: brand.amber,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    color: brand.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  topicList: {
    gap: 10,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: brand.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brand.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  topicCardActive: {
    borderColor: brand.primary,
  },
  topicCardDone: {
    opacity: 0.72,
  },
  topicIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
  },
  topicIconDone: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
  },
  topicCopy: {
    flex: 1,
    minWidth: 0,
  },
  topicTitle: {
    color: brand.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  topicSubtitle: {
    color: brand.textSecondary,
    fontSize: 13,
  },
  topicTrailing: {
    color: brand.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  topicMuted: {
    color: brand.textSecondary,
  },
  resetButton: {
    alignSelf: 'center',
    marginTop: 22,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resetText: {
    color: brand.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  centeredState: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: brand.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 18,
  },
  emptyTitle: {
    color: brand.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyBody: {
    color: brand.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  errorCard: {
    backgroundColor: brand.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brand.border,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  errorTitle: {
    color: brand.text,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorButton: {
    marginTop: 6,
    backgroundColor: brand.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorButtonText: {
    color: brand.background,
    fontWeight: '700',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: brand.cardElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    borderTopWidth: 1,
    borderColor: brand.border,
  },
  modalTitle: {
    color: brand.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalBody: {
    color: brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: brand.text,
    fontWeight: '700',
  },
  modalReset: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: brand.rose,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalResetText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
