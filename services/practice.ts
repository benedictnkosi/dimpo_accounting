import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { LearnerProgress } from '@/services/progress';
import {
  QuizQuestion,
  displayTopicName,
  fetchSubjectPool,
  getQuestionById,
  hasSteps,
  isServableQuestion,
  shuffleOptions,
  FIRESTORE_GRADE_IDS,
} from '@/services/questions';

export interface PracticeStep {
  step_number: number;
  type: string;
  prompt: string;
  expression?: string;
  options: string[];
  answer: string;
  hint?: string;
  teach?: string;
  final_expression?: string;
}

export interface PracticeTopicRow {
  topicName: string;
  displayName: string;
  topicId?: string;
  practiceCount: number;
  practiced: number;
  remaining: number;
  isDone: boolean;
}

export type PracticePickResult =
  | { status: 'ok'; question: QuizQuestion }
  | { status: 'exhausted' }
  | { status: 'error'; message: string };

function normalizeStepOptions(options: unknown): string[] {
  if (Array.isArray(options)) return options.map(String).filter(Boolean);
  if (options && typeof options === 'object') {
    return Object.values(options as Record<string, unknown>).map(String).filter(Boolean);
  }
  return [];
}

function asStepRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as Record<string, unknown>;
}

export function normalizePracticeSteps(raw: unknown): PracticeStep[] {
  if (!raw) return [];

  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'object') {
    const nested = (raw as { steps?: unknown }).steps;
    if (Array.isArray(nested)) list = nested;
    else {
      list = Object.values(raw as Record<string, unknown>).filter(
        (item) => item && typeof item === 'object' && !Array.isArray(item)
      );
    }
  }

  const steps = list
    .map((item, index): PracticeStep | null => {
      const row = asStepRecord(item);
      if (!row) return null;
      const options = normalizeStepOptions(row.options);
      const answer = row.answer != null ? String(row.answer) : '';
      if (!options.length || !answer) return null;

      return {
        step_number: Number(row.step_number ?? index + 1),
        type: String(row.type || 'choose'),
        prompt: String(row.prompt || ''),
        expression: row.expression != null ? String(row.expression) : undefined,
        options,
        answer,
        hint: row.hint != null ? String(row.hint) : undefined,
        teach: row.teach != null ? String(row.teach) : undefined,
        final_expression:
          row.final_expression != null ? String(row.final_expression) : undefined,
      };
    })
    .filter((step): step is PracticeStep => step != null);

  return steps.sort((a, b) => a.step_number - b.step_number);
}

export function getPracticeSteps(question: QuizQuestion): PracticeStep[] {
  return normalizePracticeSteps(question.steps);
}

export async function fetchAccountingSteppedQuestions(): Promise<QuizQuestion[]> {
  const pool = await fetchSubjectPool('Accounting', { paper: 'all', term: 'all' });
  return pool.filter((question) => hasSteps(question) && getPracticeSteps(question).length > 0);
}

async function fetchAccountingParentTopics(): Promise<Map<string, string>> {
  const idsByName = new Map<string, string>();
  try {
    const queries = ['Accounting P1', 'Accounting P2'].flatMap((subject) =>
      FIRESTORE_GRADE_IDS.map((gradeId) =>
        getDocs(
          query(
            collection(db, 'topics'),
            where('grade', '==', gradeId),
            where('subject', '==', subject),
            limit(150)
          )
        )
      )
    );
    const snaps = await Promise.all(queries);
    snaps.forEach((snap) => {
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.parentTopicId) return;
        const name = String(data.name || '');
        if (!name || /NO MATCH/i.test(name) || /NO MATCH/i.test(String(data.description || ''))) {
          return;
        }
        idsByName.set(topicKey(name), docSnap.id);
      });
    });
  } catch (error) {
    console.error('Failed to fetch accounting topics:', error);
  }
  return idsByName;
}

function topicKey(name: string): string {
  return displayTopicName(name) || name;
}

export function countPracticedForTopic(
  progress: LearnerProgress,
  topicName: string
): number {
  const key = topicKey(topicName);
  return Object.values(progress.practiceCompleted || {}).filter(
    (stored) => topicKey(stored) === key
  ).length;
}

export function getPracticedTotal(progress: LearnerProgress): number {
  return Object.keys(progress.practiceCompleted || {}).length;
}

export async function getPracticeTopicRows(
  progress: LearnerProgress
): Promise<PracticeTopicRow[]> {
  const [questions, parentIds] = await Promise.all([
    fetchAccountingSteppedQuestions(),
    fetchAccountingParentTopics(),
  ]);

  const byTopic = new Map<string, QuizQuestion[]>();
  for (const question of questions) {
    const rawTopic = question.topic?.trim();
    if (!rawTopic || /NO MATCH/i.test(rawTopic)) continue;
    const key = topicKey(rawTopic);
    const list = byTopic.get(key) || [];
    list.push(question);
    byTopic.set(key, list);
  }

  const rows: PracticeTopicRow[] = [];
  byTopic.forEach((list, key) => {
    const topicName = list[0]?.topic || key;
    const practiceCount = list.length;
    const practicedIds = new Set(
      Object.entries(progress.practiceCompleted || {})
        .filter(([, stored]) => topicKey(stored) === key)
        .map(([id]) => id)
    );
    const practiced = list.filter((q) => practicedIds.has(q.id)).length;
    const remaining = Math.max(0, practiceCount - practiced);
    rows.push({
      topicName,
      displayName: displayTopicName(topicName) || topicName,
      topicId: parentIds.get(key),
      practiceCount,
      practiced,
      remaining,
      isDone: remaining === 0 && practiceCount > 0,
    });
  });

  rows.sort((a, b) => {
    if (b.practiceCount !== a.practiceCount) return b.practiceCount - a.practiceCount;
    return a.displayName.localeCompare(b.displayName);
  });

  return rows;
}

export async function pickPracticeQuestion(
  topicName: string,
  progress: LearnerProgress,
  excludeId?: string
): Promise<PracticePickResult> {
  try {
    const key = topicKey(topicName);
    const pool = (await fetchAccountingSteppedQuestions()).filter(
      (question) => topicKey(question.topic || '') === key
    );

    if (pool.length === 0) {
      return {
        status: 'error',
        message: 'Something went wrong starting practice. Please try again.',
      };
    }

    const completed = progress.practiceCompleted || {};
    let candidates = pool.filter((q) => q.id !== excludeId && !completed[q.id]);
    if (candidates.length === 0) {
      if (!excludeId) return { status: 'exhausted' };
      candidates = pool.filter((q) => q.id !== excludeId && !completed[q.id]);
      if (candidates.length === 0) return { status: 'exhausted' };
    }

    const question = candidates[Math.floor(Math.random() * candidates.length)];
    return { status: 'ok', question };
  } catch (error) {
    console.error('Failed to pick practice question:', error);
    return {
      status: 'error',
      message: 'Something went wrong starting practice. Please try again.',
    };
  }
}

export async function loadPracticeQuestion(
  questionId: string
): Promise<{ question: QuizQuestion; steps: PracticeStep[] } | { error: string }> {
  const question = await getQuestionById(questionId);
  if (!question || !isServableQuestion(question)) {
    return { error: 'This question could not be found.' };
  }
  const steps = getPracticeSteps(question);
  if (steps.length === 0) {
    return { error: "This question doesn't have a step-by-step walkthrough." };
  }
  return { question, steps };
}

export function prepareStepOptions(step: PracticeStep): string[] {
  return shuffleOptions([...step.options]);
}
