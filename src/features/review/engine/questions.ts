import { toNumbered } from '@/chinese/pinyin/marks';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { acceptedReadings } from '@/chinese/pinyin/sandhi';
import type { PinyinTone, Syllable } from '@/chinese/pinyin/types';
import { containsWordToken, sentenceTiles } from '@/chinese/text';
import type { SentenceRecord } from '@/data/types';
import type { Facet, QuestionType, Word } from '@/domain/types';
import { shuffle, type Rng } from '@/lib/random';
import {
  classifierDistractors,
  glossesOverlap,
  hanziDistractors,
  meaningDistractors,
  pinyinDistractors,
  soundAlikeDistractors,
  tonePatternDistractors,
  type DistractorCandidate,
} from './distractors';
import { selectQuestionType, type QuestionTypeContext } from './selectQuestionType';

export type ChoicePrompt = 'hanzi' | 'meaning' | 'image' | 'audio' | 'classifier';
export type OptionKind = 'meaning' | 'hanzi' | 'pinyin' | 'classifier';
/** What Space plays before the answer: the word, the example sentence, or nothing (it would give the answer away). */
export type PromptAudio = 'word' | 'sentence' | 'none';

export interface QuestionOption {
  id: string;
  /** Meaning text, characters, numbered pinyin or a measure word. */
  value: string;
  /** Hanzi options: their pinyin. */
  pinyinNum?: string;
}

/** An example sentence split around the target word. */
export interface Cloze {
  sentence: SentenceRecord;
  before: string;
  after: string;
}

interface QuestionBase {
  word: Word;
  facet: Facet;
  autoPlay: boolean;
  promptAudio: PromptAudio;
  /** P shows hidden pinyin (and caps the quality, or counts as a hint). */
  canRevealPinyin: boolean;
}

export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice';
  type: 'mcq-hanzi-vi' | 'mcq-vi-hanzi' | 'picture' | 'hanzi-pinyin' | 'listen-hanzi' | 'listen-meaning' | 'listen-tone' | 'measure-word';
  prompt: ChoicePrompt;
  optionKind: OptionKind;
  options: QuestionOption[];
  answerId: string;
  /** Pinyin visible from the start. */
  showPinyin: boolean;
}

export interface PinyinQuestion extends QuestionBase {
  kind: 'pinyin';
  type: 'pinyin-typing' | 'pinyin-dictation';
  /** Numbered readings, citation first. */
  accepted: string[];
  cloze?: Cloze;
}

export interface ImeClozeQuestion extends QuestionBase {
  kind: 'ime-cloze';
  type: 'ime-cloze';
  cloze: Cloze;
  answers: string[];
}

export interface OrderQuestion extends QuestionBase {
  kind: 'order';
  type: 'sentence-order';
  sentence: SentenceRecord;
  /** Shuffled tiles; ids are the original positions. */
  tiles: { id: string; text: string }[];
}

export interface DictationQuestion extends QuestionBase {
  kind: 'dictation';
  type: 'sentence-dictation';
  sentence: SentenceRecord;
}

export interface MatchPair {
  wordId: string;
  hanzi: string;
  pinyinNum: string;
  meaning: string;
}

export interface MatchQuestion extends QuestionBase {
  kind: 'match';
  type: 'match';
  /** Left column (characters), shuffled. */
  pairs: MatchPair[];
  /** Right column (meanings) as word ids, shuffled separately. */
  meaningOrder: string[];
}

export interface WritingQuestion extends QuestionBase {
  kind: 'writing';
  type: 'sentence-writing';
  example?: SentenceRecord;
}

/** What the learner is given before they speak (docs/PLAN.md §5.4, speak column). */
export type SpeakMode = 'echo' | 'from-meaning' | 'from-hanzi' | 'sentence';

export interface SpeakQuestion extends QuestionBase {
  kind: 'speak';
  type: 'speak';
  mode: SpeakMode;
  /** The sentence to say, from repetition 3 on. */
  sentence?: SentenceRecord;
}

