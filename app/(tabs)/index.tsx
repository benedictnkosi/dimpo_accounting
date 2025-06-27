import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { HOST_URL } from '@/config/api';
import { useTheme } from '@/contexts/ThemeContext';
import { analytics } from '@/services/analytics';

// Import the JSON data for main topics only
import accountingData from '@/assets/accounting_full_33_subtopics.json';
import topicEmojis from '@/assets/topic_emojis.json';

interface Topic {
  id: string;
  name: string;
  subtopics?: Subtopic[];
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

interface ApiSubtopicResponse {
  main_topic: string;
  subtopics: {
    topic: string;
    levels: string[];
  }[];
}

// Unique color for each topic card - updated for dark mode compatibility
const TOPIC_COLORS: Record<string, { light: string; dark: string }> = {
  'Financial Statements': { light: '#FDE68A', dark: '#92400E' },
  'Cash Flow & Equity': { light: '#E0E7FF', dark: '#3730A3' },
  'Ratio Analysis & Interpretation': { light: '#FEF3C7', dark: '#92400E' },
  'Cost Concepts & Internal Control': { light: '#DBEAFE', dark: '#1E40AF' },
  'Corporate Governance & Ethics': { light: '#FDE68A', dark: '#92400E' },
  'Company Capital & Shareholders': { light: '#F3F4F6', dark: '#374151' },
};

// Topic descriptions with engaging content
const TOPIC_DESCRIPTIONS: Record<string, { tagline: string; description: string }> = {
  'Financial Statements': {
    tagline: '🧾 Financial Statements',
    description: 'Learn how businesses report income, expenses, and profit. Understand what the Income Statement and Balance Sheet really say. 📊💸'
  },
  'Cash Flow & Equity': {
    tagline: '💵 Cash Flow & Equity',
    description: 'Follow the cash! Track how money moves in and out, and how owners earn from shares and dividends. 🔁💰'
  },
  'Ratio Analysis & Interpretation': {
    tagline: '📈 Ratio Analysis & Interpretation',
    description: 'Use financial ratios to spot strengths, weaknesses, and red flags. It\'s business detective work. 🕵️‍♀️📉'
  },
  'Cost Concepts & Internal Control': {
    tagline: '🛠 Cost Concepts & Internal Control',
    description: 'Control stock, manage spending, and catch errors early. Learn how smart businesses stay efficient. 🧾📦🔒'
  },
  'Corporate Governance & Ethics': {
    tagline: '🏛 Corporate Governance & Ethics',
    description: 'Discover how companies stay fair and honest — from directors to auditors to whistleblowers. ⚖️🤝'
  },
  'Company Capital & Shareholders': {
    tagline: '📉 Company Capital & Shareholders',
    description: 'See how companies raise money through shares, pay dividends, and grow ownership. 📈💼'
  },
};

export default function HomeScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const router = useRouter();
  const { colors, isDark } = useTheme();

  // Load main topics from JSON file
  useEffect(() => {
    const loadTopics = () => {
      try {
        // Only use the main topics from the JSON, without subtopics
        const mainTopics = accountingData.topics.map(topic => ({
          id: topic.id,
          name: topic.name
        }));
        setTopics(mainTopics);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading topics:', error);
        setError('Failed to load topics');
        setIsLoading(false);
      }
    };

    loadTopics();
  }, []);

  // Track home screen view
  useEffect(() => {
    analytics.track('accounting_home_screen_viewed', {
      topics_count: topics.length,
      is_loading: isLoading,
      has_error: !!error
    });
  }, [topics.length, isLoading, error]);

