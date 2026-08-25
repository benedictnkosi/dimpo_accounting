import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

const PROGRESS_KEY = 'matricUnlocked.progress';
export const STREAK_DAILY_CORRECT_THRESHOLD = 3;
export const DAILY_QUESTION_LIMIT = 10;

export interface SubjectStats {
  correct: number;
  incorrect: number;
}

export interface QuestionResultMap {
  [questionId: string]: 0 | 1;
}

export interface PaperQuestionStats {
  P1?: QuestionResultMap;
  P2?: QuestionResultMap;
}

export interface DailyProgress {
  date: string;
  count: number;
  correct: number;
}

export interface StreakProgress {
  /** Consecutive days that hit the correct-answer threshold. */
  count: number;
  /** Last calendar day that qualified for the streak (YYYY-MM-DD). */
  lastDate: string;
}

export interface AttemptCounts {
  correct: number;
  incorrect: number;
}

export interface AccountingAttemptStats {
  [levelKey: string]: {
    [questionId: string]: {
      [stepId: string]: AttemptCounts;
    };
  };
}

export interface LearnerProgress {
  stats: Record<string, SubjectStats>;
  questionStats: Record<string, PaperQuestionStats>;
  topicQuestionStats: Record<string, QuestionResultMap>;
  practiceCompleted: Record<string, string>;
  accountingLevelsCompleted: Record<string, string>;
  accountingQuestionsCompleted: Record<string, Record<string, string>>;
  accountingAttemptStats: AccountingAttemptStats;
  daily: DailyProgress;
  streak: StreakProgress;
}

export interface SubjectProgressView {
  correct: number;
  incorrect: number;
  answered: number;
  accuracy: number;
  mastery: number;
  level: number;
  label: string;
  hasStats: boolean;
}

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function normalizeDaily(daily?: Partial<DailyProgress> | null): DailyProgress {
  return {
    date: daily?.date || todayKey(),
    count: daily?.count || 0,
    correct: daily?.correct || 0,
  };
}

function normalizeStreak(streak?: Partial<StreakProgress> | null): StreakProgress {
  return {
    count: streak?.count || 0,
    lastDate: streak?.lastDate || '',
  };
}

export function createEmptyProgress(): LearnerProgress {
  return {
    stats: {},
    questionStats: {},
    topicQuestionStats: {},
    practiceCompleted: {},
    accountingLevelsCompleted: {},
    accountingQuestionsCompleted: {},
    accountingAttemptStats: {},
    daily: { date: todayKey(), count: 0, correct: 0 },
    streak: { count: 0, lastDate: '' },
  };
}

/** Streak is alive if the last qualified day is today or yesterday. */
export function getEffectiveStreak(progress: LearnerProgress | null | undefined): number {
  return getAliveStreakCount(progress?.streak);
}

export function getTodayQuizCount(progress: LearnerProgress | null | undefined): number {
  if (!progress?.daily) return 0;
  if (progress.daily.date !== todayKey()) return 0;
  return progress.daily.count || 0;
}

export function isDailyQuizLimitReached(progress: LearnerProgress | null | undefined): boolean {
  return getTodayQuizCount(progress) >= DAILY_QUESTION_LIMIT;
}

export function getDailyQuizRemaining(progress: LearnerProgress | null | undefined): number {
  return Math.max(0, DAILY_QUESTION_LIMIT - getTodayQuizCount(progress));
}

function getAliveStreakCount(streak?: StreakProgress | null): number {
  if (!streak?.count || !streak.lastDate) return 0;
  const today = todayKey();
  const yesterday = shiftDateKey(today, -1);
  if (streak.lastDate === today || streak.lastDate === yesterday) return streak.count;
  return 0;
}

function applyStreakAfterCorrect(progress: LearnerProgress): void {
  const today = todayKey();
  if (progress.daily.date !== today) return;
  if (progress.daily.correct < STREAK_DAILY_CORRECT_THRESHOLD) return;
  if (progress.streak.lastDate === today) return;

  const yesterday = shiftDateKey(today, -1);
  if (progress.streak.lastDate === yesterday && progress.streak.count > 0) {
    progress.streak.count += 1;
  } else {
    progress.streak.count = 1;
  }
  progress.streak.lastDate = today;
}

