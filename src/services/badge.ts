/**
 * App icon badge with the number of cards due (docs/PLAN.md §9, Phase 5).
 * Only installed PWAs on supporting platforms show it; everywhere else this is
 * a no-op.
 */

interface BadgeNavigator {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

function badgeApi(): BadgeNavigator | null {
  if (typeof navigator === 'undefined') return null;
  const api = navigator as unknown as BadgeNavigator;
  return typeof api.setAppBadge === 'function' ? api : null;
}

export function badgeSupported(): boolean {
  return badgeApi() !== null;
}

export async function setDueBadge(count: number): Promise<void> {
  const api = badgeApi();
  if (!api) return;
  try {
    if (count > 0) await api.setAppBadge?.(count);
    else await api.clearAppBadge?.();
  } catch {
    // A badge is a nicety; never let it break a page.
  }
}
