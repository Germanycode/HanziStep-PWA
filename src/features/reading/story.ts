import { z } from 'zod';
import { segmentSentence } from '@/chinese/segment/segment';
import { combineLexicons, type Lexicon } from '@/chinese/segment/types';
import { loadHskUpTo } from '@/data/hsk';
import type { HskTrackKey } from '@/data/types';
import { db, type HanziStepDB } from '@/db/db';
import { getSettings } from '@/db/settings';
import type { ComprehensionQuestion, TextDoc, Word } from '@/domain/types';
import { generateJson } from '@/services/ai/gemini';
import { availableSources, searchImages } from '@/services/images/providers';
import { saveImage } from '@/services/images/store';
import {
  coverageThreshold,
  MAX_ALLOWED_WORDS,
  retryPrompt,
  storyPrompt,
  storyRules,
  STORY_NAMES,
  STORY_SCHEMA,
  type StoryRules,
} from '@/services/ai/prompts/story';
import { loadDictionaryHeadwords } from './pipeline';
import { createText } from './repository';

/** Particles and pronouns a beginner text may always use. */
export const FUNCTION_WORDS = new Set([
  '的', '了', '吗', '呢', '吧', '和', '也', '都', '很', '不', '是', '有', '在', '我', '你', '他', '她', '它',
  '们', '个', '这', '那', '就', '要', '会', '能', '可以', '没', '什么', '谁', '哪', '几', '一', '二', '三',
  '四', '五', '六', '七', '八', '九', '十', '上', '下', '来', '去', '把', '被', '给', '对', '从', '到', '很多',
]);

export const generatedQuestionSchema = z
  .object({
    type: z.enum(['mcq', 'short']),
    qZh: z.string().min(1),
    qVi: z.string().min(1),
    options: z.array(z.string().min(1)).optional(),
    answerZh: z.string().min(1),
    answerVi: z.string().min(1),
  })
  .superRefine((question, context) => {
    if (question.type !== 'mcq') return;
    const options = question.options ?? [];
    if (options.length !== 4 || new Set(options.map((option) => option.trim())).size !== 4) {
      context.addIssue({ code: 'custom', message: 'Câu trắc nghiệm phải có đúng 4 lựa chọn khác nhau.', path: ['options'] });
    }
    if (!options.includes(question.answerZh) && !options.includes(question.answerVi)) {
      context.addIssue({ code: 'custom', message: 'Đáp án đúng phải nằm trong các lựa chọn.', path: ['options'] });
    }
  });

const storySchema = z.object({
  titleZh: z.string().min(1),
  titleVi: z.string().min(1),
  sentences: z.array(z.object({ zh: z.string().min(1), vi: z.string().default('') })).min(1),
  targetWords: z.array(z.object({ hanzi: z.string(), vi: z.string() })).optional(),
  names: z.array(z.string()).optional(),
  questions: z.array(generatedQuestionSchema).default([]),
  imageSearchKeywordsEn: z.string().optional(),
});

export type Story = z.infer<typeof storySchema>;

function hanCount(value: string): number {
  return [...value].filter((character) => /\p{Script=Han}/u.test(character)).length;
}

export function validateStoryRules(story: Story, rules: StoryRules): Story {
  if (story.sentences.length < rules.minSentences || story.sentences.length > rules.maxSentences) {
    throw new Error(`Bài AI phải có ${rules.minSentences}–${rules.maxSentences} câu.`);
  }
  const lengths = story.sentences.map((sentence) => hanCount(sentence.zh));
  if (lengths.some((length) => length > rules.maxSentenceChars)) {
    throw new Error(`Một câu AI vượt quá ${rules.maxSentenceChars} chữ Hán.`);
  }
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total < rules.minChars || total > rules.maxChars) {
    throw new Error(`Bài AI phải có tổng ${rules.minChars}–${rules.maxChars} chữ Hán.`);
  }
  return story;
}

export function parseStory(raw: unknown, rules?: StoryRules): Story {
  const story = storySchema.parse(raw);
  return rules ? validateStoryRules(story, rules) : story;
}

export interface CoverageResult {
  /** 1 − (word tokens outside the allowed set ÷ all word tokens). */
  coverage: number;
  outside: string[];
  contentTokens: number;
}

/** How much of a story the learner can already read (docs/PLAN.md §7.4). */
export function storyCoverage(sentences: readonly string[], lexicon: Lexicon, allowed: ReadonlySet<string>): CoverageResult {
  let content = 0;
  let unknown = 0;
  const outside = new Set<string>();
  for (const sentence of sentences) {
    for (const token of segmentSentence(sentence, lexicon)) {
      if (token.kind !== 'word') continue;
      content++;
      if (allowed.has(token.text)) continue;
      unknown++;
      outside.add(token.text);
    }
  }
  return { coverage: content === 0 ? 1 : 1 - unknown / content, outside: [...outside], contentTokens: content };
}

/** Works for anything the model returns with a `questions` array (stories and dialogues). */
export function toQuestions(source: {
  questions: readonly { type: 'mcq' | 'short'; qZh: string; qVi: string; options?: string[]; answerZh: string; answerVi: string }[];
}): ComprehensionQuestion[] {
  return source.questions.map((question) => ({
    type: question.type,
    qZh: question.qZh,
    qVi: question.qVi,
    options: question.options,
    answerZh: question.answerZh,
    answerVi: question.answerVi,
  }));
}

