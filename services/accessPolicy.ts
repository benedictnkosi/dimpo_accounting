import { PREMIUM_ENTITLEMENT_ID } from '@/services/revenueCat';

export { PREMIUM_ENTITLEMENT_ID };

export const FREE_ACCOUNTING_LEVEL2_DAILY_LIMIT = 3;
export const FREE_ACCOUNTING_LEVEL1_MAX_QUESTIONS = 15;
export const FREE_PRACTICE_DAILY_LIMIT = 3;

/** Minimal progress shape needed for free-allowance checks (avoids circular imports). */
export interface AccessProgressView {
  dailyUsage?: {
    date: string;
    accountingQuestionIds?: Record<string, true>;
    practiceQuestionIds?: Record<string, true>;
  };
  accountingQuestionsCompleted?: Record<string, Record<string, string>>;
  practiceCompleted?: Record<string, string>;
}

export type AccountingLevelKind = 1 | 2 | 3 | 4 | null;
export type FreeLimitType = 'accounting_level2' | 'practice';
export type AccessReasonCode =
  | 'allowed'
  | 'requires_pro_level'
  | 'accounting_daily_limit'
  | 'practice_daily_limit'
  | 'already_completed';

export interface AccessDecision {
  allowed: boolean;
  reason: AccessReasonCode;
  message: string;
}

function defaultTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Override in tests to simulate day transitions. */
let todayKeyProvider: () => string = defaultTodayKey;

export function getLocalTodayKey(): string {
  return todayKeyProvider();
}

export function __setLocalTodayKeyProviderForTests(provider: (() => string) | null): void {
  todayKeyProvider = provider || defaultTodayKey;
}

export function getAccountingLevelNumber(levelName: string): AccountingLevelKind {
  const match = String(levelName || '').match(/level\s*([1-4])/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return null;
}

export function isPremiumAccountingLevel(levelName: string): boolean {
  const level = getAccountingLevelNumber(levelName);
  return level === 3 || level === 4;
}

export function isLevel2Accounting(levelName: string): boolean {
  return getAccountingLevelNumber(levelName) === 2;
}

export function accountingDailyUsageKey(subtopicName: string, levelName: string, questionId: string): string {
  return `${subtopicName}::${levelName}::${questionId}`;
}

function normalizeDailyUsage(
  progress: AccessProgressView | null | undefined,
  today: string
): { accountingQuestionIds: Record<string, true>; practiceQuestionIds: Record<string, true> } {
  const usage = progress?.dailyUsage;
  if (!usage || usage.date !== today) {
    return { accountingQuestionIds: {}, practiceQuestionIds: {} };
  }
  return {
    accountingQuestionIds: { ...(usage.accountingQuestionIds || {}) },
    practiceQuestionIds: { ...(usage.practiceQuestionIds || {}) },
  };
}

export function getAccountingQuestionsUsedToday(
  progress: AccessProgressView | null | undefined,
  today: string = getLocalTodayKey()
): number {
  return getLevel2QuestionIdsCompleted(progress).size;
}

function getLevel2QuestionIdsCompleted(
  progress: AccessProgressView | null | undefined
): Set<string> {
  const level2Completions = new Set<string>();
  const completed = progress?.accountingQuestionsCompleted || {};

  Object.entries(completed).forEach(([levelKey, questions]) => {
    const levelName = levelKey.split('::')[1] || '';
    if (getAccountingLevelNumber(levelName) !== 2) return;
    Object.keys(questions || {}).forEach((questionId) => {
      level2Completions.add(`${levelKey}::${questionId}`);
    });
  });

  return level2Completions;
}

export function getPracticeQuestionsUsedToday(
  progress: AccessProgressView | null | undefined,
  today: string = getLocalTodayKey()
): number {
  return Object.keys(normalizeDailyUsage(progress, today).practiceQuestionIds).length;
}

export function getAccountingQuestionsRemainingToday(
  progress: AccessProgressView | null | undefined,
  isPro: boolean,
  today: string = getLocalTodayKey()
): number {
  if (isPro) return Number.POSITIVE_INFINITY;
  return Math.max(0, FREE_ACCOUNTING_LEVEL2_DAILY_LIMIT - getAccountingQuestionsUsedToday(progress, today));
}

export function getPracticeQuestionsRemainingToday(
  progress: AccessProgressView | null | undefined,
  isPro: boolean,
  today: string = getLocalTodayKey()
): number {
  if (isPro) return Number.POSITIVE_INFINITY;
  return Math.max(0, FREE_PRACTICE_DAILY_LIMIT - getPracticeQuestionsUsedToday(progress, today));
}

export function getDailyAllowanceResetLabel(now: Date = new Date()): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const hours = Math.max(1, Math.ceil((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60)));
  if (hours >= 24) return 'tomorrow at midnight';
  if (hours === 1) return 'in about 1 hour (local midnight)';
  return `in about ${hours} hours (local midnight)`;
}

