import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  DocumentData,
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import { LearnerProgress, getSubjectQuestionResults } from '@/services/progress';

export interface QuizQuestion {
  id: string;
  name: string;
  grade: number;
  question: string;
  context?: string;
  options: string[];
  answer: string;
  topic?: string;
  subTopic?: string;
  year?: number;
  term?: number;
  image_path?: string;
  image_path_2?: string;
  aiExplanation?: string;
  active?: boolean;
  ready?: boolean;
  steps?: unknown;
}

export interface QuizFilters {
  paper: 'all' | '1' | '2';
  term: 'all' | '2' | '4';
}

export type QuizPickResult =
  | { status: 'ok'; question: QuizQuestion }
  | { status: 'exhausted' }
  | { status: 'error'; message: string };

function normalizeOptions(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.map(String).filter(Boolean);
  }
  if (options && typeof options === 'object') {
    return Object.values(options as Record<string, unknown>).map(String).filter(Boolean);
  }
  return [];
}

export function isServableQuestion(data: DocumentData | QuizQuestion | undefined): boolean {
  if (!data) return false;
  if ((data as QuizQuestion).ready !== true) return false;
  if ((data as QuizQuestion).active === false) return false;
  if (!(data as QuizQuestion).answer) return false;
  return normalizeOptions((data as QuizQuestion).options).length > 0;
}

export function mapQuestionDoc(id: string, data: DocumentData): QuizQuestion {
  return {
    id,
    name: String(data.name || ''),
    grade: Number(data.grade || 1),
    question: String(data.question || ''),
    context: data.context ? String(data.context) : undefined,
    options: normalizeOptions(data.options),
    answer: String(data.answer || ''),
    topic: data.topic ? String(data.topic) : undefined,
    subTopic: data.subTopic ? String(data.subTopic) : undefined,
    year: data.year != null ? Number(data.year) : undefined,
    term: data.term != null ? Number(data.term) : undefined,
    image_path: data.image_path ? String(data.image_path) : undefined,
    image_path_2: data.image_path_2 ? String(data.image_path_2) : undefined,
    aiExplanation: data.aiExplanation ? String(data.aiExplanation) : undefined,
    active: data.active,
    ready: data.ready,
    steps: data.steps,
  };
}

export function getBaseSubject(paperName: string): string {
  return paperName.replace(/\s+P[12]$/i, '').trim();
}

export function getPaperKey(paperName: string): 'P1' | 'P2' | null {
  if (/\sP1$/i.test(paperName)) return 'P1';
  if (/\sP2$/i.test(paperName)) return 'P2';
  return null;
}

export function hasSteps(question: QuizQuestion): boolean {
  const steps = question.steps;
  if (!steps) return false;
  if (Array.isArray(steps)) return steps.length > 0;
  if (typeof steps === 'object' && steps !== null) {
    const nested = (steps as { steps?: unknown }).steps;
    if (Array.isArray(nested)) return nested.length > 0;
    return Object.keys(steps as object).length > 0;
  }
  return false;
}

export function displayTopicName(name?: string): string | undefined {
  if (!name) return undefined;
  return name.split(':')[0].trim();
}

export function topicKey(name?: string): string {
  if (!name) return '';
  return displayTopicName(name) || name.trim();
}

function topicMatchKey(name?: string): string {
  return topicKey(name).toLowerCase();
}

const UNCATEGORIZED_TOPIC = 'General';

export interface ParentTopicMap {
  /** matchKey → canonical parent display name */
  parents: Map<string, { name: string; order: number }>;
  /** sub-topic matchKey → parent matchKey */
  childToParent: Map<string, string>;
}

const parentTopicCache = new Map<string, ParentTopicMap>();
export const FIRESTORE_GRADE_IDS = [1, 2, 3] as const;

function isUsableTopicName(name?: string): boolean {
  if (!name) return false;
  return !/NO MATCH/i.test(name);
}

export function resolveQuestionParentTopic(
  question: QuizQuestion,
  topicMap?: ParentTopicMap | null
): string {
  const topic = topicKey(question.topic);
  const subTopic = topicKey(question.subTopic);
  const topicMatch = topicMatchKey(topic);
  const subMatch = topicMatchKey(subTopic);

  if (topicMap) {
    if (topicMatch && topicMap.parents.has(topicMatch)) {
      return topicMap.parents.get(topicMatch)!.name;
    }
    if (topicMatch && topicMap.childToParent.has(topicMatch)) {
      const parentKey = topicMap.childToParent.get(topicMatch)!;
      return topicMap.parents.get(parentKey)?.name || topic;
    }
    if (subMatch && topicMap.childToParent.has(subMatch)) {
      const parentKey = topicMap.childToParent.get(subMatch)!;
      return topicMap.parents.get(parentKey)?.name || topic;
    }
    if (subMatch && topicMap.parents.has(subMatch)) {
      return topicMap.parents.get(subMatch)!.name;
    }
  }

  if (topic && isUsableTopicName(topic)) return topic;
  return UNCATEGORIZED_TOPIC;
}