export interface AllowedVocabulary {
  /** Every word the model may use. */
  allowed: Set<string>;
  /** The same words as a capped, ordered list for the prompt. */
  list: string[];
  /** Dictionary plus the allowed words, for measuring coverage. */
  lexicon: Lexicon;
}

/**
 * The closed word list a generated text must stay inside: function words, the
 * fixed names, everything the learner has saved, and HSK up to the level.
 */
export async function buildAllowedVocabulary(
  track: HskTrackKey,
  level: number,
  targets: readonly Word[],
  database: HanziStepDB = db,
): Promise<AllowedVocabulary> {
  const [saved, hsk, headwords] = await Promise.all([
    database.words.toArray(),
    loadHskUpTo(track, level).catch(() => []),
    loadDictionaryHeadwords(database).catch(() => new Set<string>()),
  ]);

  const allowed = new Set<string>(FUNCTION_WORDS);
  for (const name of STORY_NAMES) allowed.add(name);
  for (const word of saved) allowed.add(word.simplified);
  for (const target of targets) allowed.add(target.simplified);
  const hskWords = hsk.map((record) => record.s);
  for (const word of hskWords) allowed.add(word);

  // HSK words come in frequency order, so the cap keeps the most useful ones.
  const list = [...new Set([...targets.map((word) => word.simplified), ...saved.map((word) => word.simplified), ...hskWords])].slice(
    0,
    MAX_ALLOWED_WORDS,
  );
  return { allowed, list, lexicon: combineLexicons(headwords, allowed) };
}

export interface GenerateStoryOptions {
  level: number;
  genre: string;
  /** Words the story must use; usually words waiting in "Học mới". */
  targets: readonly Word[];
  /** Short, fully supported text for a learner with very few words. */
  micro?: boolean;
  signal?: AbortSignal;
  database?: HanziStepDB;
}

export interface GeneratedStory {
  doc: TextDoc;
  coverage: number;
  outside: string[];
  retried: boolean;
}

/**
 * Asks Gemini for a story that only uses words the learner can read, checks the
 * coverage locally and retries once when it is too low. The text is saved either
 * way; words outside the list stay marked in the reader.
 */
export async function generateStory(options: GenerateStoryOptions): Promise<GeneratedStory> {
  const database = options.database ?? db;
  const settings = await getSettings(database);
  const rules = storyRules(options.level, options.micro);
  const targets = options.targets.slice(0, rules.maxTargets);

  const { allowed, list: allowedList, lexicon } = await buildAllowedVocabulary(settings.hskTrack, options.level, targets, database);
  const basePrompt = storyPrompt({
    level: options.level,
    rules,
    genre: options.genre,
    targets: targets.map((word) => ({ hanzi: word.simplified, vi: word.meaningVi[0] ?? '' })),
    allowed: allowedList,
    micro: Boolean(options.micro),
  });

  const request = (prompt: string) =>
    generateJson<unknown>({
      apiKey: settings.geminiApiKey,
      model: settings.geminiTextModel,
      prompt,
      schema: STORY_SCHEMA,
      temperature: 0.6,
      signal: options.signal,
      timeoutMs: 45_000,
    }).then((raw) => parseStory(raw, rules));

  let story = await request(basePrompt);
  let result = storyCoverage(
    story.sentences.map((sentence) => sentence.zh),
    lexicon,
    allowed,
  );
  let retried = false;

  if (result.coverage < coverageThreshold(options.level)) {
    retried = true;
    try {
      const second = await request(retryPrompt(basePrompt, result.outside));
      const secondResult = storyCoverage(
        second.sentences.map((sentence) => sentence.zh),
        lexicon,
        allowed,
      );
      if (secondResult.coverage > result.coverage) {
        story = second;
        result = secondResult;
      }
    } catch {
      // Keep the first story; it is still readable with the words marked.
    }
  }

  const targetIds = targets.map((word) => word.id);
  const doc = await createText(
    {
      kind: 'ai-story',
      title: story.titleZh,
      titleVi: story.titleVi,
      level: options.level,
      genre: options.genre,
      sentences: story.sentences.map((sentence) => ({ zh: sentence.zh, vi: sentence.vi })),
      targetWordIds: targetIds,
      questions: toQuestions(story),
      coverage: Math.round(result.coverage * 100) / 100,
    },
    database,
  );

  // The picture is downloaded and stored like every other image; a failure never loses the story.
  if (story.imageSearchKeywordsEn && availableSources(settings).length > 0) {
    try {
      const [picture] = await searchImages(settings, story.imageSearchKeywordsEn, options.signal);
      if (picture) {
        await saveImage(doc.id, picture, settings, database);
        await database.texts.update(doc.id, { imageUrl: picture.pageUrl });
        doc.imageUrl = picture.pageUrl;
      }
    } catch {
      // No illustration; the text is still complete.
    }
  }

  return { doc, coverage: result.coverage, outside: result.outside, retried };
}
