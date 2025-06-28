# Database Setup with expo-sqlite

This document explains how to use the SQLite database setup for the Dimpo Accounting app.

## Overview

The app uses `expo-sqlite` to store accounting topics locally on the device. The database includes a table for storing main topics and their associated subtopics.

## Automatic Database Initialization

The database is automatically initialized when the app starts up. This process includes:

1. **Database Creation**: Creates the SQLite database file if it doesn't exist
2. **Table Creation**: Creates the `accounting_topic` table with proper schema
3. **Data Population**: Automatically populates the database with predefined topics if it's empty
4. **Error Handling**: Graceful error handling to prevent app crashes

The initialization happens in the background during app startup, so users don't need to manually populate the database.

## Database Schema

### accounting_topic Table

```sql
CREATE TABLE accounting_topic (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  main_topic TEXT NOT NULL,
  sub_topic TEXT NOT NULL,
  UNIQUE(main_topic, sub_topic)
);
```

**Columns:**
- `id`: Auto-incrementing primary key
- `main_topic`: The main accounting topic (e.g., "Financial Statements")
- `sub_topic`: The subtopic within the main topic (e.g., "Income Statement")
- `UNIQUE(main_topic, sub_topic)`: Ensures no duplicate combinations

## Predefined Topics

The database comes with 30 predefined accounting topics across 6 main categories:

### Financial Statements
- Income Statement
- Balance Sheet
- Statement of Comprehensive Income
- Statement of Changes in Equity
- Cash Flow Statement
- Notes to Financial Statements

### Cash Flow & Equity
- Operating Cash Flow
- Investing Cash Flow
- Financing Cash Flow
- Share Capital
- Retained Earnings
- Dividends

### Ratio Analysis & Interpretation
- Liquidity Ratios
- Profitability Ratios
- Efficiency Ratios
- Solvency Ratios
- Market Ratios
- Trend Analysis

### Cost Concepts & Internal Control
- Inventory Management
- Cost Classification
- Internal Controls
- Fraud Prevention
- Audit Procedures
- Risk Assessment

### Corporate Governance & Ethics
- Board of Directors
- Audit Committee
- Code of Ethics
- Whistleblower Protection
- Corporate Social Responsibility
- Sustainability Reporting

### Company Capital & Shareholders
- Share Capital Structure
- Shareholder Rights
- Share Buybacks
- Share Options
- Shareholder Meetings
- Corporate Actions

## Files Structure

```
services/
├── database.ts          # Core database operations
├── databaseUtils.ts     # Utility functions for data population
├── databaseInit.ts      # Database initialization service
hooks/
├── useDatabase.ts       # React hook for database operations
components/
├── DatabaseTest.tsx     # Test component for database operations
├── DatabaseLoading.tsx  # Loading component for database initialization
app/
├── database-test.tsx    # Test page to access database functionality
├── _layout.tsx          # Root layout with database initialization
scripts/
├── populate-database.js # Test script for database population
```

## Usage

### 1. Automatic Initialization

The database is automatically initialized when the app starts. No manual intervention is required.

```typescript
// This happens automatically in app/_layout.tsx
import { initializeDatabaseOnStartup } from '@/services/databaseInit';

useEffect(() => {
  if (loaded) {
    initializeDatabaseOnStartup();
  }
}, [loaded]);
```

### 2. Using the Database Hook

```typescript
import { useDatabase } from '@/hooks/useDatabase';

function MyComponent() {
  const { 
    isInitialized, 
    isLoading, 
    error, 
    addTopic, 
    getTopics, 
    removeTopic 
  } = useDatabase();

  // The hook automatically waits for database initialization
  if (!isInitialized) {
    return <DatabaseLoading message="Initializing database..." />;
  }

  // Add a new topic
  const handleAddTopic = async () => {
    try {
      await addTopic('Financial Statements', 'Income Statement');
    } catch (error) {
      console.error('Failed to add topic:', error);
    }
  };

  // Get all topics
  const loadTopics = async () => {
    try {
      const topics = await getTopics();
      console.log('Topics:', topics);
    } catch (error) {
      console.error('Failed to load topics:', error);
    }
  };
}
```