export type Question =
  | ChoiceQuestion
  | PinyinQuestion
  | ImeClozeQuestion
  | OrderQuestion
  | DictationQuestion
  | MatchQuestion
  | WritingQuestion
  | SpeakQuestion;

export interface QuestionResources {
  /** Distractor candidates: saved words and HSK list words. */
  pool: readonly DistractorCandidate[];
  /** Other learned words for matching, most useful first (due later in this session). */
  matchWords: readonly Word[];
  /** Example sentences that use the word, shortest first. */
  examples: readonly SentenceRecord[];
  hasImage: boolean;
  geminiAvailable: boolean;
  /** A Chinese voice can read whole sentences. */
  sentenceAudio: boolean;
  hskLevel?: number;
}

export interface QuestionRequest {
  word: Word;
  facet: Facet;
  repetition: number;
  /** Mistake rounds use recognition questions only. */
  retry?: boolean;
  /** Skips selection (tests, or replacing a question whose AI grading failed). */
  forceType?: QuestionType;
}

const CONCRETE_POS = new Set(['n', 'v', 'vn']);
const MIN_TILES = 3;
const MAX_TILES = 12;

function candidateOf(word: Word, hskLevel?: number): DistractorCandidate {
  return { id: word.id, simplified: word.simplified, pinyinNum: word.pinyinNum, meaningVi: word.meaningVi, pos: word.pos, hskLevel };
}

/** Citation syllables and every accepted numbered reading (sandhi forms and stored variants). */
export function wordReadings(word: Word): { syllables: Syllable[]; accepted: string[] } | null {
  const parsed = parsePinyin(word.pinyinNum);
  if (parsed.errors.length > 0 || parsed.syllables.length === 0) return null;
  const accepted = new Set(acceptedReadings(parsed.syllables, word.simplified).map((reading) => toNumbered(reading)));
  for (const variant of word.pinyinVariants) {
    const result = parsePinyin(variant);
    if (result.errors.length === 0 && result.syllables.length > 0) accepted.add(toNumbered(result.syllables));
  }
  return { syllables: parsed.syllables, accepted: [...accepted] };
}

/** Blanks the word in the first example that uses it exactly once (whole words preferred). */
export function findCloze(examples: readonly SentenceRecord[], word: string): Cloze | null {
  const usable = examples.filter((sentence) => {
    const first = sentence.zh.indexOf(word);
    return first >= 0 && sentence.zh.indexOf(word, first + word.length) < 0;
  });
  const sentence = usable.find((item) => containsWordToken(item.zh, word)) ?? usable[0];
  if (!sentence) return null;
  const index = sentence.zh.indexOf(word);
  return { sentence, before: sentence.zh.slice(0, index), after: sentence.zh.slice(index + word.length) };
}

export function questionContext(request: QuestionRequest, resources: QuestionResources): QuestionTypeContext {
  const { word, facet } = request;
  const hasSentence = resources.examples.length > 0;
  return {
    facet,
    repetition: request.repetition,
    hasImage: resources.hasImage,
    isConcrete: word.pos.some((pos) => CONCRETE_POS.has(pos)),
    learnedWordCount: resources.matchWords.length + 1,
    hasClassifier: word.classifiers.length > 0,
    hasExample: facet === 'listen' ? hasSentence && resources.sentenceAudio : hasSentence,
    geminiAvailable: resources.geminiAvailable,
  };
}

/** Next options when a question type cannot be built; ends with plain recognition questions. */
export function fallbackChain(type: QuestionType, facet: Facet): QuestionType[] {
  // Speaking has one question type; multiple choice only guards against a broken call.
  if (facet === 'speak') return [...new Set<QuestionType>([type, 'speak', 'mcq-hanzi-vi'])];
  const listen = facet === 'listen';
  const chain: QuestionType[] = [type];
  switch (type) {
    case 'picture':
      chain.push('mcq-vi-hanzi');
      break;
    case 'match':
      chain.push('hanzi-pinyin');
      break;
    case 'measure-word':
      chain.push('sentence-order', 'pinyin-typing');
      break;
    case 'sentence-order':
      chain.push(...(listen ? (['sentence-dictation', 'pinyin-dictation'] as const) : (['measure-word', 'pinyin-typing'] as const)));
      break;
    case 'ime-cloze':
    case 'sentence-writing':
      chain.push('pinyin-typing');
      break;
    case 'sentence-dictation':
      chain.push('sentence-order', 'pinyin-dictation');
      break;
    case 'pinyin-dictation':
      chain.push('listen-tone');
      break;
    default:
      break;
  }
  chain.push(...(listen ? (['listen-hanzi', 'listen-meaning'] as const) : (['hanzi-pinyin', 'mcq-hanzi-vi', 'mcq-vi-hanzi'] as const)));
  return [...new Set(chain)];
}

