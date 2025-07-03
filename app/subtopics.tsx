import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { analytics } from '@/services/analytics';
import subtopicEmojis from '@/assets/subtopic_emojis.json';
import topicEmojis from '@/assets/topic_emojis.json';
import { getLevelCompletionStatus, getAllTopics, hasIncorrectQuestions, getQuestionsByTopicAndLevel, logQuestionStatistics } from '@/services/database';
import { useDatabase } from '@/hooks/useDatabase';
import { SUBTOPIC_DESCRIPTIONS } from './constants/subtopicDescriptions';
import { LevelUnlockModal } from './components/LevelUnlockModal';

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

export default function SubtopicsScreen() {
  const { topicId, topicName, subtopics } = useLocalSearchParams();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSubtopics, setExpandedSubtopics] = useState<Set<string>>(new Set());
  const [levelCompletionStatus, setLevelCompletionStatus] = useState<Record<string, Array<{
    level: string;
    total_questions: number;
    correctly_answered_questions: number;
    incorrectly_answered_questions: number;
    is_completed: boolean;
  }>>>({});
  const [incorrectQuestions, setIncorrectQuestions] = useState<Record<string, Array<string>>>({});
  const [levelUnlockModalVisible, setLevelUnlockModalVisible] = useState(false);
  const [unlockedLevel, setUnlockedLevel] = useState<{
    topicId: string;
    subtopicId: string;
    levelIndex: number;
    subtopicName: string;
    levelName: string;
  } | null>(null);
  const [previousUnlockedLevels, setPreviousUnlockedLevels] = useState<Record<string, Set<number>>>({});
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { isInitialized } = useDatabase();

  // Storage key for unlock modal state
  const getUnlockModalStorageKey = (topicId: string, subtopicId: string, levelIndex: number) => {
    return `unlock_modal_shown_${topicId}_${subtopicId}_${levelIndex}`;
  };

  // Save unlock modal state to AsyncStorage
  const saveUnlockModalState = async (topicId: string, subtopicId: string, levelIndex: number) => {
    try {
      const storageKey = getUnlockModalStorageKey(topicId, subtopicId, levelIndex);
      await AsyncStorage.setItem(storageKey, 'true');
    } catch (error) {
      // Silently handle storage error
    }
  };

  // Check if unlock modal has been shown for a specific level
  const hasUnlockModalBeenShown = async (topicId: string, subtopicId: string, levelIndex: number): Promise<boolean> => {
    try {
      const storageKey = getUnlockModalStorageKey(topicId, subtopicId, levelIndex);
      const hasBeenShown = await AsyncStorage.getItem(storageKey);
      return hasBeenShown === 'true';
    } catch (error) {
      return false;
    }
  };

  // Fun color palette for subtopic cards
  const cardColors = isDark
    ? [
        '#2D2A3A', // dark purple
        '#223344', // dark blue
        '#3A3A2D', // dark olive
        '#233A2D', // dark green
        '#332344', // dark lavender
        '#44332A', // dark peach
        '#23443A', // dark aqua
        '#342344', // dark purple
        '#443A23', // dark cream
        '#233A44', // dark sky
      ]
    : [
        '#FFD6E0', // pink
        '#D6EFFF', // light blue
        '#FFF9D6', // yellow
        '#D6FFD9', // mint
        '#F3D6FF', // lavender
        '#FFE6D6', // peach
        '#D6FFF6', // aqua
        '#F9D6FF', // light purple
        '#FFF3D6', // cream
        '#D6F6FF', // sky
      ];

  // Level details mapping using level.name as key
  const levelDetails: Record<string, { goal: string; useCase: string }> = {
    'Level 1: Basics': {
      goal: 'Recognize terms, categorize accounts, understand the purpose of the topic',
      useCase: 'Early learners, revision',
    },
    'Level 2: Core Practice': {
      goal: 'Perform core calculations and build the format step-by-step',
      useCase: 'Concept application, main content',
    },
    'Level 3: Advanced': {
      goal: 'Apply real-world scenarios, journal updates, financial statement edits',
      useCase: 'Prep for complex examples',
    },
    'Level 4: Expert': {
      goal: 'Solve integrated exam-style problems with distractors',
      useCase: 'Exam prep, confident learners',
    },
  };

  // Add emoji mapping for each level
  const levelEmojis: Record<string, string> = {
    'Level 1: Basics': '🧠✨',
    'Level 2: Core Practice': '🛠️📘',
    'Level 3: Advanced': '🧾🔍',
    'Level 4: Expert': '🎯🔥',
  };

  // Function to determine if a level should be unlocked
  const isLevelUnlocked = (subtopicId: string, levelIndex: number): boolean => {
    // Level 0 is always unlocked
    if (levelIndex === 0) {
      return true;
    }

    const completionStatus = levelCompletionStatus[subtopicId];

    // Check if all previous levels meet the unlock criteria
    for (let i = 0; i < levelIndex; i++) {
      const previousLevel = completionStatus?.[i];

      if (!previousLevel) {
        return false;
      }

      const totalAnswered = previousLevel.correctly_answered_questions + previousLevel.incorrectly_answered_questions;
      const accuracy = totalAnswered > 0 ? (previousLevel.correctly_answered_questions / totalAnswered) * 100 : 0;
      const meetsUnlockCriteria = totalAnswered >= 9 && accuracy >= 80;

      if (!meetsUnlockCriteria) {
        return false;
      }
    }

    return true;
  };

  // Function to log question counts per subtopic
  const logQuestionCountsPerSubtopic = useCallback(async () => {
    if (!isInitialized || !topic) {
      return;
    }

    try {
      // Get all topics from the database
      const allTopics = await getAllTopics();
      
      // Create a mapping of subtopic names to topic IDs
      const topicIdMap = new Map<string, number>();
      for (const dbTopic of allTopics) {
        topicIdMap.set(dbTopic.sub_topic, dbTopic.id);
      }

      let totalQuestionsInTopic = 0;
      const levelNames = ['Level 1: Basics', 'Level 2: Core Practice', 'Level 3: Advanced', 'Level 4: Expert'];

      // Log question counts for each subtopic
      for (const subtopic of topic.subtopics) {
        const topicId = topicIdMap.get(subtopic.name);
        if (!topicId) {
          continue;
        }

        let subtopicTotalQuestions = 0;
        
        // Get question counts for each level
        for (const levelName of levelNames) {
          try {
            const questions = await getQuestionsByTopicAndLevel(topicId, levelName);
            const questionCount = questions.length;
            subtopicTotalQuestions += questionCount;
          } catch (error) {
            // Silently handle error
          }
        }
        
        totalQuestionsInTopic += subtopicTotalQuestions;
      }

    } catch (error) {
      // Silently handle error
    }
  }, [isInitialized, topic]);

  // Load level completion status for all subtopics
  const loadLevelCompletionStatus = useCallback(async () => {
    if (!isInitialized || !topic) {
      return;
    }

    // Log question counts per subtopic
    await logQuestionCountsPerSubtopic();

    try {
      const statusMap: Record<string, Array<{
        level: string;
        total_questions: number;
        correctly_answered_questions: number;
        incorrectly_answered_questions: number;
        is_completed: boolean;
      }>> = {};
      const incorrectMap: Record<string, Array<string>> = {};

      // Get all topics from the database
      const allTopics = await getAllTopics();
      
      // Create a mapping of subtopic names to topic IDs
      const topicIdMap = new Map<string, number>();
      for (const dbTopic of allTopics) {
        // Map by subtopic name (which should match our subtopic names)
        topicIdMap.set(dbTopic.sub_topic, dbTopic.id);
      }

      // Load completion status for each subtopic
      for (const subtopic of topic.subtopics) {
        // Find the topic ID for this subtopic by matching the subtopic name
        const topicId = topicIdMap.get(subtopic.name);
        
        if (topicId) {
          try {
            const status = await getLevelCompletionStatus(topicId);
            statusMap[subtopic.id] = status;
            
            // Check for incorrect questions for each level
            const incorrectLevels: string[] = [];
            for (const level of subtopic.levels) {
              const hasIncorrect = await hasIncorrectQuestions(topicId, level.name);
              if (hasIncorrect) {
                incorrectLevels.push(level.name);
              }
            }
            incorrectMap[subtopic.id] = incorrectLevels;
            
          } catch (error) {
            statusMap[subtopic.id] = [];
            incorrectMap[subtopic.id] = [];
          }
        } else {
          statusMap[subtopic.id] = [];
          incorrectMap[subtopic.id] = [];
        }
      }

      setLevelCompletionStatus(statusMap);
      setIncorrectQuestions(incorrectMap);

    } catch (error) {
      // Silently handle error
    }
  }, [isInitialized, topic, logQuestionCountsPerSubtopic]);

  // Check for newly unlocked levels and show modal
  const checkForNewlyUnlockedLevels = useCallback(async () => {
    if (!topic) {
      return;
    }

    const currentUnlockedLevels: Record<string, Set<number>> = {};
    
    // Calculate currently unlocked levels
    for (const subtopic of topic.subtopics) {
      currentUnlockedLevels[subtopic.id] = new Set();
      
      for (let i = 0; i < subtopic.levels.length; i++) {
        const isUnlocked = isLevelUnlocked(subtopic.id, i);
        
        if (isUnlocked) {
          currentUnlockedLevels[subtopic.id].add(i);
        }
      }
    }

    // Check for newly unlocked levels
    for (const subtopic of topic.subtopics) {
      const previousUnlocked = previousUnlockedLevels[subtopic.id] || new Set();
      const currentlyUnlocked = currentUnlockedLevels[subtopic.id] || new Set();

      // Find newly unlocked levels
      for (const levelIndex of currentlyUnlocked) {
        if (!previousUnlocked.has(levelIndex) && levelIndex > 0) { // Skip Level 1 as it's always unlocked
          
          // Check if we've already shown the modal for this specific level
          const hasBeenShown = await hasUnlockModalBeenShown(topicId as string, subtopic.id, levelIndex);
          if (hasBeenShown) {
            continue;
          }
          
          // Show unlock modal for the newly unlocked level
          setUnlockedLevel({
            topicId: topicId as string,
            subtopicId: subtopic.id,
            levelIndex: levelIndex,
            subtopicName: subtopic.name,
            levelName: subtopic.levels[levelIndex].name
          });
          setLevelUnlockModalVisible(true);
          
          // Save the state to AsyncStorage
          await saveUnlockModalState(topicId as string, subtopic.id, levelIndex);
          
          // Track the unlock event
          analytics.track('accounting_level_unlocked', {
            topic_id: topicId,
            topic_name: topicName,
            subtopic_id: subtopic.id,
            subtopic_name: subtopic.name,
            level_index: levelIndex,
            level_name: subtopic.levels[levelIndex].name
          });
          
          break; // Only show one modal at a time
        }
      }
    }

    // Update the previous unlocked levels reference
    setPreviousUnlockedLevels(currentUnlockedLevels);
  }, [topic, topicId, topicName, levelCompletionStatus]);

  // Use useFocusEffect to reload progress when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadLevelCompletionStatus();
    }, [loadLevelCompletionStatus])
  );

  // Check for newly unlocked levels after completion status is loaded
  useEffect(() => {
    if (Object.keys(levelCompletionStatus).length > 0) {
      checkForNewlyUnlockedLevels().catch(error => {
        // Silently handle error
      });
    }
  }, [levelCompletionStatus, checkForNewlyUnlockedLevels]);

  useEffect(() => {
    const loadTopic = async () => {
      try {
        // Parse subtopics from route params
        let parsedSubtopics: Subtopic[] = [];
        
        if (subtopics && typeof subtopics === 'string') {
          try {
            parsedSubtopics = JSON.parse(subtopics);
          } catch (parseError) {
            // Silently handle parse error
          }
        }

        // Create topic object with parsed subtopics
        const topicData: Topic = {
          id: topicId as string,
          name: topicName as string,
          subtopics: parsedSubtopics
        };

        setTopic(topicData);
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    };

    loadTopic();
  }, [topicId, topicName, subtopics]);

  const toggleSubtopicExpansion = (subtopicId: string) => {
    setExpandedSubtopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subtopicId)) {
        // If clicking on an already expanded subtopic, close it
        newSet.delete(subtopicId);
      } else {
        // If opening a new subtopic, close all others first
        newSet.clear();
        newSet.add(subtopicId);
      }
      return newSet;
    });
  };

  const handleLevelPress = async (subtopic: Subtopic, level: Level) => {
    if (!level.unlocked) return; // Don't allow clicking locked levels
    
    analytics.track('accounting_level_selected', {
      topic_id: topicId,
      topic_name: topicName,
      subtopic_id: subtopic.id,
      subtopic_name: subtopic.name,
      level_id: level.id,
      level_name: level.name
    });

    // Find the database topic ID for this subtopic
    let databaseTopicId = null;
    try {
      const allTopics = await getAllTopics();
      const topicRecord = allTopics.find(t => t.sub_topic === subtopic.name);
      if (topicRecord) {
        databaseTopicId = topicRecord.id.toString();
      }
    } catch (error) {
      // Silently handle error
    }

    // Navigate to accounting lesson screen with level info
    router.push({
      pathname: '/accounting-lesson',
      params: {
        topicId: databaseTopicId || topicId as string,
        topicName: topicName as string,
        subtopicId: subtopic.id,
        subtopicName: subtopic.name,
        levelId: level.id,
        levelName: level.name
      }
    });
  };

  const handleRetryPress = async (subtopic: Subtopic, level: Level) => {

    // Find the database topic ID for this subtopic
    let databaseTopicId = null;
    try {
      const allTopics = await getAllTopics();
      const topicRecord = allTopics.find(t => t.sub_topic === subtopic.name);
      if (topicRecord) {
        databaseTopicId = topicRecord.id.toString();
      }
    } catch (error) {
      // Silently handle error
    }

    // Navigate to accounting lesson screen with retry mode enabled
    router.push({
      pathname: '/accounting-lesson',
      params: {
        topicId: databaseTopicId || topicId as string,
        topicName: topicName as string,
        subtopicId: subtopic.id,
        subtopicName: subtopic.name,
        levelId: level.id,
        levelName: level.name,
        retry: 'true'
      }
    });
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleClosePress = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background, // use theme background
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.textSecondary + '22',
      backgroundColor: colors.card, // use theme card
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    closeButton: {
      padding: 8,
      marginLeft: 12,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      flexShrink: 1,
      flexWrap: 'wrap',
      minWidth: 0,
    },
    content: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 16,
      paddingBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    subtopicsContainer: {
      gap: 18,
    },
    subtopicCard: {
      backgroundColor: colors.card, // use theme card
      paddingVertical: 22,
      paddingHorizontal: 18,
      paddingRight: 32, // Add extra right padding for icon spacing
      borderRadius: 18,
      borderWidth: 0,
      marginBottom: 18,
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.25 : 0.10,
      shadowRadius: 10,
      elevation: 4,
    },
    subtopicCardPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    subtopicName: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.1,
    },
    subtopicNameContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    subtopicEmoji: {
      fontSize: 20,
      marginRight: 10,
      paddingTop: 8,
    },
    subtopicHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    expandIcon: {
      fontSize: 20,
      color: colors.textSecondary,
      marginRight: 18, // Increased for more space from the edge
    },
    levelsContainer: {
      flexDirection: 'column',
      gap: 18,
      flexWrap: 'nowrap',
      marginTop: 8,
      marginBottom: 8,
    },
    levelCard: {
      width: '100%',
      alignSelf: 'center',
      backgroundColor: colors.card, // use theme card
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      shadowColor: isDark ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.textSecondary + '22',
      flexDirection: 'column',
      justifyContent: 'center',
    },
    levelCardLocked: {
      backgroundColor: isDark ? '#23232A' : '#f3f3f3',
      borderColor: isDark ? '#333344' : '#e0e0e0',
    },
    levelCardCompleted: {
      backgroundColor: colors.primary + '10',
      borderColor: colors.primary + '40',
    },
    levelCardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    levelCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 6,
    },
    lockIcon: {
      marginRight: 6,
      fontSize: 18,
      color: colors.textSecondary,
    },
    completionIcon: {
      marginRight: 6,
      fontSize: 18,
      color: colors.primary,
    },
    levelCardTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      color: isDark ? '#B6A6FF' : '#6C47FF',
      marginLeft: 2,
      flexShrink: 1,
    },
    completedLevelText: {
      color: colors.primary,
      fontWeight: 'bold',
    },
    lockedLevelText: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 'auto',
      gap: 4,
    },
    progressText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
      minWidth: 36,
      textAlign: 'right',
    },
    progressBar: {
      height: 8,
      width: 60,
      backgroundColor: colors.textSecondary + '18',
      borderRadius: 999,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 999,
    },
    levelCardGoal: {
      fontSize: 13,
      color: isDark ? '#CCCCCC' : '#333',
      marginBottom: 2,
      marginTop: 2,
    },
    levelCardUseCase: {
      fontSize: 12,
      color: isDark ? '#AAAAAA' : '#888',
      marginBottom: 2,
    },
    lockMessage: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
      marginTop: 4,
    },
    completionMessage: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
      marginTop: 4,
    },
    retryButton: {
      backgroundColor: isDark ? '#FF8B5C' : '#FF6B35',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    retryButtonText: {
      color: isDark ? '#222' : '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    retryButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.95 }],
    },
    subtopicDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
      marginTop: 4,
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={{ marginTop: 12, color: colors.textSecondary }}>
            Loading subtopics...
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!topic) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <ThemedText style={{ fontSize: 24, marginRight: 8 }}>
              📘
            </ThemedText>
            <ThemedText style={styles.headerTitle} numberOfLines={2} ellipsizeMode="tail">
              Topic
            </ThemedText>
          </View>
          <Pressable style={styles.closeButton} onPress={handleClosePress}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <ThemedText style={{ color: colors.textSecondary }}>
            Topic not found
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <ThemedText style={{ fontSize: 24, marginRight: 8 }}>
            {topic ? (topicEmojis.topic_emojis as any)[topic.name] || '📘' : '📘'}
          </ThemedText>
          <ThemedText style={styles.headerTitle} numberOfLines={2} ellipsizeMode="tail">
            {topic?.name || 'Topic'}
          </ThemedText>
        </View>
        
        <Pressable style={styles.closeButton} onPress={handleClosePress}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.subtopicsContainer}>
          {topic.subtopics.map((subtopic, idx) => {
            const isExpanded = expandedSubtopics.has(subtopic.id);
            return (
              <Pressable
                key={subtopic.id}
                style={({ pressed }) => [
                  styles.subtopicCard,
                  { backgroundColor: cardColors[idx % cardColors.length], borderWidth: 0, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
                  pressed && styles.subtopicCardPressed,
                ]}
                onPress={() => toggleSubtopicExpansion(subtopic.id)}
              >
                <View style={styles.subtopicHeader}>
                  <View style={styles.subtopicNameContainer}>
                    <ThemedText style={[styles.subtopicEmoji, { fontSize: 28 }]}> {/* Larger emoji */}
                      {(subtopicEmojis.subtopic_emojis as any)[subtopic.name] || '📚'}
                    </ThemedText>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.subtopicName, { fontSize: 14 }]}> {/* Larger name */}
                        {subtopic.name}
                      </ThemedText>
                      <ThemedText style={styles.subtopicDescription}>
                        {SUBTOPIC_DESCRIPTIONS[subtopic.name] || 'Learn essential accounting concepts and practices.'}
                      </ThemedText>
                    </View>
                  </View>
                  <Ionicons 
                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                    style={styles.expandIcon} 
                  />
                </View>
                
                {isExpanded && (
                  <View style={styles.levelsContainer}>
                    {subtopic.levels.map((level, levelIndex) => {
                      const details = levelDetails[level.name] || {};
                      const emoji = levelEmojis[level.name] || '';
                      const isUnlocked = isLevelUnlocked(subtopic.id, levelIndex);
                      const completionStatus = levelCompletionStatus[subtopic.id]?.[levelIndex];
                      const progressPercentage = completionStatus && completionStatus.total_questions > 0 
                        ? (completionStatus.correctly_answered_questions / completionStatus.total_questions) * 100 
                        : 0;
                      const accuracyPercentage = completionStatus && (completionStatus.correctly_answered_questions + completionStatus.incorrectly_answered_questions) > 0
                        ? (completionStatus.correctly_answered_questions / (completionStatus.correctly_answered_questions + completionStatus.incorrectly_answered_questions)) * 100
                        : 0;
                      const hasIncorrect = incorrectQuestions[subtopic.id]?.includes(level.name) || false;
                      
                      // Calculate unlocking criteria for current level
                      const totalAnswered = completionStatus ? (completionStatus.correctly_answered_questions + completionStatus.incorrectly_answered_questions) : 0;
                      const meetsUnlockCriteria = totalAnswered >= 9 && accuracyPercentage >= 80;
                      
                      return (
                        <Pressable
                          key={level.id}
                          style={({ pressed }) => [
                            styles.levelCard,
                            !isUnlocked && styles.levelCardLocked,
                            pressed && isUnlocked && styles.levelCardPressed,
                            completionStatus?.is_completed && styles.levelCardCompleted,
                          ]}
                          onPress={() => handleLevelPress(subtopic, level)}
                          disabled={!isUnlocked}
                        >
                          <View style={styles.levelCardHeader}>
                            {!isUnlocked && (
                              <Ionicons name="lock-closed" style={styles.lockIcon} />
                            )}
                            {completionStatus?.is_completed && (
                              <Ionicons name="checkmark-circle" style={styles.completionIcon} />
                            )}
                            <ThemedText style={[
                              styles.levelCardTitle,
                              !isUnlocked && styles.lockedLevelText,
                              completionStatus?.is_completed && styles.completedLevelText,
                            ]}>
                              {level.name}
                            </ThemedText>
                            {completionStatus && completionStatus.total_questions > 0 && isUnlocked && (
                              <View style={styles.progressContainer}>
                                
                                
                                <ThemedText style={[styles.progressText, { marginLeft: 4, color: colors.primary, fontWeight: 'bold' }]}>
                                  ({Math.round(progressPercentage)}%)
                                </ThemedText>
                                <View style={styles.progressBar}>
                                  <View 
                                    style={[
                                      styles.progressFill, 
                                      { width: `${progressPercentage}%` }
                                    ]} 
                                  />
                                </View>
                              </View>
                            )}
                          </View>
                          <ThemedText style={styles.levelCardGoal}>
                            {details.goal}
                          </ThemedText>
                          <ThemedText style={styles.levelCardUseCase}>
                            {details.useCase}
                          </ThemedText>
                         
                          {completionStatus?.is_completed && isUnlocked && (
                            <ThemedText style={styles.completionMessage}>
                              ✓ Level completed! ({Math.round(progressPercentage)}% progress, {Math.round(accuracyPercentage)}% accuracy)
                            </ThemedText>
                          )}
                          {completionStatus && !completionStatus.is_completed && completionStatus.total_questions > 0 && isUnlocked && (
                            <ThemedText style={[styles.completionMessage, { color: colors.textSecondary }]}>
                              📊 {Math.round(accuracyPercentage)}% accuracy
                            </ThemedText>
                          )}
                          
                      
                          {hasIncorrect && isUnlocked && (
                            <Pressable
                              style={({ pressed }) => [
                                styles.retryButton,
                                pressed && styles.retryButtonPressed
                              ]}
                              onPress={() => handleRetryPress(subtopic, level)}
                            >
                              <ThemedText style={styles.retryButtonText}>
                                🔄 Retry Incorrect
                              </ThemedText>
                            </Pressable>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <LevelUnlockModal
        visible={levelUnlockModalVisible}
        onDismiss={() => {
          setLevelUnlockModalVisible(false);
        }}
        unlockedLevel={unlockedLevel}
      />
    </SafeAreaView>
  );
} 