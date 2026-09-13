import { useLiveQuery } from 'dexie-react-hooks';
import { Flame, Target, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { levelLabel, loadHskLevel, MAX_LEVEL as HSK_MAX_LEVEL, TRACK_LABELS } from '@/data/hsk';
import type { HskWordRecord } from '@/data/types';
import { db } from '@/db/db';
import { useSettings } from '@/db/settings';
import { toDayKey } from '@/lib/dayKey';
import { BADGES } from '@/progress/badges';
import { useProgress } from '@/progress/snapshot';
import { MASTERY_LABELS } from '@/srs/cards';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import {
  buildHeatmap,
  levelProgress,
  masteryByFacet,
  ownedWordKeys,
  posBreakdown,
  sumTotals,
  type HeatCell,
} from './stats';

const HEAT_CLASSES = ['bg-surface-2', 'bg-primary/25', 'bg-primary/45', 'bg-primary/70', 'bg-primary'] as const;
const FACET_LABELS: Record<string, string> = { read: 'Đọc hiểu', listen: 'Nghe', speak: 'Nói', write: 'Viết' };
const MASTERY_CLASSES = ['bg-surface-2', 'bg-warning/60', 'bg-accent/60', 'bg-primary/70', 'bg-success'] as const;

function Heatmap({ cells }: { cells: HeatCell[] }) {
  // 14 columns of 7 days, oldest on the left.
  const columns: HeatCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) columns.push(cells.slice(index, index + 7));
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-1">
            {column.map((cell) => (
              <span
                key={cell.dayKey}
                title={`${cell.dayKey}: ${cell.xp} XP · ${cell.answers} câu`}
                className={`size-3.5 rounded-sm ${HEAT_CLASSES[cell.level]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span>Ít</span>
        {HEAT_CLASSES.map((className) => (
          <span key={className} className={`size-3 rounded-sm ${className}`} />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2/60 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold text-fg">{value}</p>
      {hint && <p className="text-xs text-sub">{hint}</p>}
    </div>
  );
}

export function StatsPage() {
  const settings = useSettings();
  const progress = useProgress();
  const [hskFiles, setHskFiles] = useState<{ level: number; words: HskWordRecord[] }[]>([]);

  const data = useLiveQuery(async () => {
    const [stats, cards, words] = await Promise.all([db.dailyStats.toArray(), db.cards.toArray(), db.words.toArray()]);
    return { stats, cards, words };
  }, []);

  useEffect(() => {
    let active = true;
    const top = Math.min(HSK_MAX_LEVEL[settings.hskTrack], settings.currentLevel + 1);
    Promise.all(
      Array.from({ length: top }, (_, index) => index + 1).map((level) =>
        loadHskLevel(settings.hskTrack, level).then(
          (file) => ({ level, words: file.words }),
          () => ({ level, words: [] as HskWordRecord[] }),
        ),
      ),
    ).then((files) => {
      if (active) setHskFiles(files);
    }, () => {});
    return () => {
      active = false;
    };
  }, [settings.hskTrack, settings.currentLevel]);

  const today = toDayKey(new Date(), settings.dayStartHour);
  const totals = useMemo(() => sumTotals(data?.stats ?? []), [data]);
  const heatmap = useMemo(() => buildHeatmap(data?.stats ?? [], today), [data, today]);
  const facets = useMemo(() => masteryByFacet(data?.cards ?? []), [data]);
  const pos = useMemo(() => posBreakdown(data?.words ?? []), [data]);
  const owned = useMemo(() => ownedWordKeys(data?.words ?? []), [data]);
  const levels = useMemo(() => hskFiles.map((file) => levelProgress(file.level, file.words, owned)), [hskFiles, owned]);
  const recent = useMemo(() => heatmap.slice(-7), [heatmap]);
  const maxRecentXp = Math.max(1, ...recent.map((cell) => cell.xp));
  const unlocked = new Set(progress?.badges ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Thống kê" subtitle="Mọi con số được tính lại từ dữ liệu trên máy này." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4">
          <span className="font-hanzi grid size-14 place-items-center rounded-xl bg-seal text-xl font-bold text-white">
            {progress?.level.level ?? 1}
          </span>
          <div>
            <p className="text-sm text-sub">
              {progress?.level.title ?? 'Học trò'} <span className="font-hanzi">{progress?.level.titleZh ?? '学童'}</span>
            </p>
            <p className="text-2xl font-bold text-fg">{(progress?.level.xp ?? 0).toLocaleString('vi-VN')} XP</p>
            <div className="mt-2 h-2 w-40 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-primary" style={{ width: `${progress?.level.progressPct ?? 0}%` }} />
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <Flame className={`size-10 ${progress?.streak.current ? 'text-warning' : 'text-muted'}`} aria-hidden />
          <div>
            <p className="text-sm text-sub">Chuỗi ngày học</p>
            <p className="text-2xl font-bold text-fg">{progress?.streak.current ?? 0} ngày</p>
            <p className="text-xs text-sub">Kỷ lục {progress?.streak.longest ?? 0} ngày · {totals.activeDays} ngày đã học</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <Target className="size-10 text-primary" aria-hidden />
          <div>
            <p className="text-sm text-sub">Độ chính xác</p>
            <p className="text-2xl font-bold text-fg">{Math.round(totals.accuracy * 100)}%</p>
            <p className="text-xs text-sub">
              {totals.correct.toLocaleString('vi-VN')}/{totals.answers.toLocaleString('vi-VN')} câu ôn tập
            </p>
          </div>
        </Card>
      </div>

      <Card title="98 ngày gần nhất" description="Mỗi ô là một ngày; đậm hơn nghĩa là nhiều XP hơn.">
        <Heatmap cells={heatmap} />
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <StatTile label="Tổng XP" value={totals.xp.toLocaleString('vi-VN')} />
          <StatTile label="Từ đã học" value={totals.newIntroduced.toLocaleString('vi-VN')} />
          <StatTile label="Câu đã trả lời" value={totals.answers.toLocaleString('vi-VN')} />
          <StatTile label="Số từ đang lưu" value={(data?.words.length ?? 0).toLocaleString('vi-VN')} />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="7 ngày qua">
          <div className="flex h-40 items-end gap-2">
            {recent.map((cell) => (
              <div key={cell.dayKey} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-muted">{cell.xp || ''}</span>
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(2, (cell.xp / maxRecentXp) * 100)}%` }}
                  title={`${cell.dayKey}: ${cell.xp} XP`}
                />
                <span className="text-[10px] text-muted">{cell.dayKey.slice(8)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Mức thuộc theo kỹ năng">
          {facets.length === 0 ? (
            <p className="text-sm text-sub">Chưa có thẻ nào.</p>
          ) : (
            <div className="space-y-4">
              {facets.map((facet) => (
                <div key={facet.facet}>
                  <p className="mb-1 flex justify-between text-sm">
                    <span className="text-fg">{FACET_LABELS[facet.facet] ?? facet.facet}</span>
                    <span className="text-sub">
                      {facet.total} thẻ{facet.suspended > 0 ? ` · ${facet.suspended} đang khoá` : ''}
                    </span>
                  </p>
                  <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
                    {facet.counts.map((count, level) => (
                      <div
                        key={level}
                        className={MASTERY_CLASSES[level]}
                        style={{ width: `${facet.total > 0 ? (count / facet.total) * 100 : 0}%` }}
                        title={`${MASTERY_LABELS[level]}: ${count}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <p className="flex flex-wrap gap-x-3 text-xs text-muted">
                {MASTERY_LABELS.map((label, level) => (
                  <span key={label} className="inline-flex items-center gap-1">
                    <span className={`size-2.5 rounded-sm ${MASTERY_CLASSES[level]}`} /> {label}
                  </span>
                ))}
              </p>
            </div>
          )}
        </Card>

        <Card title={`Tiến độ ${TRACK_LABELS[settings.hskTrack]}`}>
          {levels.length === 0 ? (
            <p className="text-sm text-sub">Đang tải danh sách từ…</p>
          ) : (
            <ul className="space-y-3">
              {levels.map((level) => (
                <li key={level.level}>
                  <p className="mb-1 flex justify-between text-sm">
                    <span className="text-fg">{levelLabel(level.level)}</span>
                    <span className="text-sub">
                      {level.owned}/{level.total} từ · {level.pct}%
                    </span>
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full bg-primary" style={{ width: `${level.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Từ loại đang học">
          {pos.length === 0 ? (
            <p className="text-sm text-sub">Chưa có từ nào.</p>
          ) : (
            <ul className="space-y-2">
              {pos.map((entry) => (
                <li key={entry.code} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-sub">{entry.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${(entry.count / (pos[0]?.count ?? 1)) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-fg">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Huy hiệu" description={`Đã mở ${unlocked.size}/${BADGES.length}`}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((badge) => {
            const owned = unlocked.has(badge.id);
            return (
              <li
                key={badge.id}
                className={`flex items-start gap-3 rounded-xl border p-3 ${owned ? 'border-primary/40 bg-primary/10' : 'border-line opacity-60'}`}
              >
                <span className="text-2xl" aria-hidden>
                  {owned ? badge.icon : '🔒'}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg">{badge.title}</span>
                  <span className="block text-xs text-sub">{badge.description}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <p className="flex items-center justify-center gap-2 text-xs text-muted">
        <TrendingUp className="size-4" aria-hidden /> XP và mức thuộc được tính lại mỗi lần mở trang này.
      </p>
    </div>
  );
}
