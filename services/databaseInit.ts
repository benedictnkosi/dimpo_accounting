import { initDatabase, insertTopic, insertQuestion, getAllTopics, clearAllTopics, clearAllQuestions, clearAllQuestionReports } from './database';
import { SAMPLE_QUESTIONS } from './sampleQuestons';

// Database initialization state
let isInitialized = false;
let isInitializing = false;

// Extract unique topics from questions data
function extractUniqueTopicsFromQuestions(): { mainTopic: string; subTopic: string }[] {
  const topicMap = new Map<string, Set<string>>();
  
  // Extract all unique mainTopic and subTopic combinations
  SAMPLE_QUESTIONS.forEach(question => {
    if (!topicMap.has(question.mainTopic)) {
      topicMap.set(question.mainTopic, new Set());
    }
    topicMap.get(question.mainTopic)!.add(question.subTopic);
  });
  
  // Convert to array format
  const uniqueTopics: { mainTopic: string; subTopic: string }[] = [];
  topicMap.forEach((subTopics, mainTopic) => {
    subTopics.forEach(subTopic => {
      uniqueTopics.push({ mainTopic, subTopic });
    });
  });
  
  return uniqueTopics;
}

// Helper to get topic id by main topic and subtopic
async function getTopicId(mainTopic: string, subTopic: string): Promise<number | null> {
  try {
    const allTopics = await getAllTopics();
    const found = allTopics.find(t => t.main_topic === mainTopic && t.sub_topic === subTopic);
    return found ? found.id : null;
  } catch (error) {
    console.error('[Database] Error getting topic id for', mainTopic, subTopic, ':', error);
    return null;
  }
}

/**
 * Initialize the database and populate with topics from questions data and questions if empty
 * This should be called once when the app starts
 */
export const initializeDatabaseOnStartup = async (force: boolean = false): Promise<void> => {
  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    return;
  }

  if (isInitialized && !force) {
    return;
  }

  isInitializing = true;

  try {
    // Initialize the database (creates tables)
    initDatabase();

    // Check if topics already exist
    const topics = await getAllTopics();
    
    if (topics.length === 0 || force) {
      // Only clear and repopulate if database is empty or force is true
      if (force) {
        await clearAllQuestions();
        await clearAllTopics();
        await clearAllQuestionReports();
      }

      // Extract unique topics from questions data
      const uniqueTopics = extractUniqueTopicsFromQuestions();
      
      // Insert topics extracted from questions data
      for (const topic of uniqueTopics) {
        try {
          await insertTopic(topic.mainTopic, topic.subTopic);
        } catch (error) {
          console.error('[Database] Error inserting topic', topic, ':', error);
        }
      }

      // Insert sample questions (lookup topic id dynamically)
      let insertedQuestions = 0;
      let skippedQuestions = 0;
      
      for (const question of SAMPLE_QUESTIONS) {
        try {
          const topicId = await getTopicId(question.mainTopic, question.subTopic);
          if (!topicId) {
            console.warn(`[Database] Could not find topic id for question:`, question.mainTopic, question.subTopic);
            skippedQuestions++;
            continue;
          }
          await insertQuestion({
            accounting_topic_id: topicId,
            level: question.level,
            question_id: question.question_id,
            question_type: question.question_type,
            prompt: question.prompt,
            options: question.options,
            answer: question.answer,
            categories: question.categories,
            items: question.items,
            correct_order: question.correct_order,
            pairs: question.pairs,
            context: question.context,
            steps: question.steps,
            explanation: question.explanation,
            active: question.active !== undefined ? question.active : 1
          });
          insertedQuestions++;
        } catch (error) {
          console.error('[Database] Error inserting question', question.question_id, ':', error);
          skippedQuestions++;
        }
      }
    } else {
      // console.log('[Database] Topics already exist, skipping repopulation.');
    }

    isInitialized = true;
  } catch (error) {
    console.error('[Database] Error during database initialization:', error);
    isInitialized = false;
    throw error;
  } finally {
    isInitializing = false;
  }
};

/**
 * Check if the database has been initialized
 */
export const isDatabaseInitialized = (): boolean => {
  return isInitialized;
};

/**
 * Force re-initialization of the database
 * Useful for testing or when you need to reset the database
 */
export const forceDatabaseInitialization = async (): Promise<void> => {
  isInitialized = false;
  isInitializing = false;
  await initializeDatabaseOnStartup(true);
};

// Populate database with topics from questions data (for manual use)
export const populateTopicsFromQuestions = async (): Promise<void> => {
  try {
    const uniqueTopics = extractUniqueTopicsFromQuestions();
    
    for (const topic of uniqueTopics) {
      await insertTopic(topic.mainTopic, topic.subTopic);
    }
  } catch (error) {
    console.error('Error populating topics from questions data:', error);
    throw error;
  }
};

// Populate database with sample questions (for manual use)
export const populateSampleQuestions = async (): Promise<void> => {
  try {
    for (const question of SAMPLE_QUESTIONS) {
      const topicId = await getTopicId(question.mainTopic, question.subTopic);
      if (!topicId) {
        console.warn(`[Database] Could not find topic id for question:`, question);
        continue;
      }
      await insertQuestion({
        accounting_topic_id: topicId,
        level: question.level,
        question_id: question.question_id,
        question_type: question.question_type,
        prompt: question.prompt,
        options: question.options,
        answer: question.answer,
        categories: question.categories,
        items: question.items,
        correct_order: question.correct_order,
        pairs: question.pairs,
        context: question.context,
        steps: question.steps,
        explanation: question.explanation,
        active: question.active !== undefined ? question.active : 1
      });
    }
  } catch (error) {
    console.error('Error populating sample questions:', error);
    throw error;
  }
}; 