export function questionMatchesTopic(
  question: QuizQuestion,
  topic?: string,
  topicMap?: ParentTopicMap | null
): boolean {
  if (!topic) return true;
  const key = topicMatchKey(topic);
  if (!key) return true;
  return topicMatchKey(resolveQuestionParentTopic(question, topicMap)) === key;
}

export async function fetchSubjectParentTopics(subject: string): Promise<ParentTopicMap> {
  const cached = parentTopicCache.get(subject);
  if (cached) return cached;

  const parents = new Map<string, { name: string; order: number }>();
  const childToParent = new Map<string, string>();
  const byId = new Map<string, { name: string; parentTopicId?: string; order: number }>();

  try {
    const paperNames = paperNamesForSubject(subject, 'all');
    const snaps = await Promise.all(
      paperNames.flatMap((paperName) =>
        FIRESTORE_GRADE_IDS.map((gradeId) =>
          getDocs(
            query(
              collection(db, 'topics'),
              where('grade', '==', gradeId),
              where('subject', '==', paperName),
              limit(200)
            )
          )
        )
      )
    );

    snaps.forEach((snap) => {
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const name = String(data.name || '').trim();
        if (!isUsableTopicName(name) || /NO MATCH/i.test(String(data.description || ''))) return;
        const parentTopicId = data.parentTopicId ? String(data.parentTopicId) : '';
        byId.set(docSnap.id, {
          name,
          parentTopicId: parentTopicId || undefined,
          order: Number(data.order || 0),
        });
      });
    });

    byId.forEach((topic) => {
      if (topic.parentTopicId) return;
      const key = topicMatchKey(topic.name);
      const existing = parents.get(key);
      if (!existing || topic.order < existing.order) {
        parents.set(key, { name: topicKey(topic.name) || topic.name, order: topic.order });
      }
    });

    byId.forEach((topic) => {
      if (!topic.parentTopicId) return;
      const parent = byId.get(topic.parentTopicId);
      if (!parent || parent.parentTopicId) return;
      childToParent.set(topicMatchKey(topic.name), topicMatchKey(parent.name));
    });
  } catch (error) {
    console.error('Failed to fetch parent topics:', error);
  }

  const map = { parents, childToParent };
  parentTopicCache.set(subject, map);
  return map;
}

export interface TopicMasteryRow {
  topicName: string;
  displayName: string;
  total: number;
  completed: number;
  correct: number;
  mastery: number;
}

export interface SubjectMasteryBreakdown {
  totalQuestions: number;
  completedQuestions: number;
  topics: TopicMasteryRow[];
}

function topicRowFromQuestions(
  topicName: string,
  list: QuizQuestion[],
  results: Record<string, 0 | 1>
): TopicMasteryRow {
  let completed = 0;
  let correct = 0;
  for (const question of list) {
    const value = results[question.id];
    if (value == null) continue;
    completed += 1;
    if (value === 1) correct += 1;
  }
  const total = list.length;
  return {
    topicName,
    displayName: displayTopicName(topicName) || topicName,
    total,
    completed,
    correct,
    mastery: total === 0 ? 0 : Math.round((correct / total) * 100),
  };
}

export function buildSubjectTopicBreakdown(
  pool: QuizQuestion[],
  progress: LearnerProgress,
  subject: string,
  topicMap?: ParentTopicMap | null
): SubjectMasteryBreakdown {
  const results = getSubjectQuestionResults(progress, subject);
  const byTopic = new Map<string, QuizQuestion[]>();
  const hasCurriculum = !!topicMap && topicMap.parents.size > 0;

  if (hasCurriculum) {
    [...topicMap.parents.values()]
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.name.localeCompare(b.name);
      })
      .forEach((parent) => {
        byTopic.set(parent.name, []);
      });
  }

  const unmatched: QuizQuestion[] = [];

  for (const question of pool) {
    const parentName = resolveQuestionParentTopic(question, topicMap);
    if (hasCurriculum) {
      if (byTopic.has(parentName)) byTopic.get(parentName)!.push(question);
      else unmatched.push(question);
      continue;
    }

    const list = byTopic.get(parentName) || [];
    list.push(question);
    byTopic.set(parentName, list);
  }

  const topics: TopicMasteryRow[] = [];
  byTopic.forEach((list, topicName) => {
    if (list.length === 0) return;
    topics.push(topicRowFromQuestions(topicName, list, results));
  });

  if (unmatched.length > 0) {
    topics.push(topicRowFromQuestions(UNCATEGORIZED_TOPIC, unmatched, results));
  }

  topics.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.displayName.localeCompare(b.displayName);
  });

  return {
    totalQuestions: pool.length,
    completedQuestions: pool.filter((question) => results[question.id] != null).length,
    topics,
  };
}

