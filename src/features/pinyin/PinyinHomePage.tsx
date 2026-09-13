import { CheckCircle2, Grid3x3, Headphones, Lock } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { DRILL_DEFINITIONS, type DrillType } from './drills';
import { LESSONS } from './lessons';
import { drillAccuracy, useDrillStats, usePinyinProgress } from './store';

const ACCURACY_PREFIX: Record<DrillType, string> = {
  'tone-id': 'tone:',
  'tone-pairs': 'pair:',
  'minimal-pairs': 'minimal:',
  'pinyin-typing': 'type:',
};

export function PinyinHomePage() {
  const progress = usePinyinProgress();
  const drillStats = useDrillStats();
  const completed = new Set(progress?.completedLessons ?? []);
  const nextLesson = LESSONS.find((lesson) => !completed.has(lesson.id));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Phát âm"
        subtitle={`Pinyin và thanh điệu cho người mới bắt đầu · ${completed.size}/${LESSONS.length} bài đã học`}
        actions={
          <Link to="/pinyin/chart" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <Grid3x3 className="size-4" aria-hidden /> Bảng pinyin
          </Link>
        }
      />

      <Card title="Bài học" description="Học lần lượt; mỗi bài có ví dụ để nghe và đọc theo.">
        <ol className="divide-y divide-line">
          {LESSONS.map((lesson, index) => {
            const done = completed.has(lesson.id);
            const isNext = lesson.id === nextLesson?.id;
            const unlocked = index === 0 || completed.has(LESSONS[index - 1]?.id ?? '');
            const content = (
              <>
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                    done ? 'bg-success/15 text-success' : 'bg-surface-2 text-sub'
                  }`}
                >
                  {done ? <CheckCircle2 className="size-5" aria-label="Đã học" /> : unlocked ? index + 1 : <Lock className="size-4" aria-label="Đang khoá" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-fg">{lesson.title}</span>
                  <span className="block text-sm text-sub">{lesson.summary}</span>
                </span>
                {isNext && <span className="ml-auto shrink-0 text-xs font-semibold text-primary">Học tiếp</span>}
              </>
            );
            return (
              <li key={lesson.id}>
                {unlocked ? (
                  <Link
                    to={`/pinyin/lessons/${lesson.id}`}
                    className={`flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-surface-2 ${isNext ? 'bg-primary/10' : ''}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex cursor-not-allowed items-center gap-4 rounded-xl px-2 py-3 opacity-60" aria-label={`${lesson.title} — hoàn thành bài trước để mở`}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card title="Luyện tai và luyện gõ" description="Mỗi vòng 10 câu; câu hay sai sẽ xuất hiện nhiều hơn.">
        <div className="grid gap-3 sm:grid-cols-2">
          {DRILL_DEFINITIONS.map((drill) => {
            const accuracy = drillAccuracy(drillStats, ACCURACY_PREFIX[drill.type]);
            return (
              <Link
                key={drill.type}
                to={`/pinyin/drill/${drill.type}`}
                className="flex gap-3 rounded-xl border border-line p-4 transition hover:border-line-hover hover:bg-surface-2"
              >
                <Headphones className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block font-medium text-fg">{drill.title}</span>
                  <span className="block text-sm text-sub">{drill.description}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {accuracy === null ? 'Chưa luyện' : `Độ chính xác gần đây ~${Math.round(accuracy * 100)}%`}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
