import { collection, getDocs, query, where, DocumentData } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface AccountingTopic {
  id: number;
  main_topic: string;
  sub_topic: string;
}

export interface AccountingQuestion {
  id: string;
  type: string;
  prompt: string;
  options?: string[];
  answer?: string;
  pairs?: Record<string, string>;
  categories?: string[];
  categorise_items?: Record<string, string>;
  items?: Record<string, string> | string[];
  explanation?: string;
  items_list?: string[];
  correct_order?: string[];
  context?: string;
  steps?: { prompt: string; options: string[]; answer: string; explanation?: string }[];
}

export interface AccountingLessonData {
  topic: string;
  level: string;
  data: AccountingQuestion[];
}

export interface AccountingSubtopic {
  topic: string;
  levels: string[];
}

const TOPICS_COLLECTION = 'accounting_topics';
const QUESTIONS_COLLECTION = 'accounting';

let topicsCache: AccountingTopic[] | null = null;

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function parseStringArray(value: unknown): string[] {
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  if (parsed && typeof parsed === 'object') {
    return Object.values(parsed as Record<string, unknown>).map(String).filter(Boolean);
  }
  return [];
}

function parseStringRecord(value: unknown): Record<string, string> | undefined {
  const parsed = parseJsonValue(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const entries = Object.entries(parsed as Record<string, unknown>).map(([key, val]) => [
    key,
    String(val),
  ]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function parseItems(value: unknown): Record<string, string> | string[] | undefined {
  const parsed = parseJsonValue(value);
  if (Array.isArray(parsed)) {
    const list = parsed.map(String).filter(Boolean);
    return list.length ? list : undefined;
  }
  return parseStringRecord(parsed);
}

function parseSteps(
  value: unknown
): { prompt: string; options: string[]; answer: string; explanation?: string }[] | undefined {
  const parsed = parseJsonValue(value);
  let list: unknown[] = [];

  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const nested = (parsed as { steps?: unknown }).steps;
    list = Array.isArray(nested)
      ? nested
      : Object.values(parsed as Record<string, unknown>).filter(
          (item) => item && typeof item === 'object' && !Array.isArray(item)
        );
  }

  const steps = list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const options = parseStringArray(row.options);
      const answer = row.answer != null ? String(row.answer) : '';
      if (!options.length || !answer) return null;
      return {
        prompt: String(row.prompt || ''),
        options,
        answer,
        explanation: row.explanation != null ? String(row.explanation) : undefined,
      };
    })
    .filter((step): step is NonNullable<typeof step> => step != null);

  return steps.length ? steps : undefined;
}

function mapTopic(data: DocumentData): AccountingTopic | null {
  const id = Number(data.id);
  const main_topic = String(data.main_topic || '').trim();
  const sub_topic = String(data.sub_topic || '').trim();
  if (!Number.isFinite(id) || !main_topic || !sub_topic) return null;
  return { id, main_topic, sub_topic };
}

function mapQuestion(docId: string, data: DocumentData): AccountingQuestion | null {
  if (data.active === false || data.active === 0) return null;

  const type = String(data.question_type || data.type || '').trim();
  if (!type) return null;

  const options = parseStringArray(data.options);
  const items = parseItems(data.items) ?? (type === 'drag-to-sort' ? options : undefined);

  return {
    id: String(data.question_id || docId),
    type,
    prompt: String(data.prompt || ''),
    options: options.length ? options : undefined,
    answer: data.answer != null ? String(data.answer) : undefined,
    pairs: parseStringRecord(data.pairs),
    categories: parseStringArray(data.categories),
    items,
    explanation: data.explanation ? String(data.explanation) : undefined,
    correct_order: parseStringArray(data.correct_order),
    context: data.context ? String(data.context) : undefined,
    steps: parseSteps(data.steps),
  };
}

export function shuffleQuestions(questions: AccountingQuestion[]): AccountingQuestion[] {
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isLevelOne(levelName: string): boolean {
  return /level\s*1/i.test(levelName);
}

function sortLevels(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => {
    const aNum = Number((a.match(/level\s*(\d+)/i) || [])[1] || 99);
    const bNum = Number((b.match(/level\s*(\d+)/i) || [])[1] || 99);
    if (aNum !== bNum) return aNum - bNum;
    return a.localeCompare(b);
  });
}

export async function fetchAccountingTopics(): Promise<AccountingTopic[]> {
  if (topicsCache) return topicsCache;

  const snap = await getDocs(collection(db, TOPICS_COLLECTION));
  const topics = snap.docs
    .map((docSnap) => mapTopic(docSnap.data()))
    .filter((topic): topic is AccountingTopic => topic != null)
    .sort((a, b) => {
      const main = a.main_topic.localeCompare(b.main_topic);
      return main !== 0 ? main : a.sub_topic.localeCompare(b.sub_topic);
    });

  topicsCache = topics;
  return topics;
}

export async function fetchSubtopicsByMainTopic(mainTopic: string): Promise<AccountingSubtopic[]> {
  const topics = (await fetchAccountingTopics()).filter(
    (topic) => topic.main_topic.toLowerCase() === mainTopic.toLowerCase()
  );
  if (topics.length === 0) return [];

  const topicIds = topics.map((topic) => topic.id);
  const questionsByTopicId = new Map<number, Set<string>>();

  const snaps = await Promise.all(
    topicIds.map((topicId) =>
      getDocs(query(collection(db, QUESTIONS_COLLECTION), where('accounting_topic_id', '==', topicId)))
    )
  );

  snaps.forEach((snap, index) => {
    const levels = new Set<string>();
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.active === false || data.active === 0) return;
      const level = String(data.level || '').trim();
      if (level) levels.add(level);
    });
    questionsByTopicId.set(topicIds[index], levels);
  });

  return topics
    .map((topic) => ({
      topic: topic.sub_topic,
      levels: sortLevels([...(questionsByTopicId.get(topic.id) || [])]),
    }))
    .filter((subtopic) => subtopic.levels.length > 0);
}

async function findTopicBySubtopicName(subtopicName: string): Promise<AccountingTopic | null> {
  const topics = await fetchAccountingTopics();
  const needle = subtopicName.trim().toLowerCase();
  return topics.find((topic) => topic.sub_topic.toLowerCase() === needle) || null;
}

export async function fetchQuestionsByTopicAndLevel(
  subtopicName: string,
  levelName: string
): Promise<AccountingLessonData> {
  const topic = await findTopicBySubtopicName(String(subtopicName));
  if (!topic) {
    return { topic: String(subtopicName), level: String(levelName), data: [] };
  }

  const snap = await getDocs(
    query(collection(db, QUESTIONS_COLLECTION), where('accounting_topic_id', '==', topic.id))
  );

  const levelNeedle = String(levelName).trim().toLowerCase();
  const questions = snap.docs
    .map((docSnap) => {
      const raw = docSnap.data();
      if (String(raw.level || '').trim().toLowerCase() !== levelNeedle) return null;
      return mapQuestion(docSnap.id, raw);
    })
    .filter((question): question is AccountingQuestion => question != null)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    topic: topic.sub_topic,
    level: String(levelName),
    data: isLevelOne(levelName) ? shuffleQuestions(questions) : questions,
  };
}
