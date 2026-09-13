import { PartyPopper } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { formatClock, formatTimeLeft } from '@/lib/time';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';

interface SessionDoneProps {
  answers: number;
  correct: number;
  xp: number;
  startedAt: number;
  wrongCount: number;
  nextDueAt: number | null;
  onRetry: () => void;
  onContinue: () => void;
}

/** All Done: session numbers, the mistake round and a countdown to the next card. */
export function SessionDone({ answers, correct, xp, startedAt, wrongCount, nextDueAt, onRetry, onContinue }: SessionDoneProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const accuracy = answers > 0 ? Math.round((correct / answers) * 100) : 0;
  const waitMs = nextDueAt === null ? null : nextDueAt - now;
  const readyNow = waitMs !== null && waitMs <= 0;

  return (
    <Card>
      <div className="py-6 text-center">
        <PartyPopper className="mx-auto size-12 text-primary" aria-hidden />
        <h2 className="mt-3 text-2xl font-bold text-fg">Hết thẻ đến hạn!</h2>
        <p className="mt-4 text-5xl font-bold text-primary" data-testid="session-score">
          {correct}/{answers}
        </p>
        <p className="mt-2 text-sub">
          Chính xác {accuracy}% · {formatClock(now - startedAt)} · {xp > 0 ? `+${xp} XP` : 'Đã đạt giới hạn XP hôm nay'}
        </p>

        {waitMs !== null && (
          <p className="mt-4 text-sm text-sub" data-testid="next-due">
            {readyNow ? 'Đã có thẻ mới đến hạn.' : `Thẻ tiếp theo đến hạn sau ${formatTimeLeft(waitMs)}.`}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {wrongCount > 0 && <Button onClick={onRetry}>Ôn lại {wrongCount} câu sai</Button>}
          {readyNow && (
            <Button variant={wrongCount > 0 ? 'outline' : 'primary'} onClick={onContinue}>
              Ôn tiếp
            </Button>
          )}
          <Link
            to="/learn"
            className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm text-fg transition hover:bg-surface-2"
          >
            Học từ mới
          </Link>
          <Link to="/" className="inline-flex h-10 items-center rounded-full px-4 text-sm text-sub transition hover:text-fg">
            Về trang Hôm nay
          </Link>
        </div>
      </div>
    </Card>
  );
}