export async function loadLocalProgress(): Promise<LearnerProgress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return createEmptyProgress();
    const parsed = JSON.parse(raw) as LearnerProgress;
    return {
      ...createEmptyProgress(),
      ...parsed,
      stats: parsed.stats || {},
      questionStats: parsed.questionStats || {},
      topicQuestionStats: parsed.topicQuestionStats || {},
      practiceCompleted: parsed.practiceCompleted || {},
      accountingLevelsCompleted: parsed.accountingLevelsCompleted || {},
      accountingQuestionsCompleted: parsed.accountingQuestionsCompleted || {},
      accountingAttemptStats: parsed.accountingAttemptStats || {},
      daily: normalizeDaily(parsed.daily),
      streak: normalizeStreak(parsed.streak),
    };
  } catch (error) {
    console.error('Failed to load local progress:', error);
    return createEmptyProgress();
  }
}

export async function saveLocalProgress(progress: LearnerProgress): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

let progressWriteQueue: Promise<unknown> = Promise.resolve();

async function mutateProgress(
  mutator: (progress: LearnerProgress) => void,
  uid?: string | null
): Promise<LearnerProgress> {
  const run = progressWriteQueue.then(async () => {
    const progress = await loadLocalProgress();
    mutator(progress);
    await saveLocalProgress(progress);
    if (uid) {
      try {
        await pushProgressToCloud(uid, progress);
      } catch (error) {
        console.error('Failed to sync progress:', error);
      }
    }
    return progress;
  });
  progressWriteQueue = run.catch(() => undefined);
  return run;
}

export async function resetLocalProgress(): Promise<LearnerProgress> {
  const empty = createEmptyProgress();
  await saveLocalProgress(empty);
  return empty;
}

export function subjectTopicStatKey(subject: string, topicName: string): string {
  return `${subject}::${topicName}`;
}

export async function resetSubjectProgress(
  subject: string,
  uid?: string | null
): Promise<LearnerProgress> {
  const progress = await loadLocalProgress();
  const next: LearnerProgress = {
    ...progress,
    stats: { ...progress.stats },
    questionStats: { ...progress.questionStats },
    topicQuestionStats: { ...progress.topicQuestionStats },
  };

  delete next.stats[subject];
  delete next.questionStats[subject];

  const prefix = `${subject}::`;
  for (const key of Object.keys(next.topicQuestionStats)) {
    if (key === subject || key.startsWith(prefix)) {
      delete next.topicQuestionStats[key];
    }
  }

  await saveLocalProgress(next);
  if (uid) {
    try {
      await pushProgressToCloud(uid, next);
    } catch (error) {
      console.error('Failed to sync subject reset:', error);
    }
  }
  return next;
}

export function getSubjectQuestionResults(
  progress: LearnerProgress,
  subject: string
): Record<string, 0 | 1> {
  const out: Record<string, 0 | 1> = {};
  const papers = progress.questionStats[subject];
  if (!papers) return out;

  for (const paper of ['P1', 'P2'] as const) {
    const map = papers[paper];
    if (!map) continue;
    for (const [id, value] of Object.entries(map)) {
      out[id] = out[id] === 1 || value === 1 ? 1 : 0;
    }
  }
  return out;
}

export function getNscLevel(correct: number, incorrect: number): { level: number; label: string } {
  const total = correct + incorrect;
  if (total === 0) return { level: 1, label: 'Not achieved' };

  const accuracy = (correct / total) * 100;
  if (accuracy >= 80) return { level: 7, label: 'Outstanding' };
  if (accuracy >= 70) return { level: 6, label: 'Meritorious' };
  if (accuracy >= 60) return { level: 5, label: 'Substantial' };
  if (accuracy >= 50) return { level: 4, label: 'Adequate' };
  if (accuracy >= 40) return { level: 3, label: 'Moderate' };
  if (accuracy >= 30) return { level: 2, label: 'Elementary' };
  return { level: 1, label: 'Not achieved' };
}

