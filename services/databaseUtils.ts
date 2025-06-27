import { insertTopic, getAllTopics, getTopicsByMainTopic } from './database';
import accountingData from '@/assets/accounting_full_33_subtopics.json';

// Predefined accounting topics as provided by the user
const PREDEFINED_TOPICS = [
  { mainTopic: 'Financial Statements', subTopic: 'Income Statement (multi-step)' },
  { mainTopic: 'Financial Statements', subTopic: 'Balance Sheet (classified)' },
  { mainTopic: 'Financial Statements', subTopic: 'Post-Closing Trial Balance' },
  { mainTopic: 'Financial Statements', subTopic: 'Adjusting Entries' },
  { mainTopic: 'Financial Statements', subTopic: 'Closing Entries' },
  { mainTopic: 'Financial Statements', subTopic: 'Retained Earnings Statement' },
  { mainTopic: 'Cash Flow & Equity', subTopic: 'Cash Flow Statement' },
  { mainTopic: 'Cash Flow & Equity', subTopic: 'Dividends and Retained Earnings' },
  { mainTopic: 'Cash Flow & Equity', subTopic: 'Share Capital Transactions' },
  { mainTopic: 'Cash Flow & Equity', subTopic: 'Bank Reconciliation' },
  { mainTopic: 'Cash Flow & Equity', subTopic: 'Petty Cash Systems' },
  { mainTopic: 'Ratio Analysis & Interpretation', subTopic: 'Liquidity Ratios' },
  { mainTopic: 'Ratio Analysis & Interpretation', subTopic: 'Profitability Ratios' },
  { mainTopic: 'Ratio Analysis & Interpretation', subTopic: 'Solvency Ratios' },
  { mainTopic: 'Ratio Analysis & Interpretation', subTopic: 'Vertical Analysis' },
  { mainTopic: 'Ratio Analysis & Interpretation', subTopic: 'Horizontal Analysis' },
  { mainTopic: 'Ratio Analysis & Interpretation', subTopic: 'Interpretation of Financial Reports' },
  { mainTopic: 'Cost Concepts & Internal Control', subTopic: 'Inventory Valuation (FIFO, LIFO)' },
  { mainTopic: 'Cost Concepts & Internal Control', subTopic: 'Mark-up and Gross Profit Calculations' },
  { mainTopic: 'Cost Concepts & Internal Control', subTopic: 'Depreciation and Asset Disposal' },
  { mainTopic: 'Cost Concepts & Internal Control', subTopic: 'Cost Behavior and Break-even' },
  { mainTopic: 'Cost Concepts & Internal Control', subTopic: 'Internal Controls and Fraud Prevention' },
  { mainTopic: 'Corporate Governance & Ethics', subTopic: 'Ethical Principles in Accounting' },
  { mainTopic: 'Corporate Governance & Ethics', subTopic: 'Corporate Governance Structures' },
  { mainTopic: 'Corporate Governance & Ethics', subTopic: 'Auditor Roles and Responsibilities' },
  { mainTopic: 'Corporate Governance & Ethics', subTopic: 'Stakeholder Reporting and Transparency' },
  { mainTopic: 'Corporate Governance & Ethics', subTopic: 'Sustainability Reporting' },
  { mainTopic: 'Company Capital & Shareholders', subTopic: 'Issuing Common and Preferred Shares' },
  { mainTopic: 'Company Capital & Shareholders', subTopic: 'Dividends: Cash and Stock' },
  { mainTopic: 'Company Capital & Shareholders', subTopic: 'Earnings Per Share' },
  { mainTopic: 'Company Capital & Shareholders', subTopic: 'Net Asset Value (NAV)' },
  { mainTopic: 'Company Capital & Shareholders', subTopic: 'Shareholder Equity Analysis' },
];

// Populate database with predefined topics
export const populateDatabaseWithPredefinedTopics = async (): Promise<void> => {
  try {
    console.log('Starting predefined topics population...');
    
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const topic of PREDEFINED_TOPICS) {
      try {
        await insertTopic(topic.mainTopic, topic.subTopic);
        insertedCount++;
      } catch (error) {
        // If it's a unique constraint violation, count as skipped
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
          skippedCount++;
        } else {
          console.error(`Error inserting topic ${topic.mainTopic} - ${topic.subTopic}:`, error);
        }
      }
    }
    
    console.log(`Predefined topics population completed!`);
    console.log(`- Inserted: ${insertedCount} topics`);
    console.log(`- Skipped (duplicates): ${skippedCount} topics`);
    console.log(`- Total processed: ${insertedCount + skippedCount} topics`);
  } catch (error) {
    console.error('Error populating predefined topics:', error);
    throw error;
  }
};

// Populate database with topics from JSON data
export const populateDatabaseWithTopics = async (): Promise<void> => {
  try {
    console.log('Starting database population...');
    
    // Clear existing data first (optional)
    // await clearAllTopics();
    
    let insertedCount = 0;
    
    // Iterate through main topics
    for (const mainTopic of accountingData.topics) {
      // Insert main topic as a subtopic of itself (for consistency)
      await insertTopic(mainTopic.name, mainTopic.name);
      insertedCount++;
      
      // Insert subtopics
      if (mainTopic.subtopics) {
        for (const subtopic of mainTopic.subtopics) {
          await insertTopic(mainTopic.name, subtopic.name);
          insertedCount++;
          
          // Insert levels as subtopics (optional)
          if (subtopic.levels) {
            for (const level of subtopic.levels) {
              await insertTopic(mainTopic.name, `${subtopic.name} - ${level.name}`);
              insertedCount++;
            }
          }
        }
      }
    }
    
    console.log(`Database populated successfully! Inserted ${insertedCount} topics.`);
  } catch (error) {
    console.error('Error populating database:', error);
    throw error;
  }
};

// Get unique main topics from database
export const getUniqueMainTopics = async (): Promise<string[]> => {
  try {
    const topics = await getAllTopics();
    const uniqueMainTopics = [...new Set(topics.map(topic => topic.main_topic))];
    return uniqueMainTopics.sort();
  } catch (error) {
    console.error('Error getting unique main topics:', error);
    throw error;
  }
};

// Get subtopics for a specific main topic
export const getSubtopicsForMainTopic = async (mainTopic: string): Promise<string[]> => {
  try {
    const topics = await getTopicsByMainTopic(mainTopic);
    return topics.map(topic => topic.sub_topic).sort();
  } catch (error) {
    console.error('Error getting subtopics for main topic:', error);
    throw error;
  }
};

// Check if database has data
export const hasDatabaseData = async (): Promise<boolean> => {
  try {
    const topics = await getAllTopics();
    return topics.length > 0;
  } catch (error) {
    console.error('Error checking database data:', error);
    return false;
  }
};

// Get predefined topics count
export const getPredefinedTopicsCount = (): number => {
  return PREDEFINED_TOPICS.length;
};

// Get predefined topics by main topic
export const getPredefinedTopicsByMainTopic = (mainTopic: string): string[] => {
  return PREDEFINED_TOPICS
    .filter(topic => topic.mainTopic === mainTopic)
    .map(topic => topic.subTopic)
    .sort();
}; 