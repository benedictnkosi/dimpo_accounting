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
    console.log('Database tables created successfully');
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
      console.log('Topic inserted successfully');
      resolve();
    } catch (error) {
      console.error('Error inserting topic:', error);
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

// Delete a topic
export const deleteTopic = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    try {
      db.runSync('DELETE FROM accounting_topic WHERE id = ?', [id]);
      console.log('Topic deleted successfully');
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
      console.log('All topics cleared successfully');
      resolve();
    } catch (error) {
      console.error('Error clearing topics:', error);
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