interface BuildArgs {
  request: QuestionRequest;
  resources: QuestionResources;
  rng: Rng;
  /** Fewest distractors a choice question may have. */
  minDistractors: number;
}

function base(request: QuestionRequest, fields: Pick<QuestionBase, 'autoPlay' | 'promptAudio' | 'canRevealPinyin'>) {
  return { word: request.word, facet: request.facet, ...fields };
}

function meaningChoice(
  { request, resources, rng, minDistractors }: BuildArgs,
  type: 'mcq-hanzi-vi' | 'listen-meaning',
): ChoiceQuestion | null {
  const target = candidateOf(request.word, resources.hskLevel);
  if (target.meaningVi.length === 0) return null;
  const distractors = meaningDistractors(target, resources.pool, 3, rng);
  if (distractors.length < minDistractors) return null;
  const listen = type === 'listen-meaning';
  const rep0 = request.repetition <= 0;
  return {
    ...base(request, { autoPlay: listen || rep0, promptAudio: 'word', canRevealPinyin: !listen && !rep0 }),
    kind: 'choice',
    type,
    prompt: listen ? 'audio' : 'hanzi',
    optionKind: 'meaning',
    options: shuffle([target, ...distractors], rng).map((item) => ({ id: item.id, value: item.meaningVi[0] ?? '' })),
    answerId: target.id,
    showPinyin: !listen && rep0,
  };
}

function hanziChoice({ request, resources, rng, minDistractors }: BuildArgs, type: 'mcq-vi-hanzi' | 'picture' | 'listen-hanzi'): ChoiceQuestion | null {
  if (type === 'picture' && !resources.hasImage) return null;
  const target = candidateOf(request.word, resources.hskLevel);
  const listen = type === 'listen-hanzi';
  const distractors = listen
    ? soundAlikeDistractors(target, resources.pool, 3, rng)
    : hanziDistractors(target, resources.pool, 3, rng);
  if (distractors.length < minDistractors) return null;
  const rep0 = request.repetition <= 0;
  const showPinyin = listen || (type === 'mcq-vi-hanzi' && rep0);
  return {
    ...base(request, {
      autoPlay: listen || (type === 'mcq-vi-hanzi' && rep0),
      promptAudio: listen || showPinyin ? 'word' : 'none',
      canRevealPinyin: !showPinyin,
    }),
    kind: 'choice',
    type,
    prompt: listen ? 'audio' : type === 'picture' ? 'image' : 'meaning',
    optionKind: 'hanzi',
    options: shuffle([target, ...distractors], rng).map((item) => ({ id: item.id, value: item.simplified, pinyinNum: item.pinyinNum })),
    answerId: target.id,
    showPinyin,
  };
}

function pinyinChoice({ request, rng, minDistractors }: BuildArgs, type: 'hanzi-pinyin' | 'listen-tone'): ChoiceQuestion | null {
  const readings = wordReadings(request.word);
  if (!readings) return null;
  const answer = toNumbered(readings.syllables);
  let distractors: string[];
  if (type === 'hanzi-pinyin') {
    distractors = pinyinDistractors(readings.syllables, readings.accepted, 3, rng);
  } else {
    const accepted = new Set(readings.accepted.map((reading) => reading.toLowerCase()));
    distractors = tonePatternDistractors(readings.syllables, 12, rng)
      .map((pattern) => {
        const tones = pattern.split('-').map(Number);
        return toNumbered(readings.syllables.map((syllable, index) => ({ ...syllable, tone: (tones[index] ?? syllable.tone) as PinyinTone })));
      })
      .filter((option) => !accepted.has(option.toLowerCase()))
      .slice(0, 3);
  }
  if (distractors.length < minDistractors) return null;
  const listen = type === 'listen-tone';
  return {
    ...base(request, { autoPlay: listen, promptAudio: listen ? 'word' : 'none', canRevealPinyin: false }),
    kind: 'choice',
    type,
    prompt: listen ? 'audio' : 'hanzi',
    optionKind: 'pinyin',
    options: shuffle([answer, ...distractors], rng).map((value) => ({ id: value, value })),
    answerId: answer,
    showPinyin: false,
  };
}

