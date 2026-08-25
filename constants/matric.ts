export const brand = {
  background: '#0B1220',
  backgroundElevated: '#121A2A',
  card: '#161F30',
  cardElevated: '#1A2436',
  practiceCard: '#1A2240',
  border: 'rgba(148, 163, 184, 0.14)',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#14B8A6',
  primarySoft: '#2DD4BF',
  emerald: '#22C55E',
  amber: '#F59E0B',
  rose: '#F43F5E',
  sky: '#38BDF8',
  indigo: '#312E81',
  frosted: 'rgba(11, 18, 32, 0.86)',
  bullseyeBg: 'rgba(34, 197, 94, 0.12)',
  oopsieBg: 'rgba(244, 63, 94, 0.12)',
};

export const subjectAccents: Record<string, [string, string]> = {
  Mathematics: ['#FB923C', '#F43F5E'],
  'Mathematical Literacy': ['#14B8A6', '#22C55E'],
  'Life Sciences': ['#22C55E', '#A3E635'],
  Geography: ['#38BDF8', '#22D3EE'],
  'Business Studies': ['#E879F9', '#A855F7'],
  'Physical Sciences': ['#FB7185', '#F472B6'],
  History: ['#F59E0B', '#F97316'],
  Economics: ['#6366F1', '#8B5CF6'],
  Accounting: ['#14B8A6', '#0EA5E9'],
  'Agricultural Sciences': ['#84CC16', '#22C55E'],
  Tourism: ['#38BDF8', '#6366F1'],
  'Life Orientation': ['#A78BFA', '#EC4899'],
};

export const HOME_SUBJECTS = [
  'Business Studies',
  'Geography',
  'Life Sciences',
  'Mathematical Literacy',
  'Mathematics',
  'Physical Sciences',
] as const;

export type HomeSubject = (typeof HOME_SUBJECTS)[number];

export const HOME_SLOGANS = [
  'Unlock quick exam questions instead of scrolling.',
  'A fun, zero-stress study break for Grade 12 Matric students.',
  'Practice Matric exam questions, one quick break at a time.',
  'Turn scroll time into study time.',
  'Grade 12 prep that actually sticks.',
];

export const SHARE_MESSAGE =
  'Practice Grade 12 Accounting exam questions with Accounting CPA QUIZ — step-by-step study instead of scrolling.';

export const SITE_URL = 'https://matricunlocked.co.za';
export const SHARE_URL = 'https://matricunlocked.co.za/share?app=accounting';
export const SHARE_PROMPT_EVERY = 10;
