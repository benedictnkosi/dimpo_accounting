import { useEffect, useState } from 'react';
import { initDatabase, getAllTopics, insertTopic, getTopicsByMainTopic, deleteTopic, clearAllTopics } from '@/services/database';
import { isDatabaseInitialized, initializeDatabaseOnStartup } from '@/services/databaseInit';

export interface Topic {
  id: number;
  main_topic: string;
  sub_topic: string;
}

export const useDatabase = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);

  // Initialize database on mount
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('[useDatabase] Checking database initialization...');
        
        // Check if database is already initialized
        if (!isDatabaseInitialized()) {
          console.log('[useDatabase] Database not initialized, starting initialization...');
          await initializeDatabaseOnStartup();
          console.log('[useDatabase] Database initialization completed');
        } else {
          console.log('[useDatabase] Database already initialized');
        }
        
        setIsInitialized(true);
        setIsLoading(false);
      } catch (err) {
        console.error('[useDatabase] Error during database initialization:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize database');
        setIsLoading(false);
      }
    };

    initializeDatabase();
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