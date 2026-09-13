import type { DayKey } from '@/lib/dayKey';

/** Word-list tracks from complete-hsk-vocabulary: old = HSK 2.0, new = HSK 3.0, newest = latest revision. */
export type HskTrack = 'hsk2' | 'hsk3' | 'hsk3-newest';
export type Facet = 'read' | 'listen' | 'speak' | 'write';
/** 5 = neutral tone. */
export type Tone = 1 | 2 | 3 | 4 | 5;
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;
export type CardState = 'new' | 'learning' | 'review' | 'relearning' | 'suspended';
export type WordSource = 'hsk-list' | 'reader' | 'manual' | 'import' | 'coach';
export type ImageStatus = 'none' | 'pending' | 'ok' | 'skip';

/** HSK level per track; level 7 means band 7–9 on the HSK 3.0 tracks. */
export interface HskLevels {
  hsk2?: number;
  hsk3?: number;
  hsk3Newest?: number;
}

export interface WordExample {
  zh: string;
  vi?: string;
  en?: string;
  source: 'tatoeba' | 'ai' | 'user';
}

export interface Word {
  id: string;
  simplified: string;
  traditional?: string;
  /** Canonical numbered pinyin, e.g. "yin2 hang2". */
  pinyinNum: string;
  /** Other accepted readings (neutral tone, erhua, sandhi forms). */
  pinyinVariants: string[];
  /** e.g. "NGÂN HÀNG"; ambiguous characters as "HÀNH/HÀNG". */
  hanViet: string;
  meaningVi: string[];
  meaningEn: string[];
  pos: string[];
  classifiers: string[];
  hsk: HskLevels;
  freqRank?: number;
  radical?: string;
  /** Hán-Việt reading appears in the Vietnamese gloss (学生 = học sinh). */
  cognate: boolean;
  source: WordSource;
  context?: { sentence: string; sentenceVi?: string; textId?: string };
  examples: WordExample[];
  imageUrl?: string;
  imageStatus: ImageStatus;
  tags: string[];
  /** Permanent idempotency marker for the one-time first-tag XP reward. */
  tagRewardedAt?: number;
  knownWithoutSrs?: boolean;
  ai?: { usageNoteVi?: string; collocations?: { zh: string; vi: string }[]; at: number };
  createdAt: number;
  updatedAt: number;
}

