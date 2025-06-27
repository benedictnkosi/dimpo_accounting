# Database Setup with expo-sqlite

This document explains how to use the SQLite database setup for the Dimpo Accounting app.

## Overview

The app uses `expo-sqlite` to store accounting topics locally on the device. The database includes a table for storing main topics and their associated subtopics.

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

## Files Structure

```
services/
├── database.ts          # Core database operations
├── databaseUtils.ts     # Utility functions for data population
hooks/
├── useDatabase.ts       # React hook for database operations
components/
├── DatabaseTest.tsx     # Test component for database operations
app/
├── database-test.tsx    # Test page to access database functionality
```

## Usage

### 1. Initialize Database

The database is automatically initialized when the app starts. You can also manually initialize it:

```typescript
import { initDatabase } from '@/services/database';

// Initialize database
const db = initDatabase();
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

### 4. Populate with Sample Data

You can populate the database with sample accounting topics from the JSON data:

```typescript
import { populateDatabaseWithTopics } from '@/services/databaseUtils';

await populateDatabaseWithTopics();
```

This will insert all topics, subtopics, and levels from the `accounting_full_33_subtopics.json` file.

## Testing

### Access Test Page

Navigate to `/database-test` in your app to access the database test interface. This page allows you to:

- Add new topics manually
- Populate the database with sample data
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

## Error Handling

The database operations include comprehensive error handling:

- Database initialization errors
- SQL execution errors
- Network/API errors (if applicable)
- Validation errors

All errors are logged to the console and can be handled in the UI through the `error` state from the `useDatabase` hook.

## Performance Considerations

- Use `getAllSync` and `runSync` for synchronous operations (blocks JS thread)
- Use `getAllAsync` and `runAsync` for asynchronous operations (non-blocking)
- Consider pagination for large datasets
- Use transactions for multiple related operations

## Troubleshooting

### Common Issues

1. **Database not initialized**
   - Ensure `expo-sqlite` is properly installed
   - Check that the plugin is added to `app.config.js`
   - Verify database initialization in the hook

2. **Unique constraint violations**
   - The database enforces unique combinations of main_topic and sub_topic
   - Use `INSERT OR IGNORE` to handle duplicates gracefully

3. **Permission errors**
   - Ensure the app has proper permissions for file system access
   - Check iOS/Android specific permissions if needed

### Debugging

Enable debug logging by checking the console for:
- Database initialization messages
- SQL execution logs
- Error messages with stack traces

## Future Enhancements

Potential improvements for the database system:

1. **Migration system** for schema updates
2. **Backup/restore** functionality
3. **Sync with remote database**
4. **Encryption** for sensitive data
5. **Query optimization** for large datasets
6. **Caching layer** for frequently accessed data 