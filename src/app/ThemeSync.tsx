import { useEffect } from 'react';
import { useLoadedSettings } from '@/db/settings';

export const THEME_STORAGE_KEY = 'hanzistep-theme';

/**
 * Applies the saved theme to <html data-theme> and mirrors it to localStorage,
 * which index.html reads synchronously before first paint.
 */
export function ThemeSync() {
  const theme = useLoadedSettings()?.theme;

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#eff8f7' : '#0f0f1a');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be blocked; the theme still applies for this session.
    }
  }, [theme]);

  return null;
}