export function getSubjectMastery(progress: LearnerProgress, subject: string): number {
  const papers = progress.questionStats[subject];
  if (!papers) return 0;

  let answered = 0;
  let correct = 0;
  for (const paper of ['P1', 'P2'] as const) {
    const map = papers[paper];
    if (!map) continue;
    for (const value of Object.values(map)) {
      answered += 1;
      if (value === 1) correct += 1;
    }
  }

  if (answered === 0) return 0;
  return Math.round((correct / answered) * 100);
}

export function getSubjectProgressView(
  progress: LearnerProgress,
  subject: string
): SubjectProgressView {
  const stats = progress.stats[subject] || { correct: 0, incorrect: 0 };
  const mastery = getSubjectMastery(progress, subject);
  const answered = stats.correct + stats.incorrect;
  const accuracy = answered === 0 ? 0 : Math.round((stats.correct / answered) * 100);
  const { level, label } = getNscLevel(stats.correct, stats.incorrect);

  return {
    correct: stats.correct,
    incorrect: stats.incorrect,
    answered,
    accuracy,
    mastery,
    level,
    label,
    hasStats: answered > 0 || mastery > 0,
  };
}

export function mergeProgress(local: LearnerProgress, cloud: Partial<LearnerProgress> | undefined): LearnerProgress {
  if (!cloud) return local;

  const merged = createEmptyProgress();
  const subjects = new Set([
    ...Object.keys(local.stats || {}),
    ...Object.keys(cloud.stats || {}),
  ]);

  subjects.forEach((subject) => {
    const a = local.stats[subject] || { correct: 0, incorrect: 0 };
    const b = cloud.stats?.[subject] || { correct: 0, incorrect: 0 };
    merged.stats[subject] = {
      correct: Math.max(a.correct, b.correct),
      incorrect: Math.max(a.incorrect, b.incorrect),
    };
  });

  const questionSubjects = new Set([
    ...Object.keys(local.questionStats || {}),
    ...Object.keys(cloud.questionStats || {}),
  ]);

  questionSubjects.forEach((subject) => {
    merged.questionStats[subject] = {};
    for (const paper of ['P1', 'P2'] as const) {
      const a = local.questionStats[subject]?.[paper] || {};
      const b = cloud.questionStats?.[subject]?.[paper] || {};
      const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
      const next: QuestionResultMap = {};
      ids.forEach((id) => {
        next[id] = Math.max(a[id] ?? 0, b[id] ?? 0) as 0 | 1;
      });
      if (Object.keys(next).length) merged.questionStats[subject][paper] = next;
    }
  });

  const topicIds = new Set([
    ...Object.keys(local.topicQuestionStats || {}),
    ...Object.keys(cloud.topicQuestionStats || {}),
  ]);
  topicIds.forEach((topicId) => {
    const a = local.topicQuestionStats[topicId] || {};
    const b = cloud.topicQuestionStats?.[topicId] || {};
    const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
    const next: QuestionResultMap = {};
    ids.forEach((id) => {
      next[id] = Math.max(a[id] ?? 0, b[id] ?? 0) as 0 | 1;
    });
    if (Object.keys(next).length) merged.topicQuestionStats[topicId] = next;
  });

  merged.practiceCompleted = {
    ...(cloud.practiceCompleted || {}),
    ...(local.practiceCompleted || {}),
  };
  merged.accountingLevelsCompleted = {
    ...(cloud.accountingLevelsCompleted || {}),
    ...(local.accountingLevelsCompleted || {}),
  };

  const questionProgressKeys = new Set([
    ...Object.keys(local.accountingQuestionsCompleted || {}),
    ...Object.keys(cloud.accountingQuestionsCompleted || {}),
  ]);
  questionProgressKeys.forEach((key) => {
    merged.accountingQuestionsCompleted[key] = {
      ...(cloud.accountingQuestionsCompleted?.[key] || {}),
      ...(local.accountingQuestionsCompleted?.[key] || {}),
    };
  });

  merged.accountingAttemptStats = mergeAttemptStats(
    local.accountingAttemptStats || {},
    cloud.accountingAttemptStats || {}
  );

  const today = todayKey();
  const localDaily = normalizeDaily(local.daily);
  const cloudDaily = normalizeDaily(cloud.daily);
  const localDailyCount = localDaily.date === today ? localDaily.count : 0;
  const cloudDailyCount = cloudDaily.date === today ? cloudDaily.count : 0;
  const localDailyCorrect = localDaily.date === today ? localDaily.correct : 0;
  const cloudDailyCorrect = cloudDaily.date === today ? cloudDaily.correct : 0;
  merged.daily = {
    date: today,
    count: Math.max(localDailyCount, cloudDailyCount),
    correct: Math.max(localDailyCorrect, cloudDailyCorrect),
  };

  merged.streak = mergeStreak(
    normalizeStreak(local.streak),
    normalizeStreak(cloud.streak)
  );
  applyStreakAfterCorrect(merged);

  return merged;
}

