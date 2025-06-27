import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { analytics } from '@/services/analytics';
import subtopicEmojis from '@/assets/subtopic_emojis.json';
import topicEmojis from '@/assets/topic_emojis.json';

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

// Fun color palette for subtopic cards
const cardColors = [
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
  'Level 3: Adjustments': {
    goal: 'Apply real-world scenarios, journal updates, financial statement edits',
    useCase: 'Prep for complex examples',
  },
  'Level 4: Challenge Mode': {
    goal: 'Solve integrated exam-style problems with distractors or time pressure',
    useCase: 'Exam prep, confident learners',
  },
};

// Add emoji mapping for each level
const levelEmojis: Record<string, string> = {
  'Level 1: Basics': '🧠✨',
  'Level 2: Core Practice': '🛠️📘',
  'Level 3: Adjustments': '🧾🔍',
  'Level 4: Challenge Mode': '🎯🔥',
};

export default function SubtopicsScreen() {
  const { topicId, topicName, subtopics } = useLocalSearchParams();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const loadTopic = () => {
      try {
        // Parse subtopics from route params
        let parsedSubtopics: Subtopic[] = [];
        
        if (subtopics && typeof subtopics === 'string') {
          try {
            parsedSubtopics = JSON.parse(subtopics);
          } catch (parseError) {
            console.error('Error parsing subtopics:', parseError);
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
        console.error('Error loading topic:', error);
        setIsLoading(false);
      }
    };

    loadTopic();
  }, [topicId, topicName, subtopics]);

  const handleLevelPress = (subtopic: Subtopic, level: Level) => {
    if (!level.unlocked) return; // Don't allow clicking locked levels
    
    analytics.track('accounting_level_selected', {
      topic_id: topicId,
      topic_name: topicName,
      subtopic_id: subtopic.id,
      subtopic_name: subtopic.name,
      level_id: level.id,
      level_name: level.name
    });

    // Navigate to accounting lesson screen with level info
    router.push({
      pathname: '/accounting-lesson',
      params: {
        topicId: topicId as string,
        topicName: topicName as string,
        subtopicId: subtopic.id,
        subtopicName: subtopic.name,
        levelId: level.id,
        levelName: level.name
      }
    });
  };

  const handleBackPress = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#181926' : '#F7F7FA', // soft background
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: isDark ? colors.surface : '#fff',
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    backButton: {
      padding: 8,
      marginRight: 12,
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
      backgroundColor: isDark ? colors.surface : '#fff',
      paddingVertical: 22,
      paddingHorizontal: 18,
      borderRadius: 18,
      borderWidth: 0,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 10,
      elevation: 4,
    },
    subtopicName: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 14,
      letterSpacing: 0.1,
    },
    subtopicNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    subtopicEmoji: {
      fontSize: 20,
      marginRight: 10,
    },
    levelsContainer: {
      flexDirection: 'column',
      gap: 16,
      flexWrap: 'nowrap',
    },
    levelCard: {
      width: '100%',
      alignSelf: 'center',
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 14,
      marginRight: 0,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: '#eee',
    },
    levelCardLocked: {
      backgroundColor: '#f3f3f3',
      borderColor: '#e0e0e0',
    },
    levelCardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    levelCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    levelCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#6C47FF',
      marginLeft: 2,
    },
    levelCardGoal: {
      fontSize: 12,
      color: '#333',
      marginBottom: 2,
    },
    levelCardUseCase: {
      fontSize: 11,
      color: '#888',
    },
    levelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primary + '18',
      marginRight: 0,
      marginBottom: 4,
    },
    levelBadgePressed: {
      opacity: 0.8,
      transform: [{ scale: 0.95 }],
    },
    levelText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
      letterSpacing: 0.1,
    },
    lockedLevelBadge: {
      backgroundColor: colors.textSecondary + '18',
    },
    lockedLevelText: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    lockIcon: {
      marginRight: 5,
      fontSize: 14,
      color: colors.textSecondary,
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
          <Pressable style={styles.backButton} onPress={handleBackPress}>
            <ThemedText style={{ fontSize: 18, color: colors.primary }}>
              ← 
            </ThemedText>
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
        <Pressable style={styles.backButton} onPress={handleBackPress}>
          <ThemedText style={{ fontSize: 18, color: colors.primary }}>
            ← 
          </ThemedText>
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <ThemedText style={{ fontSize: 24, marginRight: 8 }}>
            {(topicEmojis.topic_emojis as any)[topic.name] || '📘'}
          </ThemedText>
          <ThemedText style={styles.headerTitle} numberOfLines={2} ellipsizeMode="tail">
            {topic.name}
          </ThemedText>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.subtopicsContainer}>
          {topic.subtopics.map((subtopic, idx) => (
            <View
              key={subtopic.id}
              style={[
                styles.subtopicCard,
                { backgroundColor: cardColors[idx % cardColors.length], borderWidth: 0, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
              ]}
            >
              <View style={styles.subtopicNameContainer}>
                <ThemedText style={[styles.subtopicEmoji, { fontSize: 28 }]}> {/* Larger emoji */}
                  {(subtopicEmojis.subtopic_emojis as any)[subtopic.name] || '📚'}
                </ThemedText>
                <ThemedText style={[styles.subtopicName, { fontSize: 14 }]}> {/* Larger name */}
                  {subtopic.name}
                </ThemedText>
              </View>
              <View style={styles.levelsContainer}>
                {subtopic.levels.map((level) => {
                  const details = levelDetails[level.name] || {};
                  const emoji = levelEmojis[level.name] || '';
                  return (
                    <Pressable
                      key={level.id}
                      style={({ pressed }) => [
                        styles.levelCard,
                        !level.unlocked && styles.levelCardLocked,
                        pressed && level.unlocked && styles.levelCardPressed,
                      ]}
                      onPress={() => handleLevelPress(subtopic, level)}
                      disabled={!level.unlocked}
                    >
                      <View style={styles.levelCardHeader}>
                        {!level.unlocked && (
                          <Ionicons name="lock-closed" style={styles.lockIcon} />
                        )}
                        <ThemedText style={{ fontSize: 18, marginRight: 6 }}>{emoji}</ThemedText>
                        <ThemedText style={[
                          styles.levelCardTitle,
                          !level.unlocked && styles.lockedLevelText,
                        ]}>
                          {level.name}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.levelCardGoal}>
                        {details.goal}
                      </ThemedText>
                      <ThemedText style={styles.levelCardUseCase}>
                        {details.useCase}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 