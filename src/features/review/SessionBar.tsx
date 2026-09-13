import { useEffect, useState } from 'react';
import { formatClock } from '@/lib/time';
import { Button } from '@/ui/Button';

interface SessionBarProps {
  index: number;
  total: number;
  correct: number;
  answers: number;
  startedAt: number;
  retry: boolean;
  onStop: () => void;
}

/** Progress, accuracy and clock above the current question. */
export function SessionBar({ index, total, correct, answers, startedAt, retry, onStop }: SessionBarProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const accuracy = answers > 0 ? Math.round((correct / answers) * 100) : 100;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-sub">
        <span data-testid="review-progress">
          {retry && <span className="mr-2 rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning">Ôn lại câu sai</span>}
          Câu {Math.min(index + 1, total)}/{total}
        </span>
        <span>
          Đúng {correct}/{answers} · {accuracy}% · {formatClock(now - startedAt)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${total > 0 ? (index / total) * 100 : 0}%` }} />
        </div>
        <Button variant="ghost" size="sm" onClick={onStop}>
          Kết thúc sớm
        </Button>
      </div>
    </div>
  );
}