/** One simplified Han character learned through the writing facet. */
export interface HanziCharacter {
  /** The literal character is the stable id. */
  id: string;
  character: string;
  /** Words that caused this character to be discovered/unlocked. */
  wordIds: string[];
  pinyin: string[];
  meaningsVi: string[];
  hanViet: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Card {
  id: string;
  subjectType: 'word' | 'char';
  subjectId: string;
  facet: Facet;
  state: CardState;
  repetition: number;
  easeFactor: number;
  intervalDays: number;
  due: number;
  lapses: number;
  lastReviewedAt?: number;
  introducedDay?: DayKey;
  /** FSRS memory and bookkeeping, separate from the app's successful-answer streak. */
  fsrs?: { stability: number; difficulty: number; learningSteps?: number; state?: number; reps?: number; lapses?: number };
  /** Last active state per algorithm, so switching never overwrites the other schedule. */
  schedulerStates?: Partial<
    Record<
      'sm2' | 'fsrs',
      {
        repetition: number;
        easeFactor: number;
        intervalDays: number;
        due: number;
        lapses: number;
        lastReviewedAt?: number;
        fsrs?: { stability: number; difficulty: number; learningSteps?: number; state?: number; reps?: number; lapses?: number };
      }
    >
  >;
}

export type QuestionType =
  | 'learn-intro'
  | 'mcq-hanzi-vi'
  | 'mcq-vi-hanzi'
  | 'picture'
  | 'match'
  | 'hanzi-pinyin'
  | 'listen-hanzi'
  | 'listen-meaning'
  | 'listen-tone'
  | 'pinyin-typing'
  | 'pinyin-dictation'
  | 'ime-cloze'
  | 'measure-word'
  | 'sentence-order'
  | 'sentence-dictation'
  | 'speak'
  | 'sentence-writing'
  | 'stroke-quiz';

export type SchedSnapshot = Pick<Card, 'repetition' | 'easeFactor' | 'intervalDays' | 'due'>;

export interface ReviewLog {
  id?: number;
  cardId: string;
  subjectId: string;
  facet: Facet;
  questionType: QuestionType;
  mode: 'learn' | 'review' | 'retry' | 'match-bonus';
  correct: boolean;
  quality: Quality;
  /** FSRS-style rating kept from day one so the history can be replayed later. */
  rating: 1 | 2 | 3 | 4;
  elapsedMs: number;
  hints: number;
  replays: number;
  reviewedAt: number;
  dayKey: DayKey;
  before: SchedSnapshot;
  after: SchedSnapshot;
}

export type XpKind =
  | 'save-word'
  | 'learn-word'
  | 'review-correct'
  | 'review-wrong'
  | 'retry-correct'
  | 'session-complete'
  | 'first-tag'
  | 'pinyin-lesson'
  | 'drill-round'
  | 'text-read'
  | 'comprehension'
  | 'dictation'
  | 'speaking'
  | 'shadowing'
  | 'coach'
  | 'daily-goal';

export interface DailyStats {
  dayKey: DayKey;
  xp: number;
  /** XP from learning activities only; a day counts for the streak when this is > 0. */
  learningXp: number;
  xpByKind: Partial<Record<XpKind, number>>;
  /** Number of events per kind today (daily caps count events, not XP). */
  eventsByKind: Partial<Record<XpKind, number>>;
  answers: number;
  correct: number;
  newIntroduced: number;
  textsRead: number;
  dictations: number;
  speakingAttempts: number;
  drillItems: number;
  coachSeconds: number;
  goalMetAt?: number;
}

export interface ComprehensionQuestion {
  type: 'mcq' | 'short';
  qZh: string;
  qVi: string;
  options?: string[];
  answerZh: string;
  answerVi: string;
}

export interface TextDoc {
  id: string;
  kind: 'ai-story' | 'ai-dialogue' | 'pasted';
  title: string;
  titleVi?: string;
  level?: number;
  genre?: string;
  sentences: { zh: string; vi?: string; speaker?: 'A' | 'B' }[];
  targetWordIds: string[];
  questions: ComprehensionQuestion[];
  imageUrl?: string;
  /** Per-sentence manual token boundaries ([start, end) offsets). */
  segOverrides: Record<number, [number, number][]>;
  tokenCache?: { segVersion: number; sentences: unknown[] };
  progress: {
    sentenceIndex: number;
    /** First time this text was actually opened; used to reject instant completion. */
    openedAt?: number;
    completedAt?: number;
    /** Question indexes that have already granted comprehension XP. */
    comprehensionDone?: number[];
  };
  coverage?: number;
  createdAt: number;
}

/** Imported dictionary row (CC-CEDICT + CVDICT). */
export interface DictEntry {
  id?: number;
  /** simplified */
  s: string;
  /** traditional */
  t: string;
  /** numbered pinyin */
  p: string;
  /** toneless pinyin without spaces, for search */
  pt: string;
  en: string[];
  vi: string[];
  /** classifiers */
  cl: string[];
}

export interface CacheEntry {
  key: string;
  kind: string;
  value: unknown;
  createdAt: number;
  expiresAt: number;
}

export interface AudioCacheEntry {
  key: string;
  blob: Blob;
  bytes: number;
  createdAt: number;
}

export interface CoachSession {
  id: string;
  scenario: string;
  startedAt: number;
  endedAt?: number;
  transcript: { role: 'user' | 'ai'; text: string; at: number }[];
}

export interface KvEntry {
  key: string;
  value: unknown;
}

export type ThemeName = 'dark' | 'light';
export type PinyinDisplay = 'all' | 'unknown' | 'none';

export interface Settings {
  geminiApiKey: string;
  pixabayApiKey: string;
  unsplashApiKey: string;
  geminiTextModel: string;
  geminiLiveModel: string;
  geminiTtsModel: string;
  hskTrack: HskTrack;
  currentLevel: number;
  newWordsPerDay: number;
  maxReviewsPerDay: number;
  sessionSize: number;
  dailyGoalXp: 50 | 150 | 300;
  dayStartHour: number;
  enabledFacets: Facet[];
  pinyinDisplay: PinyinDisplay;
  toneColors: boolean;
  tonelessEasyMode: boolean;
  ttsVoiceURI: string;
  ttsRate: number;
  theme: ThemeName;
  musicTrack: string;
  musicVolume: number;
  musicAutoplay: boolean;
  fontScale: number;
  scheduler: 'sm2' | 'fsrs';
  dataVersion: number;
  /** The learner has picked a word list, level and daily pace. */
  onboardingDone: boolean;
}

export interface GamificationState {
  xp: number;
  badges: string[];
}
