import { useEffect, useState } from 'react';
import { initDatabase, getAllTopics, insertTopic, getTopicsByMainTopic, deleteTopic, clearAllTopics } from '@/services/database';

export interface Topic {
  id: number;
  main_topic: string;
  sub_topic: string;
}

export const useDatabase = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize database on mount
  useEffect(() => {
    try {
      initDatabase();
      setIsInitialized(true);
    } catch (err) {
      console.error('Failed to initialize database:', err);
      setError('Failed to initialize database');
    }
  }, []);

  // Insert a new topic
  const addTopic = async (mainTopic: string, subTopic: string): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Database not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await insertTopic(mainTopic, subTopic);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to insert topic';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Get all topics
  const getTopics = async (): Promise<Topic[]> => {
    if (!isInitialized) {
      throw new Error('Database not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const topics = await getAllTopics();
      return topics;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch topics';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Get topics by main topic
  const getTopicsByMain = async (mainTopic: string): Promise<Topic[]> => {
    if (!isInitialized) {
      throw new Error('Database not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const topics = await getTopicsByMainTopic(mainTopic);
      return topics;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch topics by main topic';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a topic
  const removeTopic = async (id: number): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Database not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await deleteTopic(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete topic';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all topics
  const clearTopics = async (): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Database not initialized');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await clearAllTopics();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear topics';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  return {
    isInitialized,
    isLoading,
    error,
    addTopic,
    getTopics,
    getTopicsByMain,
    removeTopic,
    clearTopics,
    clearError,
  };
}; 