### 3. Database Operations

#### Insert Topic
```typescript
import { insertTopic } from '@/services/database';

await insertTopic('Financial Statements', 'Balance Sheet');
```

#### Get All Topics
```typescript
import { getAllTopics } from '@/services/database';

const topics = await getAllTopics();
// Returns: Array<{ id: number; main_topic: string; sub_topic: string }>
```

#### Get Topics by Main Topic
```typescript
import { getTopicsByMainTopic } from '@/services/database';

const topics = await getTopicsByMainTopic('Financial Statements');
```

#### Delete Topic
```typescript
import { deleteTopic } from '@/services/database';

await deleteTopic(1); // Delete topic with ID 1
```

#### Clear All Topics
```typescript
import { clearAllTopics } from '@/services/database';

await clearAllTopics();
```

### 4. Manual Population (Optional)

You can manually populate the database with predefined topics if needed:

```typescript
import { populateDatabaseWithPredefinedTopics } from '@/services/databaseUtils';

await populateDatabaseWithPredefinedTopics();
```

This will insert all 30 predefined topics into the database.

### 5. Populate with JSON Data

You can also populate the database with sample accounting topics from the JSON data:

```typescript
import { populateDatabaseWithTopics } from '@/services/databaseUtils';

await populateDatabaseWithTopics();
```

This will insert all topics, subtopics, and levels from the `accounting_full_33_subtopics.json` file.

## Testing

### Access Test Page

Navigate to `/database-test` in your app to access the database test interface. This page allows you to:

- View database initialization status
- Add new topics manually
- Populate the database with predefined topics (30 topics)
- Populate the database with JSON data
- View all stored topics
- Delete individual topics
- Clear all topics

### Test Component

The `DatabaseTest` component provides a full interface for testing database operations:

```typescript
import { DatabaseTest } from '@/components/DatabaseTest';

// Use in any screen
<DatabaseTest />
```

### Test Script

You can also run the test script to verify database functionality:

```bash
node scripts/populate-database.js
```

## Error Handling

The database operations include comprehensive error handling:

- Database initialization errors
- SQL execution errors
- Network/API errors (if applicable)
- Validation errors
- Unique constraint violations (handled gracefully)
- App startup errors (non-blocking)

All errors are logged to the console and can be handled in the UI through the `error` state from the `useDatabase` hook.

## Performance Considerations

- Database initialization happens once on app startup
- Uses `getAllSync` and `runSync` for synchronous operations (blocks JS thread)
- Uses `getAllAsync` and `runAsync` for asynchronous operations (non-blocking)
- Consider pagination for large datasets
- Use transactions for multiple related operations

## Troubleshooting

### Common Issues

1. **Database not initialized**
   - Ensure `expo-sqlite` is properly installed
   - Check that the plugin is added to `app.config.js`
   - Verify database initialization in the hook
   - Check console logs for initialization errors

2. **Unique constraint violations**
   - The database enforces unique combinations of main_topic and sub_topic
   - Use `INSERT OR IGNORE` to handle duplicates gracefully
   - Predefined topics function handles duplicates automatically

3. **Permission errors**
   - Ensure the app has proper permissions for file system access
   - Check iOS/Android specific permissions if needed

4. **App startup issues**
   - Database initialization errors won't crash the app
   - Check console logs for detailed error messages
   - Use the test page to verify database functionality

### Debugging

Enable debug logging by checking the console for:
- Database initialization messages
- SQL execution logs
- Error messages with stack traces
- Population progress messages
- App startup logs

## Future Enhancements

Potential improvements for the database system:

1. **Migration system** for schema updates
2. **Backup/restore** functionality
3. **Sync with remote database**
4. **Encryption** for sensitive data
5. **Query optimization** for large datasets
6. **Caching layer** for frequently accessed data
7. **Topic categories and tags**
8. **User progress tracking**
9. **Offline-first architecture**
10. **Database versioning** 