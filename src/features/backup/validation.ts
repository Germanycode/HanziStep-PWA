import { z } from 'zod';

const finite = z.number().finite();
const nonNegative = finite.min(0);
const nonNegativeInt = z.number().int().min(0);
const nonEmpty = z.string().min(1);

const hskLevels = z
  .object({
    hsk2: z.number().int().min(1).max(9).optional(),
    hsk3: z.number().int().min(1).max(9).optional(),
    hsk3Newest: z.number().int().min(1).max(9).optional(),
  })
  .strict();

const example = z
  .object({
    zh: nonEmpty,
    vi: z.string().optional(),
    en: z.string().optional(),
    source: z.enum(['tatoeba', 'ai', 'user']),
  })
  .strict();

const word = z
  .object({
    id: nonEmpty,
    simplified: nonEmpty,
    traditional: z.string().optional(),
    pinyinNum: z.string(),
    pinyinVariants: z.array(z.string()),
    hanViet: z.string(),
    meaningVi: z.array(z.string()),
    meaningEn: z.array(z.string()),
    pos: z.array(z.string()),
    classifiers: z.array(z.string()),
    hsk: hskLevels,
    freqRank: nonNegativeInt.optional(),
    radical: z.string().optional(),
    cognate: z.boolean(),
    source: z.enum(['hsk-list', 'reader', 'manual', 'import', 'coach']),
    context: z
      .object({ sentence: z.string(), sentenceVi: z.string().optional(), textId: z.string().optional() })
      .strict()
      .optional(),
    examples: z.array(example),
    imageUrl: z.string().optional(),
    imageStatus: z.enum(['none', 'pending', 'ok', 'skip']),
    tags: z.array(z.string()),
    tagRewardedAt: finite.optional(),
    knownWithoutSrs: z.boolean().optional(),
    ai: z
      .object({
        usageNoteVi: z.string().optional(),
        collocations: z.array(z.object({ zh: z.string(), vi: z.string() }).strict()).optional(),
        at: finite,
      })
      .strict()
      .optional(),
    createdAt: finite,
    updatedAt: finite,
  })
  .strict();

const fsrsState = z
  .object({
    stability: nonNegative,
    difficulty: nonNegative,
    learningSteps: nonNegativeInt.optional(),
    state: nonNegativeInt.optional(),
    reps: nonNegativeInt.optional(),
    lapses: nonNegativeInt.optional(),
  })
  .strict();

