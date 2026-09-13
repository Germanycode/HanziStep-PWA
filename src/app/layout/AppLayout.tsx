import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Toaster } from 'sonner';
import { PwaUpdater } from '@/app/PwaUpdater';
import { ThemeSync } from '@/app/ThemeSync';
import { ensureDictionary } from '@/data/dictImport';
import { useSettings } from '@/db/settings';
import { MusicPlayer } from '@/features/music/MusicPlayer';
import { useDueCount } from '@/features/review/session/useReviewSnapshot';
import { QuickLookup } from '@/features/vocab/QuickLookup';
import { setDueBadge } from '@/services/badge';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const { theme } = useSettings();
  // Deliberately not the full review snapshot: this query lives in the layout
  // and would otherwise rescan every word and card on each answer.
  const dueCount = useDueCount() ?? 0;

  // The installed app shows the number of cards waiting on its icon.
  useEffect(() => {
    void setDueBadge(dueCount);
  }, [dueCount]);

  // The dictionary import runs in a worker and stops early when it is already
  // current. It waits for an idle moment so its 125k writes never slow down the
  // first review session.
  useEffect(() => {
    const start = () => void ensureDictionary();
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(start, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = setTimeout(start, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <ThemeSync />
      <Sidebar />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-32 sm:px-8">
        <Outlet />
      </main>
      <QuickLookup />
      <MusicPlayer />
      <PwaUpdater />
      <Toaster theme={theme} position="top-center" richColors closeButton />
    </div>
  );
}
