import * as SQLite from 'expo-sqlite';

// Database name
const DATABASE_NAME = 'dimpo_accounting.db';

// Database instance
let db: SQLite.SQLiteDatabase | null = null;

// Initialize database
export const initDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) {
    db = SQLite.openDatabaseSync(DATABASE_NAME);
    createTables();
  }
  return db;
};

// Create tables
const createTables = () => {
  if (!db) return;

  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS accounting_topic (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        main_topic TEXT NOT NULL,
        sub_topic TEXT NOT NULL,
        UNIQUE(main_topic, sub_topic)
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS accounting_question (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accounting_topic_id INTEGER NOT NULL,
        level TEXT NOT NULL,
        question_id TEXT NOT NULL,
        question_type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        options TEXT,
        answer TEXT,
        categories TEXT,
        items TEXT,
        correct_order TEXT,
        pairs TEXT,
        context TEXT,
        steps TEXT,
        explanation TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (accounting_topic_id) REFERENCES accounting_topic (id)
      );
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS question_report (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('correct', 'incorrect')),
        date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for better performance
    db.execSync('CREATE INDEX IF NOT EXISTS idx_accounting_question_level ON accounting_question (level);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_accounting_question_type ON accounting_question (question_type);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_accounting_question_topic_id ON accounting_question (accounting_topic_id);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_question_report_question_id ON question_report (question_id);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_question_report_date ON question_report (date);');
    db.execSync('CREATE INDEX IF NOT EXISTS idx_question_report_outcome ON question_report (outcome);');

  } catch (error) {
    console.error('Error creating tables:', error);
  }
};

// Insert a topic
export const insertTopic = (mainTopic: string, subTopic: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('INSERT OR IGNORE INTO accounting_topic (main_topic, sub_topic) VALUES (?, ?)', [mainTopic, subTopic]);
      resolve();
    } catch (error) {
      console.error('Error inserting topic:', error);
      reject(error);
    }
  });
};

