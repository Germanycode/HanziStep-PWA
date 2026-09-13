import { useState } from 'react';
import type { MatchQuestion } from '@/features/review/engine/questions';
import { PinyinText } from '@/ui/PinyinText';
import type { QuestionViewProps } from '../session/types';

/**
 * Four pairs of characters and meanings. Other due words matched here count as
 * their own review (docs/PLAN.md §5.7), so mistakes are tracked per word.
 */
export function MatchQuestionView({ question, answered, pinyinRevealed, onAnswer }: QuestionViewProps<MatchQuestion>) {
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const meaningOf = (wordId: string) => question.pairs.find((pair) => pair.wordId === wordId)?.meaning ?? '';

  const pickMeaning = (wordId: string) => {
    if (answered || !selected || matched.includes(wordId)) return;
    if (wordId === selected) {
      const nextMatched = [...matched, wordId];
      setMatched(nextMatched);
      setSelected(null);
      if (nextMatched.length < question.pairs.length) return;
      const wrongIds = [...new Set(mistakes)];
      onAnswer({
        correct: !wrongIds.includes(question.word.id),
        matchCorrect: question.pairs.map((pair) => pair.wordId).filter((id) => !wrongIds.includes(id)),
        matchMistakes: wrongIds,
        given: `${question.pairs.length - wrongIds.length}/${question.pairs.length} cặp đúng`,
      });
      return;
    }
    setMistakes((list) => [...list, selected, wordId]);
    setFlash(wordId);
    setTimeout(() => setFlash(null), 400);
    setSelected(null);
  };

  const leftClass = (wordId: string) => {
    if (matched.includes(wordId)) return 'border-success bg-success/15 text-muted';
    if (selected === wordId) return 'border-primary bg-primary/15';
    return 'border-line hover:border-line-hover hover:bg-surface-2';
  };

  return (
    <div>
      <p className="mb-4 text-center text-sm text-muted">Nối chữ Hán với nghĩa đúng</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {question.pairs.map((pair) => (
            <button
              key={pair.wordId}
              type="button"
              disabled={Boolean(answered) || matched.includes(pair.wordId)}
              onClick={() => setSelected(pair.wordId)}
              className={`flex w-full flex-col items-start rounded-xl border px-3 py-2 text-left transition ${leftClass(pair.wordId)}`}
            >
              <span className="font-hanzi text-2xl text-fg">{pair.hanzi}</span>
              {(pinyinRevealed || Boolean(answered)) && <PinyinText pinyin={pair.pinyinNum} className="text-xs" />}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {question.meaningOrder.map((wordId) => (
            <button
              key={wordId}
              type="button"
              disabled={Boolean(answered) || matched.includes(wordId)}
              onClick={() => pickMeaning(wordId)}
              className={`flex min-h-12 w-full items-center rounded-xl border px-3 py-2 text-left text-fg transition ${
                matched.includes(wordId)
                  ? 'border-success bg-success/15 text-muted'
                  : flash === wordId
                    ? 'border-danger bg-danger/15'
                    : 'border-line hover:border-line-hover hover:bg-surface-2'
              }`}
              lang="vi"
            >
              {meaningOf(wordId)}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-sub">
        Đã nối {matched.length}/{question.pairs.length}
        {mistakes.length > 0 && ` · ${mistakes.length / 2} lần sai`}
      </p>
    </div>
  );
}