function paperNamesForSubject(subject: string, paper: QuizFilters['paper'] = 'all'): string[] {
  if (paper === '1') return [`${subject} P1`];
  if (paper === '2') return [`${subject} P2`];
  return [`${subject} P1`, `${subject} P2`];
}

function getAnsweredIds(progress: LearnerProgress, subject: string): Set<string> {
  const answered = new Set<string>();
  const papers = progress.questionStats[subject];
  if (!papers) return answered;
  for (const paper of ['P1', 'P2'] as const) {
    const map = papers[paper];
    if (!map) continue;
    Object.entries(map).forEach(([id, value]) => {
      if (value === 1) answered.add(id);
    });
  }
  return answered;
}

async function fetchPaperQuestions(paperName: string): Promise<QuizQuestion[]> {
  const snaps = await Promise.all(
    FIRESTORE_GRADE_IDS.map((gradeId) =>
      getDocs(
        query(
          collection(db, 'questions'),
          where('grade', '==', gradeId),
          where('name', '==', paperName),
          where('ready', '==', true),
          limit(300)
        )
      )
    )
  );
  const seen = new Set<string>();
  const questions: QuizQuestion[] = [];
  for (const snap of snaps) {
    for (const docSnap of snap.docs) {
      if (seen.has(docSnap.id)) continue;
      seen.add(docSnap.id);
      const mapped = mapQuestionDoc(docSnap.id, docSnap.data());
      if (isServableQuestion(mapped)) questions.push(mapped);
    }
  }
  return questions;
}

export async function getQuestionById(questionId: string): Promise<QuizQuestion | null> {
  const snap = await getDoc(doc(db, 'questions', questionId));
  if (!snap.exists()) return null;
  const mapped = mapQuestionDoc(snap.id, snap.data());
  return isServableQuestion(mapped) ? mapped : null;
}

export async function fetchSubjectPool(
  subject: string,
  filters: QuizFilters = { paper: 'all', term: 'all' }
): Promise<QuizQuestion[]> {
  const paperNames = paperNamesForSubject(subject, filters.paper);
  const batches = await Promise.all(paperNames.map((name) => fetchPaperQuestions(name)));
  let all = batches.flat();
  if (filters.term !== 'all') {
    const termNumber = Number(filters.term);
    all = all.filter((q) => q.term === termNumber);
  }
  return all;
}

function pickFromPool(
  pool: QuizQuestion[],
  progress: LearnerProgress,
  subject: string,
  excludeId?: string
): QuizPickResult {
  if (pool.length === 0) {
    return {
      status: 'error',
      message: `Questions for ${subject} will be added soon. Try another subject in the meantime.`,
    };
  }

  const answered = getAnsweredIds(progress, subject);
  let candidates = pool.filter((q) => q.id !== excludeId);
  const unanswered = candidates.filter((q) => !answered.has(q.id));
  if (unanswered.length > 0) candidates = unanswered;
  else if (excludeId) candidates = pool.filter((q) => q.id !== excludeId);

  if (candidates.length === 0) return { status: 'exhausted' };

  const question = candidates[Math.floor(Math.random() * candidates.length)];
  return { status: 'ok', question };
}

export async function pickRandomSubjectQuestion(
  subject: string,
  progress: LearnerProgress,
  filters: QuizFilters = { paper: 'all', term: 'all' },
  excludeId?: string,
  topic?: string
): Promise<QuizPickResult> {
  try {
    let pool = await fetchSubjectPool(subject, filters);
    if (topic) {
      const topicMap = await fetchSubjectParentTopics(subject);
      pool = pool.filter((question) => questionMatchesTopic(question, topic, topicMap));
    }
    return pickFromPool(pool, progress, subject, excludeId);
  } catch (error) {
    console.error('Failed to pick subject question:', error);
    return {
      status: 'error',
      message: `Questions for ${subject} will be added soon. Try another subject in the meantime.`,
    };
  }
}

export async function reportQuestion(questionId: string): Promise<void> {
  await updateDoc(doc(db, 'questions', questionId), {
    active: false,
    ready: false,
  });
}

export async function resolveStorageImageUrl(path?: string): Promise<string | null> {
  if (!path || path === 'image_required') return null;
  if (/^https?:\/\//i.test(path)) return path;

  const cleaned = path.replace(/^\/+/, '');
  const candidates = cleaned.startsWith('question-images/')
    ? [cleaned]
    : [`question-images/${cleaned}`, cleaned];

  for (const candidate of candidates) {
    try {
      return await getDownloadURL(ref(storage, candidate));
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function shuffleOptions(options: string[]): string[] {
  const copy = [...options];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
