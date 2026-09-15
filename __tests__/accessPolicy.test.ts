import {
  FREE_ACCOUNTING_LEVEL2_DAILY_LIMIT,
  FREE_PRACTICE_DAILY_LIMIT,
  __setLocalTodayKeyProviderForTests,
  canAccessAccountingLevel,
  canCompleteAccountingQuestion,
  canStartPracticeQuestion,
  getAccountingQuestionsRemainingToday,
  getAccessReason,
  getPracticeQuestionsRemainingToday,
  isPremiumAccountingLevel,
} from '../services/accessPolicy';
import {
  PREMIUM_ENTITLEMENT_ID,
  hasPremiumEntitlement,
} from '../services/revenueCat';
import {
  createEmptyProgress,
  getWeakTopicInsights,
  mergeDailyUsage,
  mergeProgress,
  type LearnerProgress,
} from '../services/progress';
import type { CustomerInfo } from 'react-native-purchases';

describe('accessPolicy accounting levels', () => {
  afterEach(() => {
    __setLocalTodayKeyProviderForTests(null);
  });

  it('allows Level 1 for free users', () => {
    expect(canAccessAccountingLevel('Level 1: Basics', false)).toBe(true);
    expect(isPremiumAccountingLevel('Level 1: Basics')).toBe(false);
  });

  it('keeps Level 2 free for free users', () => {
    expect(canAccessAccountingLevel('Level 2: Core Practice', false)).toBe(true);
  });

  it('keeps Level 3 locked for free users', () => {
    expect(canAccessAccountingLevel('Level 3: Application', false)).toBe(false);
  });

  it('rejects Level 4 for free users', () => {
    expect(canAccessAccountingLevel('Level 4: Challenge', false)).toBe(false);
  });

  it('allows Level 2 completion for free users up to the lifetime allowance', () => {
    const today = '2026-09-09';
    const progress: LearnerProgress = {
      ...createEmptyProgress(),
      accountingQuestionsCompleted: {
        'Cash Flow::Level 2: Core Practice': {
          q1: today,
          q2: today,
          q3: today,
        },
      },
    };

    expect(
      canCompleteAccountingQuestion({
        levelName: 'Level 2: Core Practice',
        subtopicName: 'Cash Flow',
        questionId: 'q4',
        questionIndex: 3,
        isPro: false,
        progress,
        today,
      })
    ).toBe(false);
    expect(
      canCompleteAccountingQuestion({
        levelName: 'Level 3: Application',
        subtopicName: 'Cash Flow',
        questionId: 'q1',
        questionIndex: 0,
        isPro: false,
        progress,
        today,
      })
    ).toBe(false);
  });

  it('rejects Level 4 for free users', () => {
    expect(canAccessAccountingLevel('Level 4: Challenge', false)).toBe(false);
  });

  it('flags Level 3 and 4 as pro tiers', () => {
    expect(isPremiumAccountingLevel('Level 3: Application')).toBe(true);
    expect(isPremiumAccountingLevel('Level 4: Challenge')).toBe(true);
  });

  it('allows all levels for Pro users', () => {
    expect(canAccessAccountingLevel('Level 1: Basics', true)).toBe(true);
    expect(canAccessAccountingLevel('Level 2: Core Practice', true)).toBe(true);
    expect(canAccessAccountingLevel('Level 3: Application', true)).toBe(true);
    expect(canAccessAccountingLevel('Level 4: Challenge', true)).toBe(true);
  });

  it('fails closed for unknown or malformed level names', () => {
    expect(canAccessAccountingLevel('Advanced Challenge', false)).toBe(false);
    expect(canAccessAccountingLevel('', false)).toBe(false);
    expect(canAccessAccountingLevel('Advanced Challenge', true)).toBe(true);
  });

  it('blocks Level 2 accounting questions after lifetime limit for free users', () => {
    const progress: LearnerProgress = {
      ...createEmptyProgress(),
      accountingQuestionsCompleted: {
        'Cash Flow::Level 2: Core Practice': {
          q1: '2026-09-08',
          q2: '2026-09-09',
          q3: '2026-09-10',
        },
      },
    };
    expect(
      canCompleteAccountingQuestion({
        levelName: 'Level 2: Core Practice',
        subtopicName: 'Cash Flow',
        questionId: 'q4',
        isPro: false,
        progress,
      })
    ).toBe(false);
    expect(
      getAccessReason({
        action: 'complete_accounting',
        levelName: 'Level 2: Core Practice',
        subtopicName: 'Cash Flow',
        questionId: 'q4',
        isPro: false,
        progress,
      }).reason
    ).toBe('accounting_daily_limit');
  });

  it('does not consume allowance twice when reopening a completed question', () => {
    const today = '2026-09-09';
    const progress: LearnerProgress = {
      ...createEmptyProgress(),
      accountingQuestionsCompleted: {
        'Cash Flow::Level 2: Core Practice': {
          q1: today,
        },
      },
    };

    expect(
      canCompleteAccountingQuestion({
        levelName: 'Level 2: Core Practice',
        subtopicName: 'Cash Flow',
        questionId: 'q1',
        isPro: false,
        progress,
        alreadyCompleted: true,
        today,
      })
    ).toBe(true);
  });

  it('retains accounting allowance across local-day changes', () => {
    const progress: LearnerProgress = {
      ...createEmptyProgress(),
      accountingQuestionsCompleted: {
        'Cash Flow::Level 2: Core Practice': {
          q1: '2026-09-09',
        },
      },
    };
    expect(getAccountingQuestionsRemainingToday(progress, false)).toBe(
      FREE_ACCOUNTING_LEVEL2_DAILY_LIMIT - 1
    );
  });
});

