import type { Facet, QuestionType } from '@/domain/types';
import type { Rng } from '@/lib/random';

export interface QuestionTypeContext {
  facet: Facet;
  repetition: number;
  /** A real image is stored for the word. */
  hasImage: boolean;
  /** Concrete noun or verb (pictures make sense). */
  isConcrete: boolean;
  /** Learned words available for a 4-pair matching question (the target included). */
  learnedWordCount: number;
  /** Noun with a known measure word. */
  hasClassifier: boolean;
  /** An example sentence containing the word is available. */
  hasExample: boolean;
  geminiAvailable: boolean;
}

function mcq(rng: Rng): QuestionType {
  return rng() < 0.5 ? 'mcq-hanzi-vi' : 'mcq-vi-hanzi';
}

/** Listening facet: audio → word, meaning, tones, then typing. */
function selectListen(context: QuestionTypeContext, rng: Rng): QuestionType {
  const { repetition } = context;
  if (repetition <= 0) return 'listen-hanzi';
  if (repetition === 1) return 'listen-meaning';
  if (repetition === 2) return 'listen-tone';
  if (repetition === 3 || !context.hasExample) return 'pinyin-dictation';
  return rng() < 0.5 ? 'sentence-order' : 'sentence-dictation';
}

/**
 * Question type by facet and repetition (docs/PLAN.md §5.4). Missing
 * resources fall through to the next option and finally to multiple choice,
 * as in the English extension's `renderNextQuestion`.
 */
export function selectQuestionType(context: QuestionTypeContext, rng: Rng): QuestionType {
  // Speaking always asks the learner to say the word; only the prompt changes with repetition.
  if (context.facet === 'speak') return 'speak';
  if (context.facet === 'listen') return selectListen(context, rng);

  const { repetition } = context;
  if (repetition <= 0) return mcq(rng);
  if (repetition === 1) return context.hasImage && context.isConcrete ? 'picture' : mcq(rng);
  if (repetition === 2) return rng() < 0.5 && context.learnedWordCount >= 4 ? 'match' : 'hanzi-pinyin';

  if (repetition === 3) {
    if (rng() < 0.6) return 'pinyin-typing';
    if (context.hasClassifier) return 'measure-word';
    if (context.hasExample) return 'sentence-order';
    return mcq(rng);
  }

  const roll = rng();
  if (roll < 0.4) return context.hasExample ? 'ime-cloze' : 'pinyin-typing';
  if (roll < 0.7) {
    if (context.hasExample) return 'sentence-order';
    return context.hasClassifier ? 'measure-word' : 'pinyin-typing';
  }
  return context.geminiAvailable ? 'sentence-writing' : 'pinyin-typing';
}