const card = z
  .object({
    id: nonEmpty,
    subjectType: z.enum(['word', 'char']),
    subjectId: nonEmpty,
    facet: z.enum(['read', 'listen', 'speak', 'write']),
    state: z.enum(['new', 'learning', 'review', 'relearning', 'suspended']),
    repetition: nonNegativeInt,
    easeFactor: finite.min(1).max(5),
    intervalDays: nonNegative,
    due: finite,
    lapses: nonNegativeInt,
    lastReviewedAt: finite.optional(),
    introducedDay: nonEmpty.optional(),
    fsrs: fsrsState.optional(),
    schedulerStates: z
      .object({
        sm2: z
          .object({
            repetition: nonNegativeInt,
            easeFactor: finite.min(1).max(5),
            intervalDays: nonNegative,
            due: finite,
            lapses: nonNegativeInt,
            lastReviewedAt: finite.optional(),
            fsrs: fsrsState.optional(),
          })
          .strict()
          .optional(),
        fsrs: z
          .object({
            repetition: nonNegativeInt,
            easeFactor: finite.min(1).max(5),
            intervalDays: nonNegative,
            due: finite,
            lapses: nonNegativeInt,
            lastReviewedAt: finite.optional(),
            fsrs: fsrsState.optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const hanziCharacter = z
  .object({
    id: nonEmpty,
    character: nonEmpty,
    wordIds: z.array(nonEmpty),
    pinyin: z.array(z.string()),
    meaningsVi: z.array(z.string()),
    hanViet: z.array(z.string()),
    createdAt: finite,
    updatedAt: finite,
  })
  .strict();

const snapshot = z
  .object({ repetition: nonNegativeInt, easeFactor: finite.min(1).max(5), intervalDays: nonNegative, due: finite })
  .strict();

const questionType = z.enum([
  'learn-intro',
  'mcq-hanzi-vi',
  'mcq-vi-hanzi',
  'picture',
  'match',
  'hanzi-pinyin',
  'listen-hanzi',
  'listen-meaning',
  'listen-tone',
  'pinyin-typing',
  'pinyin-dictation',
  'ime-cloze',
  'measure-word',
  'sentence-order',
  'sentence-dictation',
  'speak',
  'sentence-writing',
  'stroke-quiz',
]);

const reviewLog = z
  .object({
    id: z.number().int().positive().optional(),
    cardId: nonEmpty,
    subjectId: nonEmpty,
    facet: z.enum(['read', 'listen', 'speak', 'write']),
    questionType,
    mode: z.enum(['learn', 'review', 'retry', 'match-bonus']),
    correct: z.boolean(),
    quality: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    elapsedMs: nonNegative,
    hints: nonNegativeInt,
    replays: nonNegativeInt,
    reviewedAt: finite,
    dayKey: nonEmpty,
    before: snapshot,
    after: snapshot,
  })
  .strict();

const xpKinds = [
  'save-word',
  'learn-word',
  'review-correct',
  'review-wrong',
  'retry-correct',
  'session-complete',
  'first-tag',
  'pinyin-lesson',
  'drill-round',
  'text-read',
  'comprehension',
  'dictation',
  'speaking',
  'shadowing',
  'coach',
  'daily-goal',
] as const;

const xpMap = z.partialRecord(z.enum(xpKinds), nonNegative);
const eventMap = z.partialRecord(z.enum(xpKinds), nonNegativeInt);

const dailyStats = z
  .object({
    dayKey: nonEmpty,
    xp: nonNegative,
    learningXp: nonNegative,
    xpByKind: xpMap,
    eventsByKind: eventMap,
    answers: nonNegativeInt,
    correct: nonNegativeInt,
    newIntroduced: nonNegativeInt,
    textsRead: nonNegativeInt,
    dictations: nonNegativeInt,
    speakingAttempts: nonNegativeInt,
    drillItems: nonNegativeInt,
    coachSeconds: nonNegative,
    goalMetAt: finite.optional(),
  })
  .strict();

const comprehensionQuestion = z
  .object({
    type: z.enum(['mcq', 'short']),
    qZh: z.string(),
    qVi: z.string(),
    options: z.array(z.string()).optional(),
    answerZh: z.string(),
    answerVi: z.string(),
  })
  .strict();

const textDoc = z
  .object({
    id: nonEmpty,
    kind: z.enum(['ai-story', 'ai-dialogue', 'pasted']),
    title: nonEmpty,
    titleVi: z.string().optional(),
    level: z.number().int().min(1).max(9).optional(),
    genre: z.string().optional(),
    sentences: z.array(z.object({ zh: nonEmpty, vi: z.string().optional(), speaker: z.enum(['A', 'B']).optional() }).strict()),
    targetWordIds: z.array(z.string()),
    questions: z.array(comprehensionQuestion),
    imageUrl: z.string().optional(),
    segOverrides: z.record(z.string(), z.array(z.tuple([nonNegativeInt, nonNegativeInt]))),
    tokenCache: z.object({ segVersion: nonNegativeInt, sentences: z.array(z.unknown()) }).strict().optional(),
    progress: z
      .object({
        sentenceIndex: nonNegativeInt,
        openedAt: finite.optional(),
        completedAt: finite.optional(),
        comprehensionDone: z.array(nonNegativeInt).optional(),
      })
      .strict(),
    coverage: finite.min(0).max(1).optional(),
    createdAt: finite,
  })
  .strict();

const coachSession = z
  .object({
    id: nonEmpty,
    scenario: z.string(),
    startedAt: finite,
    endedAt: finite.optional(),
    transcript: z.array(z.object({ role: z.enum(['user', 'ai']), text: z.string(), at: finite }).strict()),
  })
  .strict();

const kv = z.object({ key: nonEmpty, value: z.unknown() }).strict();

export const backupDataSchema = z
  .object({
    words: z.array(word),
    chars: z.array(hanziCharacter),
    cards: z.array(card),
    reviewLogs: z.array(reviewLog),
    dailyStats: z.array(dailyStats),
    texts: z.array(textDoc),
    coachSessions: z.array(coachSession),
    kv: z.array(kv),
  })
  .strict();

export const backupImageSchema = z
  .object({
    ownerId: nonEmpty,
    mimeType: nonEmpty,
    base64: nonEmpty,
    bytes: nonNegativeInt,
    source: z.enum(['pixabay', 'unsplash']),
    pageUrl: nonEmpty,
    author: z.string(),
    createdAt: finite,
    expiresAt: finite,
  })
  .strict();

export const backupFileSchema = z
  .object({
    format: z.literal('hanzistep-backup'),
    schemaVersion: z.literal(3),
    appVersion: nonEmpty,
    exportedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
    includesSecrets: z.boolean(),
    data: backupDataSchema,
    images: z.array(backupImageSchema),
  })
  .strict();

export type BackupData = z.infer<typeof backupDataSchema>;
export type BackupImage = z.infer<typeof backupImageSchema>;
export type ValidatedBackupFile = z.infer<typeof backupFileSchema>;
