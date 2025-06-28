import { HOST_URL } from '@/config/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, StyleSheet, TouchableOpacity, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './ThemedText';

const avatarImages: Record<string, ImageSourcePropType> = {
  '1': require('../assets/images/avatars/1.png'),
  '2': require('../assets/images/avatars/2.png'),
  '3': require('../assets/images/avatars/3.png'),
  '4': require('../assets/images/avatars/4.png'),
  '5': require('../assets/images/avatars/5.png'),
  '6': require('../assets/images/avatars/6.png'),
  '7': require('../assets/images/avatars/7.png'),
  '8': require('../assets/images/avatars/8.png'),
  '9': require('../assets/images/avatars/9.png'),
  'default': require('../assets/images/avatars/8.png'),
};

interface LearnerInfo {
  name: string;
  avatar?: string;
  points?: number;
  streak?: number;
  school?: string;
}

interface StreakInfo {
  calculatedFromProgress: boolean;
  id: number;
  lastActivityDate: string;
  streak: number;
  uid: string;
}

function getInitial(name?: string) {
  if (!name) return '';
  return name.trim().charAt(0).toUpperCase();
}

export function Header() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [learnerInfo, setLearnerInfo] = useState<LearnerInfo | null>(null);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLearnerInfo() {
      try {
        const authData = await SecureStore.getItemAsync('auth');
        if (!authData) {
          setIsLoading(false);
          return;
        }
        const { user } = JSON.parse(authData);
        if (!user?.uid) {
          setIsLoading(false);
          return;
        }
        const [learnerResponse, streakResponse] = await Promise.all([
          fetch(`${HOST_URL}/api/language-learners/uid/${user.uid}`),
          fetch(`${HOST_URL}/api/language-learners/${user.uid}/streak`)
        ]);

        if (!learnerResponse.ok || !streakResponse.ok) {
          throw new Error('Failed to fetch learner info');
        }

        const [learnerData, streakData] = await Promise.all([
          learnerResponse.json(),
          streakResponse.json()
        ]);

        setLearnerInfo(learnerData);
        setStreakInfo(streakData);
      } catch (error) {
        console.error('Error fetching learner info:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLearnerInfo();
  }, []);

  const avatarSource = learnerInfo?.avatar && avatarImages[learnerInfo.avatar]
    ? avatarImages[learnerInfo.avatar]
    : avatarImages['default'];

  const handleViewReport = () => {
    router.push('/report');
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: isDark ? '#1F2937' : '#F8FAFC' }]}>
      <View style={styles.row}>
        <View style={styles.greetingSection}>
          <ThemedText style={[styles.greetingText, { color: isDark ? '#F3F4F6' : '#22223B' }]}>
            Dimpo Accounting <ThemedText style={styles.wave}>💰</ThemedText>
          </ThemedText>
          <ThemedText style={[styles.schoolText, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
            Master Accounting with interactive lessons.
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#7C3AED' : '#8B5CF6' }]}>
            {learnerInfo?.avatar ? (
              <Image
                source={avatarSource}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <ThemedText style={styles.avatarInitial}>
                {getInitial(learnerInfo?.name) || 'U'}
              </ThemedText>
            )}
          </View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity 
        style={[styles.reportCard, { backgroundColor: isDark ? '#374151' : '#FFF' }]}
        onPress={handleViewReport}
      >
        <View style={styles.reportContent}>
          <MaterialCommunityIcons name="chart-line" size={32} color="#3B82F6" style={styles.reportIcon} />
          <View style={styles.reportTextContainer}>
            <ThemedText style={[styles.reportTitle, { color: isDark ? '#F3F4F6' : '#22223B' }]}>
              View My Report
            </ThemedText>
            <ThemedText style={[styles.reportSubtitle, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
              Track your learning progress
            </ThemedText>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={isDark ? '#9CA3AF' : '#64748B'} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  greetingSection: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
  },
  wave: {
    fontSize: 22,
  },
  schoolText: {
    fontSize: 15,
    marginTop: 2,
    fontWeight: '500',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
  },
  reportCard: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  reportContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportIcon: {
    marginRight: 16,
  },
  reportTextContainer: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  reportSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 