  const fetchSubtopics = async (topicName: string): Promise<{ topic: string; levels: string[] }[]> => {
    try {
      const response = await fetch(`${HOST_URL}/api/accounting-questions/main-topic/${encodeURIComponent(topicName)}/subtopics`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiSubtopicResponse = await response.json();
      return data.subtopics;
    } catch (error) {
      console.error('Error fetching subtopics:', error);
      throw error;
    }
  };

  const handleTopicPress = async (topic: Topic) => {
    try {
      // Show loading state
      setIsLoading(true);
      
      // Fetch subtopics from API
      const subtopicsData = await fetchSubtopics(topic.name);
      
      // Convert subtopic data to the expected format
      const subtopics: Subtopic[] = subtopicsData.map((subtopicData, index) => ({
        id: `${topic.id}-subtopic-${index}`,
        name: subtopicData.topic,
        levels: subtopicData.levels.map((levelName, levelIndex) => ({
          id: `${topic.id}-subtopic-${index}-level-${levelIndex}`,
          name: levelName,
          unlocked: true // You can modify this logic based on your requirements
        }))
      }));

      // Track topic selection
      analytics.track('accounting_topic_selected', {
        topic_id: topic.id,
        topic_name: topic.name,
        subtopics_count: subtopics.length
      });

      // Navigate to subtopics screen
      router.push({
        pathname: '/subtopics',
        params: {
          topicId: topic.id,
          topicName: topic.name,
          subtopics: JSON.stringify(subtopics)
        }
      });
    } catch (error) {
      console.error('Error fetching subtopics:', error);
      setError('Failed to load subtopics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareApp = async () => {
    try {
      // Track app sharing
      analytics.track('accounting_app_shared', {
        platform: 'home_screen',
        share_method: 'native_share'
      });

      const iosLink = 'https://apps.apple.com/app/dimpo-accounting/6742684696';
      const androidLink = 'https://play.google.com/store/apps/details?id=com.dimpoaccounting';
      
      await Share.share({
        message: `Check out this amazing accounting learning app! 📊💰 Master Financial Statements, Ratio Analysis, and more with interactive lessons.\n\nDownload now:\n📱 iOS: ${iosLink}\n🤖 Android: ${androidLink}`,
        title: 'Dimpo Accounting App',
      });
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      opacity: 0.7,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    topicsContainer: {
      flexDirection: 'column',
      gap: 16,
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    topicCard: {
      paddingVertical: 28,
      paddingHorizontal: 20,
      borderRadius: 18,
      width: '100%',
      alignItems: 'center',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#e6e6e6',
    },
    topicCardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    topicEmoji: {
      fontSize: 40,
      marginBottom: 10,
      paddingTop: 20,
    },
    topicName: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
      color: colors.text,
      textAlign: 'center',
    },
    topicTagline: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
      lineHeight: 18,
    },
    topicDescription: {
      fontSize: 12,
      opacity: 0.8,
      color: colors.textSecondary,
      marginBottom: 8,
      textAlign: 'center',
      lineHeight: 16,
      paddingHorizontal: 8,
    },
    topicDifficulty: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
      fontWeight: '500',
    },
    headerImage: {
      height: 200,
      width: '100%',
    },
    shareButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      marginHorizontal: 20,
      marginTop: 20,
      marginBottom: 40,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    shareButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    shareButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <ScrollView style={{ flex: 1 }}>
      <Header />
      <ThemedView style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={styles.loadingText}>Loading topics...</ThemedText>
          </View>
        ) : error ? (
          <ThemedText>{error}</ThemedText>
        ) : (
          <View>
            <ThemedView style={styles.topicsContainer}>
              {topics.map((topic) => (
                <Pressable
                  key={topic.id}
                  style={({ pressed }) => [
                    [
                      styles.topicCard,
                      {
                        backgroundColor: TOPIC_COLORS[topic.name]
                          ? (isDark
                            ? TOPIC_COLORS[topic.name].dark
                            : TOPIC_COLORS[topic.name].light)
                          : isDark
                            ? colors.surface
                            : '#fff'
                      },
                    ],
                    pressed && styles.topicCardPressed,
                  ]}
                  onPress={() => handleTopicPress(topic)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${topic.name}`}
                >
                  <ThemedText style={styles.topicEmoji}>
                    {(topicEmojis.topic_emojis as any)[topic.name] || '📊'}
                  </ThemedText>
                  <ThemedText style={styles.topicName}>
                    {topic.name}
                  </ThemedText>
                 
                  <ThemedText style={styles.topicDescription}>
                    {TOPIC_DESCRIPTIONS[topic.name]?.description || 'No description available'}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
            
            <Pressable
              style={({ pressed }) => [
                styles.shareButton,
                pressed && styles.shareButtonPressed,
              ]}
              onPress={handleShareApp}
              accessibilityRole="button"
              accessibilityLabel="Share app"
            >
              <ThemedText style={styles.shareButtonText}>
              🔗 Invite friends
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ThemedView>
    </ScrollView>
  );
}

