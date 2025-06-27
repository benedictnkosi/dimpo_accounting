import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useDatabase, Topic } from '@/hooks/useDatabase';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { populateDatabaseWithTopics } from '@/services/databaseUtils';

export const DatabaseTest: React.FC = () => {
  const { colors } = useTheme();
  const { isInitialized, isLoading, error, addTopic, getTopics, removeTopic, clearTopics } = useDatabase();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [mainTopic, setMainTopic] = useState('');
  const [subTopic, setSubTopic] = useState('');
  const [isPopulating, setIsPopulating] = useState(false);

  // Load topics on mount
  useEffect(() => {
    if (isInitialized) {
      loadTopics();
    }
  }, [isInitialized]);

  const loadTopics = async () => {
    try {
      const fetchedTopics = await getTopics();
      setTopics(fetchedTopics);
    } catch (err) {
      console.error('Failed to load topics:', err);
    }
  };

  const handleAddTopic = async () => {
    if (!mainTopic.trim() || !subTopic.trim()) {
      Alert.alert('Error', 'Please enter both main topic and sub topic');
      return;
    }

    try {
      await addTopic(mainTopic.trim(), subTopic.trim());
      setMainTopic('');
      setSubTopic('');
      await loadTopics(); // Reload topics
      Alert.alert('Success', 'Topic added successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to add topic');
    }
  };

  const handleDeleteTopic = async (id: number) => {
    try {
      await removeTopic(id);
      await loadTopics(); // Reload topics
      Alert.alert('Success', 'Topic deleted successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to delete topic');
    }
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Confirm Clear',
      'Are you sure you want to delete all topics?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearTopics();
              setTopics([]);
              Alert.alert('Success', 'All topics cleared!');
            } catch (err) {
              Alert.alert('Error', 'Failed to clear topics');
            }
          },
        },
      ]
    );
  };

  const handlePopulateDatabase = async () => {
    Alert.alert(
      'Populate Database',
      'This will populate the database with sample accounting topics from the JSON data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Populate',
          onPress: async () => {
            setIsPopulating(true);
            try {
              await populateDatabaseWithTopics();
              await loadTopics(); // Reload topics
              Alert.alert('Success', 'Database populated with sample data!');
            } catch (err) {
              Alert.alert('Error', 'Failed to populate database');
            } finally {
              setIsPopulating(false);
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
    },
    statusContainer: {
      padding: 10,
      borderRadius: 8,
      marginBottom: 20,
    },
    inputContainer: {
      marginBottom: 20,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 10,
    },
    buttonText: {
      color: '#fff',
      fontWeight: '600',
    },
    clearButton: {
      backgroundColor: '#ff4444',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 10,
    },
    populateButton: {
      backgroundColor: '#4caf50',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 20,
    },
    topicItem: {
      backgroundColor: colors.surface,
      padding: 15,
      borderRadius: 8,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    topicHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 5,
    },
    deleteButton: {
      backgroundColor: '#ff4444',
      padding: 6,
      borderRadius: 4,
    },
    deleteButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    emptyText: {
      textAlign: 'center',
      opacity: 0.6,
      marginTop: 20,
    },
  });

  if (!isInitialized) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Initializing database...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={[styles.statusContainer, { backgroundColor: error ? '#ffebee' : '#e8f5e8' }]}>
        <ThemedText style={{ color: error ? '#c62828' : '#2e7d32' }}>
          Status: {error ? `Error: ${error}` : 'Database ready'}
        </ThemedText>
        {(isLoading || isPopulating) && (
          <ThemedText style={{ color: '#1976d2' }}>
            {isPopulating ? 'Populating database...' : 'Loading...'}
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Main Topic"
          placeholderTextColor={colors.textSecondary}
          value={mainTopic}
          onChangeText={setMainTopic}
        />
        <TextInput
          style={styles.input}
          placeholder="Sub Topic"
          placeholderTextColor={colors.textSecondary}
          value={subTopic}
          onChangeText={setSubTopic}
        />
        <TouchableOpacity style={styles.button} onPress={handleAddTopic}>
          <Text style={styles.buttonText}>Add Topic</Text>
        </TouchableOpacity>
      </ThemedView>

      <TouchableOpacity style={styles.populateButton} onPress={handlePopulateDatabase}>
        <Text style={styles.buttonText}>Populate with Sample Data</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
        <Text style={styles.buttonText}>Clear All Topics</Text>
      </TouchableOpacity>

      <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        Topics ({topics.length})
      </ThemedText>

      {topics.length === 0 ? (
        <ThemedText style={styles.emptyText}>No topics found. Add some topics above or populate with sample data!</ThemedText>
      ) : (
        topics.map((topic) => (
          <ThemedView key={topic.id} style={styles.topicItem}>
            <View style={styles.topicHeader}>
              <ThemedText style={{ fontWeight: '600' }}>ID: {topic.id}</ThemedText>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteTopic(topic.id)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
            <ThemedText style={{ marginBottom: 5 }}>
              <ThemedText style={{ fontWeight: '600' }}>Main Topic:</ThemedText> {topic.main_topic}
            </ThemedText>
            <ThemedText>
              <ThemedText style={{ fontWeight: '600' }}>Sub Topic:</ThemedText> {topic.sub_topic}
            </ThemedText>
          </ThemedView>
        ))
      )}
    </ScrollView>
  );
}; 