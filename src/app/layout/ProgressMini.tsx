import { Flame } from 'lucide-react';
import { useProgress } from '@/progress/snapshot';

/** Streak, level and goal at a glance in the sidebar. */
export function ProgressMini() {
  const progress = useProgress();
  if (!progress) return null;
  return (
    <div
      className="mb-4 hidden items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm md:flex"
      aria-label={`Chuỗi ${progress.streak.current} ngày, level ${progress.level.level}, mục tiêu ${progress.goal.pct}%`}
    >
      <span className={`inline-flex items-center gap-1 ${progress.streak.current ? 'text-warning' : 'text-muted'}`} title="Chuỗi ngày học">
        <Flame className="size-4" aria-hidden /> {progress.streak.current}
      </span>
      <span className="text-sub" title={progress.level.title}>
        Lv {progress.level.level}
      </span>
      <span className="ml-auto text-sub" title="Mục tiêu hôm nay">
        {progress.goal.pct}%
      </span>
    </div>
  );
}
