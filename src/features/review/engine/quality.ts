import type { Quality, QuestionType } from '@/domain/types';

/** Everything the UI measured about one answer. The timer starts when the prompt is fully shown (after audio ends). */
export interface AnswerSignal {
  questionType: QuestionType;
  correct: boolean;
  elapsedMs: number;
  hints?: number;
  /** Audio replays after the automatic first play. */
  replays?: number;
  pinyinRevealed?: boolean;
  /** Typing: every syllable right but at least one tone wrong. */
  toneOnlyError?: boolean;
  /** Sentence ordering tries, speaking tries, or stroke mistakes. */
  attempts?: number;
  /** Dictation character accuracy, 0–1. */
  accuracy?: number;
  /** AI grade, 0–1. */
  score?: number;
  /** Tones ignored (easy mode). */
  easyMode?: boolean;
}

function capAt(quality: Quality, max: Quality): Quality {
  return quality > max ? max : quality;
}

function byTime(elapsedMs: number, fastMs: number, mediumMs: number): Quality {
  if (elapsedMs < fastMs) return 5;
  if (elapsedMs < mediumMs) return 4;
  return 3;
}

/** Quality per question type (docs/PLAN.md §5.3). */
export function qualityFor(signal: AnswerSignal): Quality {
  const hints = signal.hints ?? 0;
  const replays = signal.replays ?? 0;

  switch (signal.questionType) {
    case 'learn-intro':
    case 'mcq-hanzi-vi':
    case 'mcq-vi-hanzi':
    case 'picture':
    case 'hanzi-pinyin': {
      if (!signal.correct) return 0;
      const quality = byTime(signal.elapsedMs, 3000, 8000);
      return signal.pinyinRevealed ? capAt(quality, 4) : quality;
    }

    case 'listen-hanzi':
    case 'listen-meaning':
    case 'listen-tone': {
      if (!signal.correct) return 0;
      let quality: Quality = signal.elapsedMs < 4000 && replays <= 1 ? 5 : signal.elapsedMs < 10_000 ? 4 : 3;
      if (replays > 2) quality = capAt(quality, 3);
      return quality;
    }

    case 'match':
      return signal.correct ? 4 : 0;

    case 'pinyin-typing':
    case 'pinyin-dictation': {
      if (!signal.correct) return signal.toneOnlyError ? 2 : 0;
      const quality: Quality = hints > 0 ? 3 : byTime(signal.elapsedMs, 6000, 15_000);
      return signal.easyMode ? capAt(quality, 3) : quality;
    }

    case 'ime-cloze':
      if (!signal.correct) return 0;
      return hints > 0 ? 3 : byTime(signal.elapsedMs, 8000, 20_000);

    case 'measure-word':
      return signal.correct ? byTime(signal.elapsedMs, 4000, 10_000) : 0;

    case 'sentence-order': {
      const attempts = signal.attempts ?? 1;
      if (!signal.correct || attempts > 2) return 0;
      if (attempts === 2) return 3;
      return signal.elapsedMs < 10_000 ? 5 : 4;
    }

    case 'sentence-dictation': {
      const accuracy = signal.accuracy ?? (signal.correct ? 1 : 0);
      if (accuracy < 0.9) return 1;
      if (accuracy < 1) return 3;
      return replays <= 2 ? 5 : 4;
    }

    case 'speak':
      if (!signal.correct) return 1;
      return (signal.attempts ?? 1) > 1 ? 3 : 4;

    case 'sentence-writing': {
      const score = signal.score ?? (signal.correct ? 1 : 0);
      if (score < 0.6) return 0;
      return score >= 0.9 ? 4 : 3;
    }

    case 'stroke-quiz': {
      if (!signal.correct) return 0;
      if (hints > 0) return 3;
      const mistakes = signal.attempts ?? 0;
      return mistakes === 0 ? 5 : mistakes <= 2 ? 4 : 3;
    }
  }
}
