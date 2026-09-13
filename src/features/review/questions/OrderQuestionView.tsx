import { useEffect, useState } from 'react';
import { gradeOrder } from '@/features/review/engine/grading';
import type { OrderQuestion } from '@/features/review/engine/questions';
import { Button } from '@/ui/Button';
import type { QuestionViewProps } from '../session/types';
import { AudioPrompt } from './AudioPrompt';

/** 连词成句: put the shuffled tiles back in order. Two tries, as in docs/PLAN.md §5.3. */
export function OrderQuestionView({ question, answered, onAnswer, onPlayPrompt }: QuestionViewProps<OrderQuestion>) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(1);
  const [retryHint, setRetryHint] = useState(false);
  const listen = question.facet === 'listen';
  const complete = chosen.length === question.tiles.length;
  const textOf = (id: string) => question.tiles.find((tile) => tile.id === id)?.text ?? '';

  const check = () => {
    if (answered || !complete) return;
    const texts = chosen.map(textOf);
    const given = texts.join('');
    if (gradeOrder(texts, question.sentence.zh)) {
      onAnswer({ correct: true, given, signal: { attempts } });
      return;
    }
    if (attempts >= 2) {
      onAnswer({ correct: false, given, signal: { attempts } });
      return;
    }
    setAttempts(2);
    setRetryHint(true);
  };

  // Enter checks the answer; the page only handles Enter after the answer.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || answered || !complete) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      check();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div>
      {listen ? (
        <AudioPrompt onPlay={onPlayPrompt} label="Nghe câu" />
      ) : (
        <p className="mb-4 text-center text-sm text-muted">Sắp xếp thành câu đúng</p>
      )}

      <div
        className={`mb-4 flex min-h-16 flex-wrap items-center gap-2 rounded-xl border border-dashed p-3 ${
          retryHint && !answered ? 'border-danger' : 'border-line'
        }`}
      >
        {chosen.length === 0 && <span className="text-sm text-muted">Chạm vào các thẻ bên dưới để xếp câu</span>}
        {chosen.map((id, position) => (
          <button
            key={`${id}-${position}`}
            type="button"
            disabled={Boolean(answered)}
            onClick={() => setChosen((list) => list.filter((_, itemIndex) => itemIndex !== position))}
            className="font-hanzi rounded-lg bg-primary/15 px-3 py-2 text-lg text-fg transition hover:bg-primary/25"
          >
            {textOf(id)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {question.tiles
          .filter((tile) => !chosen.includes(tile.id))
          .map((tile) => (
            <button
              key={tile.id}
              type="button"
              disabled={Boolean(answered)}
              onClick={() => setChosen((list) => [...list, tile.id])}
              className="font-hanzi rounded-lg border border-line px-3 py-2 text-lg text-fg transition hover:border-line-hover hover:bg-surface-2"
            >
              {tile.text}
            </button>
          ))}
      </div>

      {retryHint && !answered && <p className="mt-3 text-sm text-danger">Chưa đúng thứ tự — thử lại lần cuối.</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={check} disabled={Boolean(answered) || !complete}>
          Kiểm tra
        </Button>
        <Button variant="ghost" onClick={() => setChosen([])} disabled={Boolean(answered) || chosen.length === 0}>
          Xoá hết
        </Button>
        {!listen && question.sentence.en && !answered && <span className="text-sm text-sub">{question.sentence.en}</span>}
      </div>
    </div>
  );
}