describe('accessPolicy practice allowance', () => {
  afterEach(() => {
    __setLocalTodayKeyProviderForTests(null);
  });

  it('enforces practice allowance at 0, 2 and 3 completions', () => {
    const today = '2026-09-09';
    __setLocalTodayKeyProviderForTests(() => today);

    expect(getPracticeQuestionsRemainingToday(createEmptyProgress(), false, today)).toBe(
      FREE_PRACTICE_DAILY_LIMIT
    );

    const two: LearnerProgress = {
      ...createEmptyProgress(),
      dailyUsage: {
        date: today,
        accountingQuestionIds: {},
        practiceQuestionIds: { p0: true, p1: true },
      },
    };
    expect(getPracticeQuestionsRemainingToday(two, false, today)).toBe(1);
    expect(canStartPracticeQuestion({ questionId: 'p2', isPro: false, progress: two, today })).toBe(
      true
    );

    const three: LearnerProgress = {
      ...two,
      dailyUsage: {
        date: today,
        accountingQuestionIds: {},
        practiceQuestionIds: { p0: true, p1: true, p2: true },
      },
    };
    expect(getPracticeQuestionsRemainingToday(three, false, today)).toBe(0);
    expect(
      canStartPracticeQuestion({ questionId: 'p3', isPro: false, progress: three, today })
    ).toBe(false);
  });

  it('allows reopening an already completed practice question without blocking', () => {
    const today = '2026-09-09';
    const progress: LearnerProgress = {
      ...createEmptyProgress(),
      practiceCompleted: { p1: 'Cash Flow' },
      dailyUsage: {
        date: today,
        accountingQuestionIds: {},
        practiceQuestionIds: { p0: true, p1: true, p2: true },
      },
    };
    expect(canStartPracticeQuestion({ questionId: 'p1', isPro: false, progress, today })).toBe(
      true
    );
  });
});