function measureWordChoice({ request, rng, minDistractors }: BuildArgs): ChoiceQuestion | null {
  const answer = request.word.classifiers[0];
  if (!answer) return null;
  const distractors = classifierDistractors(request.word.classifiers, 3, rng);
  if (distractors.length < minDistractors) return null;
  return {
    ...base(request, { autoPlay: false, promptAudio: 'word', canRevealPinyin: true }),
    kind: 'choice',
    type: 'measure-word',
    prompt: 'classifier',
    optionKind: 'classifier',
    options: shuffle([answer, ...distractors], rng).map((value) => ({ id: value, value })),
    answerId: answer,
    showPinyin: false,
  };
}

function pinyinTyping({ request, resources }: BuildArgs, type: 'pinyin-typing' | 'pinyin-dictation'): PinyinQuestion | null {
  const readings = wordReadings(request.word);
  if (!readings) return null;
  const dictation = type === 'pinyin-dictation';
  return {
    ...base(request, { autoPlay: dictation, promptAudio: dictation ? 'word' : 'none', canRevealPinyin: false }),
    kind: 'pinyin',
    type,
    accepted: readings.accepted,
    cloze: dictation ? undefined : (findCloze(resources.examples, request.word.simplified) ?? undefined),
  };
}

function imeCloze({ request, resources }: BuildArgs): ImeClozeQuestion | null {
  const cloze = findCloze(resources.examples, request.word.simplified);
  if (!cloze) return null;
  const answers = [request.word.simplified];
  if (request.word.traditional) answers.push(request.word.traditional);
  return {
    ...base(request, { autoPlay: false, promptAudio: 'none', canRevealPinyin: true }),
    kind: 'ime-cloze',
    type: 'ime-cloze',
    cloze,
    answers,
  };
}

function sentenceOrder({ request, resources, rng }: BuildArgs): OrderQuestion | null {
  const listen = request.facet === 'listen';
  if (listen && !resources.sentenceAudio) return null;
  for (const sentence of resources.examples) {
    const texts = sentenceTiles(sentence.zh);
    if (texts.length < MIN_TILES || texts.length > MAX_TILES) continue;
    const tiles = texts.map((text, index) => ({ id: String(index), text }));
    const inOrder = texts.join('');
    let shuffled = shuffle(tiles, rng);
    for (let attempt = 0; attempt < 6 && shuffled.map((tile) => tile.text).join('') === inOrder; attempt++) {
      shuffled = shuffle(tiles, rng);
    }
    return {
      ...base(request, { autoPlay: listen, promptAudio: listen ? 'sentence' : 'none', canRevealPinyin: false }),
      kind: 'order',
      type: 'sentence-order',
      sentence,
      tiles: shuffled,
    };
  }
  return null;
}

function sentenceDictation({ request, resources }: BuildArgs): DictationQuestion | null {
  const sentence = resources.examples[0];
  if (!sentence || !resources.sentenceAudio) return null;
  return {
    ...base(request, { autoPlay: true, promptAudio: 'sentence', canRevealPinyin: false }),
    kind: 'dictation',
    type: 'sentence-dictation',
    sentence,
  };
}

