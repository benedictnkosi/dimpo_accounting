import { SHARE_PROMPT_EVERY } from '@/constants/matric';

let sessionCompletedCount = 0;

export function shouldShowSharePrompt(): boolean {
  sessionCompletedCount += 1;
  return sessionCompletedCount % SHARE_PROMPT_EVERY === 0;
}

export function getSessionCompletedCount(): number {
  return sessionCompletedCount;
}