function mergeAttemptStats(
  local: AccountingAttemptStats,
  cloud: AccountingAttemptStats
): AccountingAttemptStats {
  const merged: AccountingAttemptStats = {};
  const levelKeys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
  levelKeys.forEach((levelKey) => {
    merged[levelKey] = {};
    const localQuestions = local[levelKey] || {};
    const cloudQuestions = cloud[levelKey] || {};
    const questionIds = new Set([...Object.keys(localQuestions), ...Object.keys(cloudQuestions)]);
    questionIds.forEach((questionId) => {
      merged[levelKey][questionId] = {};
      const localSteps = localQuestions[questionId] || {};
      const cloudSteps = cloudQuestions[questionId] || {};
      const stepIds = new Set([...Object.keys(localSteps), ...Object.keys(cloudSteps)]);
      stepIds.forEach((stepId) => {
        const a = localSteps[stepId] || { correct: 0, incorrect: 0 };
        const b = cloudSteps[stepId] || { correct: 0, incorrect: 0 };
        merged[levelKey][questionId][stepId] = {
          correct: Math.max(a.correct || 0, b.correct || 0),
          incorrect: Math.max(a.incorrect || 0, b.incorrect || 0),
        };
      });
    });
  });
  return merged;
}

function mergeStreak(local: StreakProgress, cloud: StreakProgress): StreakProgress {
  const localEffective = getAliveStreakCount(local);
  const cloudEffective = getAliveStreakCount(cloud);

  if (localEffective > cloudEffective) {
    return { count: localEffective, lastDate: local.lastDate };
  }
  if (cloudEffective > localEffective) {
    return { count: cloudEffective, lastDate: cloud.lastDate };
  }

  // Same effective count — prefer the more recent qualification day.
  if ((local.lastDate || '') >= (cloud.lastDate || '')) {
    return { count: localEffective, lastDate: localEffective ? local.lastDate : '' };
  }
  return { count: cloudEffective, lastDate: cloudEffective ? cloud.lastDate : '' };
}

