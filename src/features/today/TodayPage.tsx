import { Database, Flame, GraduationCap, Headphones, KeyRound, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { loadDataManifest, type DataManifest } from '@/data/manifest';
import { useSettings } from '@/db/settings';
import { formatBytes, getStorageStatus, type StorageStatus } from '@/db/storage';
import { LESSONS } from '@/features/pinyin/lessons';
import { usePinyinProgress } from '@/features/pinyin/store';
import { useReviewSnapshot } from '@/features/review/session/useReviewSnapshot';
import { useProgress } from '@/progress/snapshot';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';

function greetingFor(hour: number): string {
  if (hour < 11) return 'Chào buổi sáng!';
  if (hour < 18) return 'Chào buổi chiều!';
  return 'Chào buổi tối!';
}

function GoalRing({ pct, label }: { pct: number; label: string }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 100 100" className="size-28" role="img" aria-label={label}>
      <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" className="stroke-surface-2" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct / 100)}
        transform="rotate(-90 50 50)"
        className="stroke-primary transition-[stroke-dashoffset] duration-500"
      />
      <text x="50" y="55" textAnchor="middle" className="fill-fg text-lg font-bold">
        {pct}%
      </text>
    </svg>
  );
}

function StatusRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        <div className="text-sm text-sub">{children}</div>
      </div>
    </li>
  );
}