function matching({ request, resources, rng }: BuildArgs): MatchQuestion | null {
  const { word } = request;
  if (!word.meaningVi[0]) return null;
  const chosen: Word[] = [word];
  for (const other of resources.matchWords) {
    if (chosen.length >= 4) break;
    if (!other.meaningVi[0] || other.id === word.id) continue;
    if (chosen.some((item) => item.simplified === other.simplified || glossesOverlap(item.meaningVi, other.meaningVi))) continue;
    chosen.push(other);
  }
  if (chosen.length < 4) return null;
  const pairs = shuffle(
    chosen.map((item) => ({ wordId: item.id, hanzi: item.simplified, pinyinNum: item.pinyinNum, meaning: item.meaningVi[0] ?? '' })),
    rng,
  );
  return {
    ...base(request, { autoPlay: false, promptAudio: 'none', canRevealPinyin: true }),
    kind: 'match',
    type: 'match',
    pairs,
    meaningOrder: shuffle(
      pairs.map((pair) => pair.wordId),
      rng,
    ),
  };
}

function writing({ request, resources }: BuildArgs): WritingQuestion | null {
  if (!resources.geminiAvailable) return null;
  return {
    ...base(request, { autoPlay: false, promptAudio: 'word', canRevealPinyin: false }),
    kind: 'writing',
    type: 'sentence-writing',
    example: resources.examples[0],
  };
}

function speaking({ request, resources }: BuildArgs): SpeakQuestion {
  const { repetition } = request;
  const sentence = resources.examples[0];
  const mode: SpeakMode =
    repetition <= 0 ? 'echo' : repetition === 1 ? 'from-meaning' : repetition === 2 ? 'from-hanzi' : sentence ? 'sentence' : 'from-hanzi';
  return {
    ...base(request, { autoPlay: mode === 'echo', promptAudio: 'word', canRevealPinyin: mode !== 'echo' }),
    kind: 'speak',
    type: 'speak',
    mode,
    sentence: mode === 'sentence' ? sentence : undefined,
  };
}

function buildOfType(type: QuestionType, args: BuildArgs): Question | null {
  switch (type) {
    case 'mcq-hanzi-vi':
    case 'listen-meaning':
      return meaningChoice(args, type);
    case 'mcq-vi-hanzi':
    case 'picture':
    case 'listen-hanzi':
      return hanziChoice(args, type);
    case 'hanzi-pinyin':
    case 'listen-tone':
      return pinyinChoice(args, type);
    case 'measure-word':
      return measureWordChoice(args);
    case 'pinyin-typing':
    case 'pinyin-dictation':
      return pinyinTyping(args, type);
    case 'ime-cloze':
      return imeCloze(args);
    case 'sentence-order':
      return sentenceOrder(args);
    case 'sentence-dictation':
      return sentenceDictation(args);
    case 'match':
      return matching(args);
    case 'sentence-writing':
      return writing(args);
    case 'speak':
      return speaking(args);
    case 'learn-intro':
    case 'stroke-quiz':
      return null;
  }
}

function retryType(facet: Facet, rng: Rng): QuestionType {
  if (facet === 'listen') return 'listen-hanzi';
  return rng() < 0.5 ? 'mcq-hanzi-vi' : 'mcq-vi-hanzi';
}

/**
 * Picks the question type for a card (docs/PLAN.md §5.4) and builds it,
 * falling back when a resource is missing (no image, too few learned words,
 * no example sentence, no voice or no Gemini key).
 */
export function buildQuestion(request: QuestionRequest, resources: QuestionResources, rng: Rng): Question {
  const primary =
    request.forceType ?? (request.retry ? retryType(request.facet, rng) : selectQuestionType(questionContext(request, resources), rng));
  for (const type of fallbackChain(primary, request.facet)) {
    const question = buildOfType(type, { request, resources, rng, minDistractors: 2 });
    if (question) return question;
  }
  // Tiny pools (no data pack): accept whatever distractors exist.
  const lastResort = request.facet === 'listen' ? 'listen-meaning' : 'mcq-hanzi-vi';
  return meaningChoice({ request, resources, rng, minDistractors: 0 }, lastResort) ?? {
    ...base(request, { autoPlay: false, promptAudio: 'none', canRevealPinyin: false }),
    kind: 'pinyin',
    type: 'pinyin-typing',
    accepted: [request.word.pinyinNum],
  };
}
