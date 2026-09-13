import type { AnswerSignal } from '../engine/quality';
import type { Question } from '../engine/questions';

export interface AnswerOutcome {
  correct: boolean;
  /** Extra measurements for `qualityFor` (accuracy, attempts, tone-only mistakes…). */
  signal?: Partial<AnswerSignal>;
  /** What the learner answered, shown in the panel. */
  given?: string;
  /** Matching: words paired correctly, and words involved in a wrong pair. */
  matchCorrect?: string[];
  matchMistakes?: string[];
  /** AI feedback for written sentences. */
  feedback?: string;
}

export interface QuestionViewProps<Q extends Question = Question> {
  question: Q;
  /** Set once answered; the view then shows the right answer and stops accepting input. */
  answered: AnswerOutcome | null;
  hints: number;
  pinyinRevealed: boolean;
  onHint: () => void;
  onAnswer: (outcome: AnswerOutcome) => void;
  /** Plays the prompt again (the page counts replays). */
  onPlayPrompt: (slow?: boolean) => void;
  /** Asks the page for another question type (AI grading unavailable). */
  onFallback?: () => void;
}
