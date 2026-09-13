import { toast } from 'sonner';
import { findBadge } from './badges';
import { getLevelInfo } from './levels';
import type { ActivityResult } from './recordActivity';

/**
 * Toasts for XP, the daily goal, level-ups and new badges after an activity.
 * Reviews pass `xpToast: false` because the XP is already in the answer panel.
 */
export function announceActivity(result: ActivityResult, label: string, options: { xpToast?: boolean } = {}): void {
  if (options.xpToast ?? true) {
    if (result.xpAwarded > 0) toast.success(`${label} · +${result.xpAwarded} XP`);
    else if (result.capped) toast(`${label} · đã đạt giới hạn XP hôm nay cho hoạt động này`);
  }

  if (result.goalReachedNow) toast.success(`🎯 Đạt mục tiêu hôm nay! +${result.goalBonus} XP`);
  if (result.levelAfter > result.levelBefore) {
    const level = getLevelInfo(result.totalXp);
    toast.success(`🎉 Lên level ${level.level}: ${level.title} ${level.titleZh}`);
  }
  for (const id of result.newBadges) {
    const badge = findBadge(id);
    if (badge) toast.success(`${badge.icon} Mở khoá huy hiệu “${badge.title}”`);
  }
}