export function canAccessAccountingLevel(levelName: string, isPro: boolean): boolean {
  const level = getAccountingLevelNumber(levelName);
  if (level === 1 || level === 2) return true;
  if (level === 3 || level === 4) return isPro;
  // Fail closed when curriculum data is malformed or a new level is introduced.
  return isPro;
}

export function canCompleteAccountingQuestion(params: {
  levelName: string;
  questionId: string;
  questionIndex?: number;
  subtopicName: string;
  isPro: boolean;
  progress: AccessProgressView | null | undefined;
  alreadyCompleted?: boolean;
  today?: string;
}): boolean {
  const decision = getAccessReason({
    action: 'complete_accounting',
    ...params,
  });
  return decision.allowed;
}

export function canStartPracticeQuestion(params: {
  questionId: string;
  isPro: boolean;
  progress: AccessProgressView | null | undefined;
  today?: string;
}): boolean {
  const decision = getAccessReason({
    action: 'start_practice',
    ...params,
  });
  return decision.allowed;
}

export function getAccessReason(params: {
  action: 'access_level' | 'complete_accounting' | 'start_practice';
  levelName?: string;
  questionId?: string;
  questionIndex?: number;
  subtopicName?: string;
  isPro: boolean;
  progress?: AccessProgressView | null;
  alreadyCompleted?: boolean;
  today?: string;
}): AccessDecision {
  const today = params.today || getLocalTodayKey();

  if (params.action === 'access_level') {
    const levelName = params.levelName || '';
    if (canAccessAccountingLevel(levelName, params.isPro)) {
      return {
        allowed: true,
        reason: 'allowed',
        message: 'Access allowed',
      };
    }
    return {
      allowed: false,
      reason: 'requires_pro_level',
      message: 'Levels 3 and 4 require Pro for full exam preparation.',
    };
  }

  if (params.action === 'complete_accounting') {
    const levelName = params.levelName || '';
    const questionId = params.questionId || '';
    const subtopicName = params.subtopicName || '';

    if (!canAccessAccountingLevel(levelName, params.isPro)) {
      return {
        allowed: false,
        reason: 'requires_pro_level',
        message:
          'Levels 3 and 4 require Pro for full exam preparation.',
      };
    }

    if (params.isPro) {
      return { allowed: true, reason: 'allowed', message: 'Access allowed' };
    }

    if (!isLevel2Accounting(levelName)) {
      return { allowed: true, reason: 'allowed', message: 'Access allowed' };
    }

    if (params.alreadyCompleted) {
      return {
        allowed: true,
        reason: 'already_completed',
        message: 'Already completed — allowance not consumed again',
      };
    }

    const completedLevel2QuestionIds = getLevel2QuestionIdsCompleted(params.progress);
    if (completedLevel2QuestionIds.has(`${subtopicName}::${levelName}::${questionId}`)) {
      return {
        allowed: true,
        reason: 'already_completed',
        message: 'Already completed — allowance not consumed again',
      };
    }

    if (getAccountingQuestionsRemainingToday(params.progress, false, today) <= 0) {
      return {
        allowed: false,
        reason: 'accounting_daily_limit',
        message: `Free Core Practice is limited to ${FREE_ACCOUNTING_LEVEL2_DAILY_LIMIT} completed questions total. Upgrade to Pro for unlimited Level 2.`,
      };
    }

    return { allowed: true, reason: 'allowed', message: 'Access allowed' };
  }

  // start_practice
  const questionId = params.questionId || '';
  if (params.isPro) {
    return { allowed: true, reason: 'allowed', message: 'Access allowed' };
  }

  const usage = normalizeDailyUsage(params.progress, today);
  if (usage.practiceQuestionIds[questionId] || params.progress?.practiceCompleted?.[questionId]) {
    return {
      allowed: true,
      reason: 'already_completed',
      message: 'Already completed — allowance not consumed again',
    };
  }

  if (getPracticeQuestionsRemainingToday(params.progress, false, today) <= 0) {
    return {
      allowed: false,
      reason: 'practice_daily_limit',
      message: `Free step-by-step practice is limited to ${FREE_PRACTICE_DAILY_LIMIT} completed questions per day. Resets ${getDailyAllowanceResetLabel()}.`,
    };
  }

  return { allowed: true, reason: 'allowed', message: 'Access allowed' };
}

export function limitTypeFromReason(reason: AccessReasonCode): FreeLimitType | null {
  if (reason === 'accounting_daily_limit') return 'accounting_level2';
  if (reason === 'practice_daily_limit') return 'practice';
  return null;
}