export function TodayPage() {
  const settings = useSettings();
  const progress = useProgress();
  const pinyinProgress = usePinyinProgress();
  const review = useReviewSnapshot();
  const [greeting] = useState(() => greetingFor(new Date().getHours()));
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [manifest, setManifest] = useState<DataManifest | null | undefined>(undefined);

  useEffect(() => {
    void getStorageStatus().then(setStorage);
    void loadDataManifest().then(setManifest);
  }, []);

  const completed = new Set(pinyinProgress?.completedLessons ?? []);
  const nextLesson = LESSONS.find((lesson) => !completed.has(lesson.id));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={greeting} subtitle="Mỗi ngày một chút: nghe, đọc theo và ôn lại." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4">
          <GoalRing pct={progress?.goal.pct ?? 0} label="Tiến độ mục tiêu hôm nay" />
          <div>
            <p className="text-sm text-sub">Mục tiêu hôm nay</p>
            <p className="text-xl font-bold text-fg" data-testid="goal-xp">
              {progress?.goal.xp ?? 0} / {settings.dailyGoalXp} XP
            </p>
            <p className="text-sm text-sub">{progress?.goal.met ? '🎯 Đã đạt, tuyệt vời!' : 'Học tiếp để lấp đầy vòng tròn.'}</p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <Flame className={`size-8 ${progress?.streak.current ? 'text-warning' : 'text-muted'}`} aria-hidden />
            <div>
              <p className="text-sm text-sub">Chuỗi ngày học</p>
              <p className="text-3xl font-bold text-fg">
                <span data-testid="streak-current">{progress?.streak.current ?? 0}</span> <small className="text-base font-normal text-sub">ngày</small>
              </p>
            </div>
          </div>
          <p className="mt-2 text-sm text-sub">
            {progress?.streak.atRisk
              ? '⚠️ Hôm nay chưa học — làm một bài ngắn để giữ chuỗi!'
              : `Kỷ lục: ${progress?.streak.longest ?? 0} ngày`}
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <span className="font-hanzi grid size-10 place-items-center rounded-xl bg-seal text-lg font-bold text-white">
              {progress?.level.level ?? 1}
            </span>
            <div>
              <p className="text-sm text-sub">Level</p>
              <p className="text-lg font-bold text-fg">
                {progress?.level.title ?? 'Học trò'} <span className="font-hanzi text-sub">{progress?.level.titleZh ?? '学童'}</span>
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary" style={{ width: `${progress?.level.progressPct ?? 0}%` }} />
          </div>
          <p className="mt-1 text-xs text-sub" data-testid="total-xp">
            {progress?.level.xp ?? 0} XP
            {progress && !progress.level.isMax ? ` · còn ${progress.level.maxXp - progress.level.xp} XP để lên level ${progress.level.nextLevel}` : ''}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Học tiếp" description="Ôn thẻ đến hạn trước, rồi thêm từ mới.">
          <div className="space-y-3">
            <Link
              to="/review"
              className="flex items-center gap-3 rounded-xl bg-primary/10 p-4 transition hover:bg-primary/15"
              data-testid="today-review"
            >
              <RotateCcw className="size-6 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold text-fg">
                  {review ? (review.dueCount > 0 ? `Ôn ${review.dueCount} thẻ đến hạn` : 'Không có thẻ đến hạn') : 'Đang kiểm tra…'}
                </span>
                <span className="block text-sm text-sub">
                  {review && review.backlog > 0 ? `${review.backlog} thẻ chờ sang ngày mai` : 'Ôn tập ngắt quãng SM-2'}
                </span>
              </span>
            </Link>
            <Link to="/learn" className="flex items-center gap-3 rounded-xl border border-line p-4 transition hover:bg-surface-2">
              <GraduationCap className="size-6 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold text-fg">
                  {review ? (review.newRemaining > 0 ? `Học ${review.newRemaining} từ mới` : 'Đã học đủ từ mới hôm nay') : 'Học từ mới'}
                </span>
                <span className="block text-sm text-sub">
                  {review && review.pendingCount > 0 ? `${review.pendingCount} từ đã lưu đang chờ` : `${settings.newWordsPerDay} từ/ngày`}
                </span>
              </span>
            </Link>
            {nextLesson ? (
              <Link
                to={`/pinyin/lessons/${nextLesson.id}`}
                className="flex items-center gap-3 rounded-xl bg-primary/10 p-4 transition hover:bg-primary/15"
              >
                <Sparkles className="size-6 text-primary" aria-hidden />
                <span>
                  <span className="block text-xs text-sub">
                    Bài {LESSONS.indexOf(nextLesson) + 1}/{LESSONS.length}
                  </span>
                  <span className="block font-semibold text-fg">{nextLesson.title}</span>
                </span>
              </Link>
            ) : (
              <p className="rounded-xl bg-success/10 p-4 text-sm text-success">🎓 Bạn đã học xong 8 bài pinyin!</p>
            )}
            <Link
              to="/pinyin/drill/tone-id"
              className="flex items-center gap-3 rounded-xl border border-line p-4 transition hover:bg-surface-2"
            >
              <Headphones className="size-6 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold text-fg">Luyện nhận diện thanh</span>
                <span className="block text-sm text-sub">10 câu · khoảng 2 phút</span>
              </span>
            </Link>
          </div>
        </Card>

        <Card title="Trạng thái ứng dụng">
          <ul className="divide-y divide-line">
            <StatusRow icon={<Database className="size-5" />} label="Gói dữ liệu tiếng Trung">
              {manifest === undefined && 'Đang kiểm tra…'}
              {manifest === null && (
                <>
                  Chưa có. Chạy <code className="rounded bg-surface-2 px-1">npm run data:build</code> rồi build lại.
                </>
              )}
              {manifest &&
                `${manifest.counts.hskWords.toLocaleString('vi-VN')} từ HSK · ${manifest.counts.dictEntries.toLocaleString('vi-VN')} mục từ điển · ${manifest.counts.syllableAudio.toLocaleString('vi-VN')} bản ghi âm tiết`}
            </StatusRow>
            <StatusRow icon={<ShieldCheck className="size-5" />} label="Lưu trữ trên máy">
              {storage
                ? `${storage.persisted ? 'Đã bật lưu trữ bền' : 'Chưa bật lưu trữ bền'} · đang dùng ${formatBytes(storage.usageBytes)}`
                : 'Trình duyệt không cung cấp thông tin dung lượng.'}
            </StatusRow>
            <StatusRow icon={<KeyRound className="size-5" />} label="Gemini API key">
              {settings.geminiApiKey ? (
                'Đã nhập — dùng cho truyện AI, chấm câu và AI Coach.'
              ) : (
                <>
                  Chưa nhập (không bắt buộc).{' '}
                  <Link to="/settings" className="text-primary hover:underline">
                    Mở Cài đặt
                  </Link>
                </>
              )}
            </StatusRow>
            <StatusRow icon={<GraduationCap className="size-5" />} label="Kế hoạch">
              {`HSK cấp ${settings.currentLevel} · ${settings.newWordsPerDay} từ mới/ngày · ${review?.totalCards ?? 0} thẻ đang ôn`}
            </StatusRow>
          </ul>
        </Card>
      </div>
    </div>
  );
}
