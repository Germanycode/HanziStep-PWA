import { Check, X } from 'lucide-react';
import { pinyinToMarks } from '@/chinese/pinyin';
import type { AnswerCardResult } from '@/features/review/engine/answerCard';
import type { Question } from '@/features/review/engine/questions';
import { intervalLabel, masteryLabel } from '@/srs/cards';
import { AudioButton } from '@/ui/AudioButton';
import { Button } from '@/ui/Button';
import { PinyinText } from '@/ui/PinyinText';
import type { AnswerOutcome } from './session/types';

function correctAnswerText(question: Question): string {
  switch (question.kind) {
    case 'choice':
      return question.options.find((option) => option.id === question.answerId)?.value ?? '';
    case 'pinyin':
      return pinyinToMarks(question.accepted[0] ?? question.word.pinyinNum);
    case 'ime-cloze':
      return question.word.simplified;
    case 'order':
    case 'dictation':
      return question.sentence.zh;
    default:
      return '';
  }
}

interface AnswerFeedbackProps {
  question: Question;
  outcome: AnswerOutcome;
  result: AnswerCardResult | null;
  mode: 'review' | 'retry';
  isLast: boolean;
  /** The answer is still being written; advancing now would lose it. */
  saving: boolean;
  onNext: () => void;
  onPlayWord: () => Promise<void>;
}

/** Panel shown after every answer: what was right, the word, and the new schedule. */
export function AnswerFeedback({ question, outcome, result, mode, isLast, saving, onNext, onPlayWord }: AnswerFeedbackProps) {
  const { word } = question;
  const answer = correctAnswerText(question);
  const xp = result?.activity?.xpAwarded ?? 0;

  return (
    <div
      role="status"
      className={`mt-6 rounded-xl p-4 ${outcome.correct ? 'bg-success/10' : 'bg-danger/10'}`}
      data-testid="answer-feedback"
    >
      <p className={`flex items-center gap-2 font-semibold ${outcome.correct ? 'text-success' : 'text-danger'}`}>
        {outcome.correct ? <Check className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />}
        {outcome.correct ? 'Chính xác!' : 'Chưa đúng'}
      </p>

      {!outcome.correct && outcome.given && (
        <p className="mt-1 text-sm text-sub">
          Bạn trả lời: <span className="text-fg">{outcome.given}</span>
        </p>
      )}
      {answer && !outcome.correct && (
        <p className="mt-1 text-sm text-sub">
          Đáp án: <span className="font-hanzi text-fg">{answer}</span>
        </p>
      )}
      {outcome.feedback && <p className="mt-2 text-sm text-fg">{outcome.feedback}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/60 pt-3">
        <span className="font-hanzi text-3xl text-fg">{word.simplified}</span>
        <PinyinText pinyin={word.pinyinNum} className="text-lg" />
        <AudioButton label="Nghe lại từ" onPlay={onPlayWord} className="text-sub" />
        {word.hanViet && <span className="text-sm font-semibold text-accent">{word.hanViet}</span>}
        <span className="min-w-40 flex-1 text-sm text-sub" lang="vi">
          {word.meaningVi.slice(0, 2).join('; ')}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-sub">
          {mode === 'retry'
            ? 'Ôn lại câu sai — không đổi lịch.'
            : result
              ? `${masteryLabel(result.log.before.repetition)} → ${masteryLabel(result.card.repetition)} · ôn lại sau ${intervalLabel(result.card.intervalDays)}${xp > 0 ? ` · +${xp} XP` : ''}`
              : 'Đang lưu…'}
        </p>
        <Button onClick={onNext} autoFocus disabled={saving}>
          {saving ? 'Đang lưu…' : isLast ? 'Xem kết quả' : 'Tiếp theo'}
          {!saving && <kbd className="ml-1 text-xs opacity-70">Enter</kbd>}
        </Button>
      </div>
    </div>
  );
}