export async function ensureUserProfile(params: {
  uid: string;
  email?: string | null;
  name?: string | null;
  photoURL?: string | null;
}): Promise<void> {
  const ref = doc(db, 'users', params.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      email: params.email || '',
      name: params.name || '',
      photoURL: params.photoURL || '',
      premium: false,
      createdAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(
    ref,
    {
      email: params.email || snap.data()?.email || '',
      name: params.name || snap.data()?.name || '',
      photoURL: params.photoURL || snap.data()?.photoURL || '',
    },
    { merge: true }
  );
}

export async function setUserPremium(uid: string, premium: boolean): Promise<void> {
  if (!uid) return;
  await setDoc(
    doc(db, 'users', uid),
    {
      premium,
      premiumUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function syncProgressFromCloud(uid: string): Promise<LearnerProgress> {
  const local = await loadLocalProgress();
  const snap = await getDoc(doc(db, 'users', uid));
  const cloudProgress = snap.exists() ? (snap.data()?.progress as LearnerProgress | undefined) : undefined;
  const merged = mergeProgress(local, cloudProgress);
  await saveLocalProgress(merged);
  await setDoc(
    doc(db, 'users', uid),
    {
      progress: merged,
      progressSyncedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return merged;
}

export async function pushProgressToCloud(uid: string, progress: LearnerProgress): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    {
      progress,
      progressSyncedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordQuizAnswer(params: {
  subject: string;
  paper: 'P1' | 'P2' | null;
  questionId: string;
  correct: boolean;
  topicId?: string;
  uid?: string | null;
  skipDailyLimit?: boolean;
}): Promise<LearnerProgress> {
  const progress = await loadLocalProgress();
  if (!params.skipDailyLimit && isDailyQuizLimitReached(progress)) {
    return progress;
  }

  const stats = progress.stats[params.subject] || { correct: 0, incorrect: 0 };
  if (params.correct) stats.correct += 1;
  else stats.incorrect += 1;
  progress.stats[params.subject] = stats;

  if (params.paper) {
    if (!progress.questionStats[params.subject]) progress.questionStats[params.subject] = {};
    const paperMap = progress.questionStats[params.subject][params.paper] || {};
    const previous = paperMap[params.questionId];
    // Prefer correct answers winning on re-attempts.
    paperMap[params.questionId] = previous === 1 || params.correct ? 1 : 0;
    progress.questionStats[params.subject][params.paper] = paperMap;
  }

  if (params.topicId) {
    const topicMap = progress.topicQuestionStats[params.topicId] || {};
    const previous = topicMap[params.questionId];
    topicMap[params.questionId] = previous === 1 || params.correct ? 1 : 0;
    progress.topicQuestionStats[params.topicId] = topicMap;
  }

  const today = todayKey();
  if (progress.daily.date !== today) {
    progress.daily = { date: today, count: 1, correct: params.correct ? 1 : 0 };
  } else {
    progress.daily.count += 1;
    if (params.correct) progress.daily.correct += 1;
  }

  if (params.correct) applyStreakAfterCorrect(progress);

  await saveLocalProgress(progress);
  if (params.uid) {
    try {
      await pushProgressToCloud(params.uid, progress);
    } catch (error) {
      console.error('Failed to sync quiz progress:', error);
    }
  }
  return progress;
}

export async function markPracticeCompleted(params: {
  questionId: string;
  topicName: string;
  uid?: string | null;
}): Promise<LearnerProgress> {
  const progress = await loadLocalProgress();
  progress.practiceCompleted = {
    ...(progress.practiceCompleted || {}),
    [params.questionId]: params.topicName,
  };
  await saveLocalProgress(progress);
  if (params.uid) {
    try {
      await pushProgressToCloud(params.uid, progress);
    } catch (error) {
      console.error('Failed to sync practice progress:', error);
    }
  }
  return progress;
}

export async function resetPracticeCompleted(uid?: string | null): Promise<LearnerProgress> {
  const progress = await loadLocalProgress();
  progress.practiceCompleted = {};
  await saveLocalProgress(progress);
  if (uid) {
    try {
      await pushProgressToCloud(uid, progress);
    } catch (error) {
      console.error('Failed to sync practice reset:', error);
    }
  }
  return progress;
}

export function accountingLevelKey(subtopicName: string, levelName: string): string {
  return `${subtopicName}::${levelName}`;
}

export function isAccountingLevelComplete(
  progress: LearnerProgress | null | undefined,
  subtopicName: string,
  levelName: string
): boolean {
  return !!progress?.accountingLevelsCompleted?.[accountingLevelKey(subtopicName, levelName)];
}

export function isAccountingLevelUnlocked(
  progress: LearnerProgress | null | undefined,
  subtopicName: string,
  levels: { name: string }[],
  index: number
): boolean {
  if (index <= 0) return true;
  return isAccountingLevelComplete(progress, subtopicName, levels[index - 1].name);
}

export function isPremiumAccountingLevel(levelName: string): boolean {
  return levelName.includes('Level 3') || levelName.includes('Level 4');
}

export async function markAccountingLevelCompleted(params: {
  subtopicName: string;
  levelName: string;
  uid?: string | null;
}): Promise<LearnerProgress> {
  return mutateProgress((progress) => {
    progress.accountingLevelsCompleted = {
      ...(progress.accountingLevelsCompleted || {}),
      [accountingLevelKey(params.subtopicName, params.levelName)]: todayKey(),
    };
  }, params.uid);
}

export function getCompletedAccountingQuestionIds(
  progress: LearnerProgress | null | undefined,
  subtopicName: string,
  levelName: string
): string[] {
  const map = progress?.accountingQuestionsCompleted?.[accountingLevelKey(subtopicName, levelName)];
  return map ? Object.keys(map) : [];
}

export function getAccountingLevelMastery(
  progress: LearnerProgress | null | undefined,
  subtopicName: string,
  levelName: string
): { correct: number; incorrect: number; attempted: number; mastery: number } {
  return summarizeAttemptStats(
    progress?.accountingAttemptStats?.[accountingLevelKey(subtopicName, levelName)]
  );
}

function summarizeAttemptStats(
  questions: Record<string, Record<string, AttemptCounts>> | undefined
): { correct: number; incorrect: number; attempted: number; mastery: number } {
  let correct = 0;
  let incorrect = 0;
  Object.values(questions || {}).forEach((steps) => {
    Object.values(steps).forEach((counts) => {
      correct += counts.correct || 0;
      incorrect += counts.incorrect || 0;
    });
  });
  const attempted = correct + incorrect;
  return {
    correct,
    incorrect,
    attempted,
    mastery: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
  };
}

export function getAccountingTopicProgressView(
  progress: LearnerProgress | null | undefined,
  subtopicNames: string[]
): SubjectProgressView {
  const needles = new Set(subtopicNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
  let correct = 0;
  let incorrect = 0;

  Object.entries(progress?.accountingAttemptStats || {}).forEach(([levelKey, questions]) => {
    const subtopicName = levelKey.split('::')[0]?.trim().toLowerCase();
    if (!subtopicName || !needles.has(subtopicName)) return;
    const totals = summarizeAttemptStats(questions);
    correct += totals.correct;
    incorrect += totals.incorrect;
  });

  const attempted = correct + incorrect;
  const mastery = attempted === 0 ? 0 : Math.round((correct / attempted) * 100);
  const { level, label } = getNscLevel(correct, incorrect);

  return {
    correct,
    incorrect,
    answered: attempted,
    accuracy: mastery,
    mastery,
    level,
    label,
    hasStats: attempted > 0,
  };
}

export async function recordAccountingAttempt(params: {
  subtopicName: string;
  levelName: string;
  questionId: string;
  stepId: string;
  correct: boolean;
  uid?: string | null;
}): Promise<LearnerProgress> {
  return mutateProgress((progress) => {
    const levelKey = accountingLevelKey(params.subtopicName, params.levelName);
    if (!progress.accountingAttemptStats) progress.accountingAttemptStats = {};
    const levelStats = progress.accountingAttemptStats[levelKey] || {};
    const questionStats = levelStats[params.questionId] || {};
    const current = questionStats[params.stepId] || { correct: 0, incorrect: 0 };
    questionStats[params.stepId] = {
      correct: current.correct + (params.correct ? 1 : 0),
      incorrect: current.incorrect + (params.correct ? 0 : 1),
    };
    progress.accountingAttemptStats = {
      ...(progress.accountingAttemptStats || {}),
      [levelKey]: {
        ...levelStats,
        [params.questionId]: questionStats,
      },
    };
  }, params.uid);
}

export async function resetAccountingLevelQuestions(params: {
  subtopicName: string;
  levelName: string;
  uid?: string | null;
}): Promise<LearnerProgress> {
  return mutateProgress((progress) => {
    const key = accountingLevelKey(params.subtopicName, params.levelName);
    progress.accountingQuestionsCompleted = {
      ...(progress.accountingQuestionsCompleted || {}),
      [key]: {},
    };
  }, params.uid);
}

export async function markAccountingQuestionCompleted(params: {
  subtopicName: string;
  levelName: string;
  questionId: string;
  uid?: string | null;
}): Promise<LearnerProgress> {
  return mutateProgress((progress) => {
    const key = accountingLevelKey(params.subtopicName, params.levelName);
    const existing = progress.accountingQuestionsCompleted[key] || {};
    progress.accountingQuestionsCompleted = {
      ...(progress.accountingQuestionsCompleted || {}),
      [key]: {
        ...existing,
        [params.questionId]: existing[params.questionId] || todayKey(),
      },
    };
  }, params.uid);
}

