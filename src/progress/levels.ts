/**
 * Levels follow the imperial examination ranks. Thresholds grow quadratically,
 * minXp(L) = 250 × (L − 1)², so level 10 needs 20,250 XP. (The English app's
 * table reached level 10 after about 370 correct answers.)
 */
export const LEVEL_TITLES = [
  { vi: 'Học trò', zh: '学童' },
  { vi: 'Thư sinh', zh: '书生' },
  { vi: 'Tú tài', zh: '秀才' },
  { vi: 'Cử nhân', zh: '举人' },
  { vi: 'Cống sĩ', zh: '贡士' },
  { vi: 'Tiến sĩ', zh: '进士' },
  { vi: 'Thám hoa', zh: '探花' },
  { vi: 'Bảng nhãn', zh: '榜眼' },
  { vi: 'Trạng nguyên', zh: '状元' },
  { vi: 'Hàn lâm', zh: '翰林' },
] as const;

export const MAX_LEVEL = LEVEL_TITLES.length;

export function minXpForLevel(level: number): number {
  return 250 * (level - 1) ** 2;
}

export interface LevelInfo {
  level: number;
  title: string;
  titleZh: string;
  xp: number;
  minXp: number;
  /** Infinity at the maximum level. */
  maxXp: number;
  progressInLevel: number;
  span: number;
  progressPct: number;
  nextLevel: number;
  isMax: boolean;
}

/** Same shape as the English extension's `getLevelInfo`. */
export function getLevelInfo(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  let level = 1;
  while (level < MAX_LEVEL && xp >= minXpForLevel(level + 1)) level++;

  const isMax = level === MAX_LEVEL;
  const minXp = minXpForLevel(level);
  const maxXp = isMax ? Number.POSITIVE_INFINITY : minXpForLevel(level + 1);
  const span = isMax ? 0 : maxXp - minXp;
  const progressInLevel = xp - minXp;
  const title = LEVEL_TITLES[level - 1] ?? LEVEL_TITLES[0];

  return {
    level,
    title: title.vi,
    titleZh: title.zh,
    xp,
    minXp,
    maxXp,
    progressInLevel,
    span,
    progressPct: isMax ? 100 : Math.min(100, Math.floor((progressInLevel / span) * 100)),
    nextLevel: isMax ? level : level + 1,
    isMax,
  };
}