// Insert a question
export const insertQuestion = (questionData: {
  accounting_topic_id: number;
  level: string;
  question_id: string;
  question_type: string;
  prompt: string;
  options?: string;
  answer?: string;
  categories?: string;
  items?: string;
  correct_order?: string;
  pairs?: string;
  context?: string;
  steps?: string;
  explanation?: string;
  active?: number;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const sql = `
        INSERT OR IGNORE INTO accounting_question (
          accounting_topic_id, level, question_id, question_type, prompt, 
          options, answer, categories, items, correct_order, pairs, 
          context, steps, explanation, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        questionData.accounting_topic_id,
        questionData.level,
        questionData.question_id,
        questionData.question_type,
        questionData.prompt,
        questionData.options || null,
        questionData.answer || null,
        questionData.categories || null,
        questionData.items || null,
        questionData.correct_order || null,
        questionData.pairs || null,
        questionData.context || null,
        questionData.steps || null,
        questionData.explanation || null,
        questionData.active !== undefined ? questionData.active : 1
      ];

      db.runSync(sql, params);
      resolve();
    } catch (error) {
      console.error('Error inserting question:', error);
      reject(error);
    }
  });
};

// Get all topics
export const getAllTopics = (): Promise<Array<{ id: number; main_topic: string; sub_topic: string }>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{ id: number; main_topic: string; sub_topic: string }>(
        'SELECT * FROM accounting_topic ORDER BY main_topic, sub_topic'
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching topics:', error);
      reject(error);
    }
  });
};

// Get topics by main topic
export const getTopicsByMainTopic = (mainTopic: string): Promise<Array<{ id: number; main_topic: string; sub_topic: string }>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{ id: number; main_topic: string; sub_topic: string }>(
        'SELECT * FROM accounting_topic WHERE main_topic = ? ORDER BY sub_topic',
        [mainTopic]
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching topics by main topic:', error);
      reject(error);
    }
  });
};

// Get questions by topic ID and level
export const getQuestionsByTopicAndLevel = (topicId: number, level: string): Promise<Array<{
  id: number;
  accounting_topic_id: number;
  level: string;
  question_id: string;
  question_type: string;
  prompt: string;
  options: string | null;
  answer: string | null;
  categories: string | null;
  items: string | null;
  correct_order: string | null;
  pairs: string | null;
  context: string | null;
  steps: string | null;
  explanation: string | null;
  active: number;
  created: string;
  updated: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        accounting_topic_id: number;
        level: string;
        question_id: string;
        question_type: string;
        prompt: string;
        options: string | null;
        answer: string | null;
        categories: string | null;
        items: string | null;
        correct_order: string | null;
        pairs: string | null;
        context: string | null;
        steps: string | null;
        explanation: string | null;
        active: number;
        created: string;
        updated: string;
      }>(
        'SELECT * FROM accounting_question WHERE accounting_topic_id = ? AND level = ? AND active = 1 ORDER BY id',
        [topicId, level]
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching questions by topic and level:', error);
      reject(error);
    }
  });
};

// Get all questions
export const getAllQuestions = (): Promise<Array<{
  id: number;
  accounting_topic_id: number;
  level: string;
  question_id: string;
  question_type: string;
  prompt: string;
  options: string | null;
  answer: string | null;
  categories: string | null;
  items: string | null;
  correct_order: string | null;
  pairs: string | null;
  context: string | null;
  steps: string | null;
  explanation: string | null;
  active: number;
  created: string;
  updated: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        accounting_topic_id: number;
        level: string;
        question_id: string;
        question_type: string;
        prompt: string;
        options: string | null;
        answer: string | null;
        categories: string | null;
        items: string | null;
        correct_order: string | null;
        pairs: string | null;
        context: string | null;
        steps: string | null;
        explanation: string | null;
        active: number;
        created: string;
        updated: string;
      }>(
        'SELECT * FROM accounting_question WHERE active = 1 ORDER BY accounting_topic_id, level, id'
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching all questions:', error);
      reject(error);
    }
  });
};

// Delete a topic
export const deleteTopic = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM accounting_topic WHERE id = ?', [id]);
      resolve();
    } catch (error) {
      console.error('Error deleting topic:', error);
      reject(error);
    }
  });
};

// Clear all topics
export const clearAllTopics = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM accounting_topic');
      resolve();
    } catch (error) {
      console.error('Error clearing topics:', error);
      reject(error);
    }
  });
};

// Clear all questions
export const clearAllQuestions = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM accounting_question');
      resolve();
    } catch (error) {
      console.error('Error clearing questions:', error);
      reject(error);
    }
  });
};

// Get database instance
export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) {
    return initDatabase();
  }
  return db;
};

// Close database
export const closeDatabase = () => {
  if (db) {
    db.closeSync();
    db = null;
  }
};

// Insert a question report
export const insertQuestionReport = (questionId: string, outcome: 'correct' | 'incorrect'): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const sql = `
        INSERT INTO question_report (question_id, outcome, date)
        VALUES (?, ?, ?)
      `;
      
      const currentDate = new Date().toISOString();
      db.runSync(sql, [questionId, outcome, currentDate]);
      resolve();
    } catch (error) {
      console.error('Error inserting question report:', error);
      reject(error);
    }
  });
};

// Get all question reports
export const getAllQuestionReports = (): Promise<Array<{
  id: number;
  question_id: string;
  outcome: 'correct' | 'incorrect';
  date: string;
  created: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        question_id: string;
        outcome: 'correct' | 'incorrect';
        date: string;
        created: string;
      }>(
        'SELECT * FROM question_report ORDER BY date DESC'
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching question reports:', error);
      reject(error);
    }
  });
};

// Get question reports by question ID
export const getQuestionReportsByQuestionId = (questionId: string): Promise<Array<{
  id: number;
  question_id: string;
  outcome: 'correct' | 'incorrect';
  date: string;
  created: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        question_id: string;
        outcome: 'correct' | 'incorrect';
        date: string;
        created: string;
      }>(
        'SELECT * FROM question_report WHERE question_id = ? ORDER BY date DESC',
        [questionId]
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching question reports by question ID:', error);
      reject(error);
    }
  });
};

// Get question reports by date range
export const getQuestionReportsByDateRange = (startDate: string, endDate: string): Promise<Array<{
  id: number;
  question_id: string;
  outcome: 'correct' | 'incorrect';
  date: string;
  created: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        question_id: string;
        outcome: 'correct' | 'incorrect';
        date: string;
        created: string;
      }>(
        'SELECT * FROM question_report WHERE date BETWEEN ? AND ? ORDER BY date DESC',
        [startDate, endDate]
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching question reports by date range:', error);
      reject(error);
    }
  });
};

// Get question statistics
export const getQuestionStatistics = (): Promise<{
  total_answers: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy_percentage: number;
}> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
        total_answers: number;
        correct_answers: number;
        incorrect_answers: number;
        accuracy_percentage: number;
      }>(
        `SELECT 
          COUNT(DISTINCT question_id) as total_answers,
          SUM(CASE WHEN outcome = 'correct' THEN 1 ELSE 0 END) as correct_answers,
          SUM(CASE WHEN outcome = 'incorrect' THEN 1 ELSE 0 END) as incorrect_answers,
          ROUND((SUM(CASE WHEN outcome = 'correct' THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT question_id)), 2) as accuracy_percentage
        FROM question_report`
      );
      resolve(result || { total_answers: 0, correct_answers: 0, incorrect_answers: 0, accuracy_percentage: 0 });
    } catch (error) {
      console.error('Error fetching question statistics:', error);
      reject(error);
    }
  });
};

// Clear all question reports
export const clearAllQuestionReports = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM question_report');
      resolve();
    } catch (error) {
      console.error('Error clearing question reports:', error);
      reject(error);
    }
  });
};

// Get learner progress by topic and subtopic
export const getLearnerProgressByTopic = (): Promise<Array<{
  main_topic: string;
  sub_topic: string;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  accuracy_percentage: number;
  last_activity: string | null;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        main_topic: string;
        sub_topic: string;
        total_questions: number;
        answered_questions: number;
        correct_answers: number;
        accuracy_percentage: number;
        last_activity: string | null;
      }>(
        `SELECT 
          at.main_topic,
          at.sub_topic,
          COUNT(aq.id) as total_questions,
          COALESCE(COUNT(DISTINCT qr.question_id), 0) as answered_questions,
          COALESCE(SUM(CASE WHEN qr.outcome = 'correct' THEN 1 ELSE 0 END), 0) as correct_answers,
          CASE 
            WHEN COALESCE(COUNT(DISTINCT qr.question_id), 0) > 0 
            THEN ROUND((COALESCE(SUM(CASE WHEN qr.outcome = 'correct' THEN 1 ELSE 0 END), 0) * 100.0 / COALESCE(COUNT(DISTINCT qr.question_id), 0)), 2)
            ELSE 0 
          END as accuracy_percentage,
          MAX(qr.date) as last_activity
        FROM accounting_topic at
        LEFT JOIN accounting_question aq ON at.id = aq.accounting_topic_id
        LEFT JOIN (
          SELECT * FROM question_report qr1
          WHERE qr1.date = (
            SELECT MAX(qr2.date)
            FROM question_report qr2
            WHERE qr2.question_id = qr1.question_id
          )
        ) qr ON aq.question_id = qr.question_id
        WHERE aq.active = 1
        GROUP BY at.main_topic, at.sub_topic
        ORDER BY at.main_topic, at.sub_topic`
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching learner progress by topic:', error);
      reject(error);
    }
  });
};

// Get learner progress by main topic
export const getLearnerProgressByMainTopic = (): Promise<Array<{
  main_topic: string;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  accuracy_percentage: number;
  subtopics_count: number;
  completed_subtopics: number;
  last_activity: string | null;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        main_topic: string;
        total_questions: number;
        answered_questions: number;
        correct_answers: number;
        accuracy_percentage: number;
        subtopics_count: number;
        completed_subtopics: number;
        last_activity: string | null;
      }>(
        `SELECT 
          at.main_topic,
          COUNT(aq.id) as total_questions,
          COALESCE(COUNT(DISTINCT qr.question_id), 0) as answered_questions,
          COALESCE(SUM(CASE WHEN qr.outcome = 'correct' THEN 1 ELSE 0 END), 0) as correct_answers,
          CASE 
            WHEN COALESCE(COUNT(DISTINCT qr.question_id), 0) > 0 
            THEN ROUND((COALESCE(SUM(CASE WHEN qr.outcome = 'correct' THEN 1 ELSE 0 END), 0) * 100.0 / COALESCE(COUNT(DISTINCT qr.question_id), 0)), 2)
            ELSE 0 
          END as accuracy_percentage,
          COUNT(DISTINCT at.sub_topic) as subtopics_count,
          COALESCE((SELECT COUNT(DISTINCT at.sub_topic)
            FROM accounting_topic at
            WHERE (
              SELECT COUNT(*) FROM accounting_question aq
              WHERE aq.accounting_topic_id = at.id AND aq.active = 1
            ) > 0
            AND (
              SELECT COUNT(*) FROM accounting_question aq
              WHERE aq.accounting_topic_id = at.id AND aq.active = 1
              AND aq.question_id IN (
                SELECT qr1.question_id
                FROM question_report qr1
                WHERE qr1.outcome = 'correct'
                AND qr1.date = (
                  SELECT MAX(qr2.date)
                  FROM question_report qr2
                  WHERE qr2.question_id = qr1.question_id
                )
              )
            ) = (
              SELECT COUNT(*) FROM accounting_question aq
              WHERE aq.accounting_topic_id = at.id AND aq.active = 1
            )
          ), 0) as completed_subtopics,
          MAX(qr.date) as last_activity
        FROM accounting_topic at
        LEFT JOIN accounting_question aq ON at.id = aq.accounting_topic_id
        LEFT JOIN (
          SELECT * FROM question_report qr1
          WHERE qr1.date = (
            SELECT MAX(qr2.date)
            FROM question_report qr2
            WHERE qr2.question_id = qr1.question_id
          )
        ) qr ON aq.question_id = qr.question_id
        WHERE aq.active = 1
        GROUP BY at.main_topic
        ORDER BY at.main_topic`
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching learner progress by main topic:', error);
      reject(error);
    }
  });
};

// Get recent activity (last 7 days)
export const getRecentActivity = (days: number = 7): Promise<Array<{
  date: string;
  questions_answered: number;
  correct_answers: number;
  accuracy_percentage: number;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        date: string;
        questions_answered: number;
        correct_answers: number;
        accuracy_percentage: number;
      }>(
        `SELECT 
          DATE(qr.date) as date,
          COUNT(*) as questions_answered,
          SUM(CASE WHEN qr.outcome = 'correct' THEN 1 ELSE 0 END) as correct_answers,
          ROUND((SUM(CASE WHEN qr.outcome = 'correct' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2) as accuracy_percentage
        FROM (
          SELECT * FROM question_report qr1
          WHERE qr1.date = (
            SELECT MAX(qr2.date)
            FROM question_report qr2
            WHERE qr2.question_id = qr1.question_id
          )
        ) qr
        WHERE qr.date >= DATE('now', '-${days} days')
        GROUP BY DATE(qr.date)
        ORDER BY date DESC`
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      reject(error);
    }
  });
};

// Calculate consecutive streak days
export const calculateStreakDays = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Get all unique dates where user answered questions (latest answer per question)
      const result = db.getAllSync<{ date: string }>(
        `SELECT DISTINCT DATE(date) as date
         FROM question_report qr1
         WHERE qr1.date = (
           SELECT MAX(qr2.date)
           FROM question_report qr2
           WHERE qr2.question_id = qr1.question_id
         )
         ORDER BY DATE(date) DESC`
      );

      if (!result || result.length === 0) {
        resolve(0);
        return;
      }

      // Convert to Date objects and sort in descending order
      const dates = result.map(row => new Date(row.date)).sort((a, b) => b.getTime() - a.getTime());
      
      // Get today's date (start of day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get yesterday's date
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let streak = 0;
      let currentDate = today;

      // Check if user was active today
      const hasActivityToday = dates.some(date => {
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);
        return dateOnly.getTime() === currentDate.getTime();
      });

      if (hasActivityToday) {
        streak = 1;
        currentDate = yesterday;
      } else {
        // If no activity today, start from yesterday
        currentDate = yesterday;
      }

      // Count consecutive days backwards
      for (let i = 0; i < dates.length; i++) {
        const dateOnly = new Date(dates[i]);
        dateOnly.setHours(0, 0, 0, 0);
        
        // Check if this date matches our expected consecutive date
        if (dateOnly.getTime() === currentDate.getTime()) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else if (dateOnly.getTime() < currentDate.getTime()) {
          // We've found a gap, stop counting
          break;
        }
        // If dateOnly > currentDate, continue to next date
      }

      resolve(streak);
    } catch (error) {
      console.error('Error calculating streak days:', error);
      reject(error);
    }
  });
};

export const getOverallStatistics = (): Promise<{
  total_questions_available: number;
  total_questions_answered: number;
  total_correct_answers: number;
  overall_accuracy: number;
  total_subtopics: number;
  completed_subtopics: number;
  total_main_topics: number;
  completed_main_topics: number;
  streak_days: number;
}> => {
  return new Promise(async (resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      // Calculate streak days separately
      const streakDays = await calculateStreakDays();

      const result = db.getFirstSync<{
        total_questions_available: number;
        total_questions_answered: number;
        total_correct_answers: number;
        overall_accuracy: number;
        total_subtopics: number;
        completed_subtopics: number;
        total_main_topics: number;
        completed_main_topics: number;
      }>(
        `SELECT 
          COALESCE((SELECT COUNT(*) FROM accounting_question WHERE active = 1), 0) as total_questions_available,
          COALESCE((SELECT COUNT(*) FROM (
            SELECT question_id
            FROM question_report qr1
            WHERE qr1.date = (
              SELECT MAX(qr2.date)
              FROM question_report qr2
              WHERE qr2.question_id = qr1.question_id
            )
          )), 0) as total_questions_answered,
          COALESCE((SELECT SUM(CASE WHEN outcome = 'correct' THEN 1 ELSE 0 END)
            FROM (
              SELECT *
              FROM question_report qr1
              WHERE qr1.date = (
                SELECT MAX(qr2.date)
                FROM question_report qr2
                WHERE qr2.question_id = qr1.question_id
              )
            )
          ), 0) as total_correct_answers,
          CASE 
            WHEN COALESCE((SELECT COUNT(*) FROM (
              SELECT question_id
              FROM question_report qr1
              WHERE qr1.date = (
                SELECT MAX(qr2.date)
                FROM question_report qr2
                WHERE qr2.question_id = qr1.question_id
              )
            )), 0) > 0 
            THEN ROUND((
              COALESCE((SELECT SUM(CASE WHEN outcome = 'correct' THEN 1 ELSE 0 END)
                FROM (
                  SELECT *
                  FROM question_report qr1
                  WHERE qr1.date = (
                    SELECT MAX(qr2.date)
                    FROM question_report qr2
                    WHERE qr2.question_id = qr1.question_id
                  )
                )
              ), 0) * 100.0 / 
              COALESCE((SELECT COUNT(*) FROM (
                SELECT question_id
                FROM question_report qr1
                WHERE qr1.date = (
                  SELECT MAX(qr2.date)
                  FROM question_report qr2
                  WHERE qr2.question_id = qr1.question_id
                )
              )), 0)
            ), 2)
            ELSE 0 
          END as overall_accuracy,
          COALESCE((SELECT COUNT(DISTINCT sub_topic) FROM accounting_topic), 0) as total_subtopics,
          COALESCE((SELECT COUNT(DISTINCT at.sub_topic)
            FROM accounting_topic at
            WHERE (
              SELECT COUNT(*) FROM accounting_question aq
              WHERE aq.accounting_topic_id = at.id AND aq.active = 1
            ) > 0
            AND (
              SELECT COUNT(*) FROM accounting_question aq
              WHERE aq.accounting_topic_id = at.id AND aq.active = 1
              AND aq.question_id IN (
                SELECT qr1.question_id
                FROM question_report qr1
                WHERE qr1.outcome = 'correct'
                AND qr1.date = (
                  SELECT MAX(qr2.date)
                  FROM question_report qr2
                  WHERE qr2.question_id = qr1.question_id
                )
              )
            ) = (
              SELECT COUNT(*) FROM accounting_question aq
              WHERE aq.accounting_topic_id = at.id AND aq.active = 1
            )
          ), 0) as completed_subtopics,
          COALESCE((SELECT COUNT(DISTINCT main_topic) FROM accounting_topic), 0) as total_main_topics,
          COALESCE((SELECT COUNT(DISTINCT at.main_topic)
            FROM accounting_topic at
            WHERE (
              SELECT COUNT(*) FROM accounting_question aq
              WHERE aq.accounting_topic_id = at.id AND aq.active = 1
            ) > 0
            AND (
              SELECT COUNT(*) FROM accounting_question aq
              WHERE aq.accounting_topic_id = at.id AND aq.active = 1
              AND aq.question_id IN (
                SELECT qr1.question_id
                FROM question_report qr1
                WHERE qr1.outcome = 'correct'
                AND qr1.date = (
                  SELECT MAX(qr2.date)
                  FROM question_report qr2
                  WHERE qr2.question_id = qr1.question_id
                )
              )
            ) = (
              SELECT COUNT(*) FROM accounting_question aq
              WHERE aq.accounting_topic_id = at.id AND aq.active = 1
            )
          ), 0) as completed_main_topics`
      );

      resolve({
        total_questions_available: result?.total_questions_available || 0,
        total_questions_answered: result?.total_questions_answered || 0,
        total_correct_answers: result?.total_correct_answers || 0,
        overall_accuracy: result?.overall_accuracy || 0,
        total_subtopics: result?.total_subtopics || 0,
        completed_subtopics: result?.completed_subtopics || 0,
        total_main_topics: result?.total_main_topics || 0,
        completed_main_topics: result?.completed_main_topics || 0,
        streak_days: streakDays,
      });
    } catch (error) {
      console.error('Error fetching overall statistics:', error);
      reject(error);
    }
  });
};

// Check if a level is completed (all questions answered correctly)
export const isLevelCompleted = (topicId: number, level: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{
        total_questions: number;
        correctly_answered_questions: number;
      }>(
        `SELECT 
          COUNT(aq.id) as total_questions,
          COALESCE(COUNT(DISTINCT CASE WHEN qr.outcome = 'correct' THEN aq.question_id END), 0) as correctly_answered_questions
        FROM accounting_question aq
        LEFT JOIN (
          SELECT * FROM question_report qr1
          WHERE qr1.date = (
            SELECT MAX(qr2.date)
            FROM question_report qr2
            WHERE qr2.question_id = qr1.question_id
          )
        ) qr ON aq.question_id = qr.question_id
        WHERE aq.accounting_topic_id = ? AND aq.level = ? AND aq.active = 1`,
        [topicId, level]
      );

      if (!result) {
        resolve(false);
        return;
      }

      // Level is completed if all questions have been answered correctly
      const isCompleted = result.total_questions > 0 && result.total_questions === result.correctly_answered_questions;
      resolve(isCompleted);
    } catch (error) {
      console.error('Error checking level completion:', error);
      reject(error);
    }
  });
};

// Get level completion status for all levels in a subtopic
export const getLevelCompletionStatus = (topicId: number): Promise<Array<{
  level: string;
  total_questions: number;
  correctly_answered_questions: number;
  incorrectly_answered_questions: number;
  is_completed: boolean;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        level: string;
        total_questions: number;
        correctly_answered_questions: number;
        incorrectly_answered_questions: number;
        is_completed: number;
      }>(
        `SELECT 
          aq.level,
          COUNT(aq.id) as total_questions,
          COALESCE(COUNT(DISTINCT CASE WHEN qr.outcome = 'correct' THEN aq.question_id END), 0) as correctly_answered_questions,
          COALESCE(COUNT(DISTINCT CASE WHEN qr.outcome = 'incorrect' THEN aq.question_id END), 0) as incorrectly_answered_questions,
          CASE 
            WHEN COUNT(aq.id) > 0 AND COUNT(aq.id) = COALESCE(COUNT(DISTINCT CASE WHEN qr.outcome = 'correct' THEN aq.question_id END), 0)
            THEN 1 
            ELSE 0 
          END as is_completed
        FROM accounting_question aq
        LEFT JOIN (
          SELECT * FROM question_report qr1
          WHERE qr1.date = (
            SELECT MAX(qr2.date)
            FROM question_report qr2
            WHERE qr2.question_id = qr1.question_id
          )
        ) qr ON aq.question_id = qr.question_id
        WHERE aq.accounting_topic_id = ? AND aq.active = 1
        GROUP BY aq.level
        ORDER BY 
          CASE aq.level
            WHEN 'Level 1: Basics' THEN 1
            WHEN 'Level 2: Core Practice' THEN 2
            WHEN 'Level 3: Advanced' THEN 3
            WHEN 'Level 4: Expert' THEN 4
            ELSE 5
          END`,
        [topicId]
      );

      const formattedResult = result.map(row => ({
        level: row.level,
        total_questions: row.total_questions,
        correctly_answered_questions: row.correctly_answered_questions,
        incorrectly_answered_questions: row.incorrectly_answered_questions,
        is_completed: row.is_completed === 1
      }));

      resolve(formattedResult);
    } catch (error) {
      console.error('Error getting level completion status:', error);
      reject(error);
    }
  });
};

// Get incorrect questions by topic ID and level
export const getIncorrectQuestionsByTopicAndLevel = (topicId: number, level: string): Promise<Array<{
  id: number;
  accounting_topic_id: number;
  level: string;
  question_id: string;
  question_type: string;
  prompt: string;
  options: string | null;
  answer: string | null;
  categories: string | null;
  items: string | null;
  correct_order: string | null;
  pairs: string | null;
  context: string | null;
  steps: string | null;
  explanation: string | null;
  active: number;
  created: string;
  updated: string;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        id: number;
        accounting_topic_id: number;
        level: string;
        question_id: string;
        question_type: string;
        prompt: string;
        options: string | null;
        answer: string | null;
        categories: string | null;
        items: string | null;
        correct_order: string | null;
        pairs: string | null;
        context: string | null;
        steps: string | null;
        explanation: string | null;
        active: number;
        created: string;
        updated: string;
      }>(
        `SELECT DISTINCT aq.* 
         FROM accounting_question aq
         INNER JOIN question_report qr ON aq.question_id = qr.question_id
         WHERE aq.accounting_topic_id = ? 
         AND aq.level = ? 
         AND aq.active = 1
         AND qr.outcome = 'incorrect'
         AND qr.date = (
           SELECT MAX(qr2.date)
           FROM question_report qr2
           WHERE qr2.question_id = qr.question_id
         )
         ORDER BY aq.id`,
        [topicId, level]
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching incorrect questions by topic and level:', error);
      reject(error);
    }
  });
};

// Check if there are incorrect questions for a topic and level
export const hasIncorrectQuestions = (topicId: number, level: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getFirstSync<{ count: number }>(
        `SELECT COUNT(DISTINCT aq.id) as count
         FROM accounting_question aq
         INNER JOIN question_report qr ON aq.question_id = qr.question_id
         WHERE aq.accounting_topic_id = ? 
         AND aq.level = ? 
         AND aq.active = 1
         AND qr.outcome = 'incorrect'
         AND qr.date = (
           SELECT MAX(qr2.date)
           FROM question_report qr2
           WHERE qr2.question_id = qr.question_id
         )`,
        [topicId, level]
      );
      resolve(result ? result.count > 0 : false);
    } catch (error) {
      console.error('Error checking for incorrect questions:', error);
      reject(error);
    }
  });
};

// Get question counts per subtopic and level
export const getQuestionCountsPerSubtopic = (): Promise<Array<{
  main_topic: string;
  sub_topic: string;
  level: string;
  question_count: number;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        main_topic: string;
        sub_topic: string;
        level: string;
        question_count: number;
      }>(
        `SELECT 
          at.main_topic,
          at.sub_topic,
          aq.level,
          COUNT(aq.id) as question_count
        FROM accounting_topic at
        LEFT JOIN accounting_question aq ON at.id = aq.accounting_topic_id
        WHERE aq.active = 1
        GROUP BY at.main_topic, at.sub_topic, aq.level
        ORDER BY at.main_topic, at.sub_topic, 
          CASE aq.level
            WHEN 'Level 1: Basics' THEN 1
            WHEN 'Level 2: Core Practice' THEN 2
            WHEN 'Level 3: Advanced' THEN 3
            WHEN 'Level 4: Expert' THEN 4
            ELSE 5
          END`
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching question counts per subtopic:', error);
      reject(error);
    }
  });
};

// Get total question counts by main topic
export const getQuestionCountsByMainTopic = (): Promise<Array<{
  main_topic: string;
  total_questions: number;
  subtopics_count: number;
}>> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      const result = db.getAllSync<{
        main_topic: string;
        total_questions: number;
        subtopics_count: number;
      }>(
        `SELECT 
          at.main_topic,
          COUNT(aq.id) as total_questions,
          COUNT(DISTINCT at.sub_topic) as subtopics_count
        FROM accounting_topic at
        LEFT JOIN accounting_question aq ON at.id = aq.accounting_topic_id
        WHERE aq.active = 1
        GROUP BY at.main_topic
        ORDER BY at.main_topic`
      );
      resolve(result);
    } catch (error) {
      console.error('Error fetching question counts by main topic:', error);
      reject(error);
    }
  });
};

// Log comprehensive question statistics
export const logQuestionStatistics = async (): Promise<void> => {
  try {
  } catch (error) {
    console.error('📊 [DATABASE] Error logging question statistics:', error);
  }
};

export const getTodaysQuestionCount = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = db.getFirstSync<{ count: number }>(
        `SELECT COUNT(*) as count FROM question_report WHERE date(date) = ?`,
        [today]
      );
      resolve(result ? result.count : 0);
    } catch (error) {
      console.error('Error counting today\'s question reports:', error);
      reject(error);
    }
  });
}; 