import { Eye, EyeOff, Shuffle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useSettings } from '@/db/settings';
import { previewBacklogSpread, spreadBacklog } from './session/backlog';
import { formatTimeLeft } from '@/lib/time';
import { PinyinText } from '@/ui/PinyinText';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SelectInput } from '@/ui/form';
import { PageHeader } from '@/ui/PageHeader';
import type { ReviewSnapshot } from './session/useReviewSnapshot';

interface ReviewGateProps {
  snapshot: ReviewSnapshot | undefined;
  tag: string;
  onTagChange: (tag: string) => void;
  shuffleOrder: boolean;
  onShuffleChange: (value: boolean) => void;
  onStart: () => void;
}

/** Waiting room: what is due, what is waiting, and the session options. */
export function ReviewGate({ snapshot, tag, onTagChange, shuffleOrder, onShuffleChange, onStart }: ReviewGateProps) {
  const { maxReviewsPerDay: maxPerDay } = useSettings();
  const [peek, setPeek] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const spread = async () => {
    if (!snapshot) return;
    const options = {
      perDay: maxPerDay,
      todayCapacity: snapshot.remainingCapacity,
      tag: tag || undefined,
    };
    try {
      const preview = await previewBacklogSpread(options);
      if (preview.moved === 0) {
        toast('Không cần giãn: số thẻ đã vừa giới hạn.');
        return;
      }
      if (!window.confirm(`Giãn ${preview.moved} thẻ${tag ? ` trong tag “${tag}”` : ''} ra ${preview.days} ngày?`)) return;
      const plan = await spreadBacklog(options);
      toast.success(`Đã giãn ${plan.moved} thẻ ra ${plan.days} ngày.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không giãn được.');
    }
  };
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const header = <PageHeader title="Ôn tập" subtitle="Ôn đúng lúc sắp quên — mỗi từ một dạng câu hỏi." />;

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <p className="text-sub">Đang kiểm tra thẻ đến hạn…</p>
      </div>
    );
  }

  const waitMs = snapshot.nextDueAt === null ? null : snapshot.nextDueAt - now;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {header}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-sub">Đến hạn hôm nay</p>
            <p className="text-5xl font-bold text-fg" data-testid="due-count">
              {snapshot.dueCount}
            </p>
            {snapshot.backlog > 0 && (
              <p className="mt-1 text-sm text-warning">
                {snapshot.backlog} thẻ vượt hạn mức hôm nay, sẽ ôn vào ngày mai.{' '}
                <button
                  type="button"
                  className="underline hover:text-fg"
                  onClick={() => void spread()}
                >
                  Giãn ra vài ngày
                </button>
              </p>
            )}
            {snapshot.dueCount === 0 && waitMs !== null && waitMs > 0 && (
              <p className="mt-1 text-sm text-sub">Thẻ tiếp theo đến hạn sau {formatTimeLeft(waitMs)}.</p>
            )}
          </div>
          <div className="text-right text-sm text-sub">
            <p>
              Từ mới còn lại hôm nay: <strong className="text-fg">{snapshot.newRemaining}</strong>
            </p>
            <p className="mt-1">
              Tổng số thẻ: <strong className="text-fg">{snapshot.totalCards}</strong>
            </p>
            {snapshot.pendingCount > 0 && <p className="mt-1">{snapshot.pendingCount} từ đã lưu chờ học</p>}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStart} disabled={snapshot.availableCount === 0}>
            {snapshot.dueCount > 0 && snapshot.availableCount === 0 ? 'Đã đạt giới hạn hôm nay' : 'Bắt đầu ôn'}
          </Button>
          {snapshot.dueCount === 0 && (
            <Link
              to="/learn"
              className="inline-flex h-12 items-center rounded-full bg-linear-to-r from-primary to-primary-end px-6 text-base font-medium text-white"
            >
              Học từ mới
            </Link>
          )}
          <Button variant={shuffleOrder ? 'primary' : 'outline'} onClick={() => onShuffleChange(!shuffleOrder)}>
            <Shuffle className="size-4" aria-hidden /> Trộn thứ tự
          </Button>
          <Button variant="ghost" onClick={() => setPeek((value) => !value)}>
            {peek ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            {peek ? 'Ẩn danh sách' : 'Xem trước'}
          </Button>
          {snapshot.tags.length > 0 && (
            <SelectInput
              aria-label="Lọc theo tag"
              value={tag}
              onChange={(event) => onTagChange(event.target.value)}
              className="max-w-44"
            >
              <option value="">Tất cả tag</option>
              {snapshot.tags.map((item) => (
                <option key={item} value={item}>
                  #{item}
                </option>
              ))}
            </SelectInput>
          )}
        </div>

        {peek && (
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {snapshot.preview.map((item) => (
              <li key={`${item.wordId}-${item.facet}`} className="flex items-center gap-3 rounded-xl bg-surface-2/60 px-3 py-2">
                <span className="font-hanzi text-xl text-fg">{item.simplified}</span>
                <PinyinText pinyin={item.pinyinNum} className="text-sm" />
                <span className="ml-auto text-xs text-muted">
                  {item.mastery}
                  {item.facet === 'listen' && ' · nghe'}
                </span>
              </li>
            ))}
            {snapshot.preview.length === 0 && <li className="text-sm text-muted">Chưa có thẻ nào đến hạn.</li>}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted">
        Phím tắt: 1–4 chọn đáp án · Space nghe lại (Shift+Space nghe chậm) · H gợi ý · P hiện pinyin · Enter tiếp tục.
      </p>
    </div>
  );
}