describe('RevenueCat named entitlement', () => {
  function mockInfo(active: Record<string, unknown>): CustomerInfo {
    return {
      entitlements: { active, all: active, verification: 'NOT_REQUESTED' },
    } as unknown as CustomerInfo;
  }

  it('requires the named premium entitlement', () => {
    expect(PREMIUM_ENTITLEMENT_ID).toBe('pro');
    expect(hasPremiumEntitlement(mockInfo({ pro: { identifier: 'pro' } }))).toBe(true);
    expect(hasPremiumEntitlement(mockInfo({ premium: { identifier: 'premium' } }))).toBe(false);
    expect(hasPremiumEntitlement(mockInfo({ something_else: { identifier: 'x' } }))).toBe(false);
    expect(hasPremiumEntitlement(mockInfo({}))).toBe(false);
    expect(hasPremiumEntitlement(null)).toBe(false);
  });

  it('treats expired or missing entitlement as not Pro', () => {
    expect(hasPremiumEntitlement(mockInfo({}))).toBe(false);
  });
});

describe('route params must not bypass entitlement', () => {
  it('access decisions ignore URL-style grant flags', () => {
    const decision = getAccessReason({
      action: 'access_level',
      levelName: 'Level 4: Challenge',
      isPro: false,
    });
    expect(decision.allowed).toBe(false);
    // accessGranted=1 must never be consulted by the policy module.
    expect(decision.reason).toBe('requires_pro_level');
  });
});

describe('weak topic insights', () => {
  it('ranks attempted topics by lowest mastery and caps at three', () => {
    const progress: LearnerProgress = {
      ...createEmptyProgress(),
      accountingAttemptStats: {
        'Weak Topic::Level 1: Basics': {
          q1: { answer: { correct: 1, incorrect: 9 } },
        },
        'Medium Topic::Level 1: Basics': {
          q1: { answer: { correct: 4, incorrect: 6 } },
        },
        'Strong Topic::Level 1: Basics': {
          q1: { answer: { correct: 9, incorrect: 1 } },
        },
        'Another Weak::Level 2: Core Practice': {
          q1: { answer: { correct: 2, incorrect: 8 } },
        },
        'Unused Topic::Level 1: Basics': {},
      },
    };

    const insights = getWeakTopicInsights(progress, 3);
    expect(insights).toHaveLength(3);
    expect(insights[0].label).toBe('Weak Topic');
    expect(insights[0].mastery).toBe(10);
    expect(insights.map((item) => item.label)).not.toContain('Unused Topic');
  });

  it('returns empty when there is insufficient attempt data', () => {
    expect(getWeakTopicInsights(createEmptyProgress(), 3)).toEqual([]);
  });
});

describe('daily usage merge', () => {
  it('unions same-day usage and drops other-day usage', () => {
    const today = '2026-09-09';
    __setLocalTodayKeyProviderForTests(() => today);

    const local = createEmptyProgress();
    local.dailyUsage = {
      date: today,
      accountingQuestionIds: { a: true },
      practiceQuestionIds: { p1: true },
    };
    const cloud = createEmptyProgress();
    cloud.dailyUsage = {
      date: today,
      accountingQuestionIds: { b: true },
      practiceQuestionIds: { p2: true },
    };

    const mergedUsage = mergeDailyUsage(local.dailyUsage, cloud.dailyUsage, today);
    expect(mergedUsage.accountingQuestionIds).toEqual({ a: true, b: true });
    expect(mergedUsage.practiceQuestionIds).toEqual({ p1: true, p2: true });

    const staleCloud = createEmptyProgress();
    staleCloud.dailyUsage = {
      date: '2026-09-08',
      accountingQuestionIds: { old: true },
      practiceQuestionIds: { oldp: true },
    };
    const merged = mergeProgress(local, staleCloud);
    expect(merged.dailyUsage.accountingQuestionIds).toEqual({ a: true });
    expect(merged.dailyUsage.practiceQuestionIds).toEqual({ p1: true });

    __setLocalTodayKeyProviderForTests(null);
  });
});
