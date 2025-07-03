import StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CORRECT_COUNT_KEY = 'correct_answer_count';
const RATE_PROMPT_SHOWN_KEY = 'rate_prompt_shown';
const RATE_PROMPT_LAST_SHOWN_KEY = 'rate_prompt_last_shown';
const RATE_PROMPT_COMPLETED_KEY = 'rate_prompt_completed';

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

/**
 * Call this after a correct answer. Handles all rate prompt logic.
 */
export async function handleRateAppPrompt() {
  try {
    // If user has completed review, never prompt again
    const completed = await AsyncStorage.getItem(RATE_PROMPT_COMPLETED_KEY);
    if (completed) return;

    // Get counts and timestamps
    let count = parseInt((await AsyncStorage.getItem(CORRECT_COUNT_KEY)) || '0', 10);
    const shown = await AsyncStorage.getItem(RATE_PROMPT_SHOWN_KEY);
    const lastShown = parseInt((await AsyncStorage.getItem(RATE_PROMPT_LAST_SHOWN_KEY)) || '0', 10);
    const now = Date.now();

    // First prompt: on 3rd correct answer
    if (!shown) {
      count += 1;
      await AsyncStorage.setItem(CORRECT_COUNT_KEY, count.toString());
      if (count === 3 && StoreReview.isAvailableAsync && await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        await AsyncStorage.setItem(RATE_PROMPT_SHOWN_KEY, 'true');
        await AsyncStorage.setItem(RATE_PROMPT_LAST_SHOWN_KEY, now.toString());
      }
      return;
    }

    // Second prompt: 10 days after first prompt, if not completed
    if (shown && !completed && lastShown > 0 && (now - lastShown) > TEN_DAYS_MS) {
      if (StoreReview.isAvailableAsync && await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        await AsyncStorage.setItem(RATE_PROMPT_COMPLETED_KEY, 'true'); // Never prompt again
      }
    }
  } catch (e) {
    // fail silently
  }
}

/**
 * Optionally, call this if user explicitly says they reviewed (e.g. via a button)
 */
export async function markRateAppCompleted() {
  await AsyncStorage.setItem(RATE_PROMPT_COMPLETED_KEY, 'true');
} 