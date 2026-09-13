import { createBrowserRouter } from 'react-router';
import { TodayPage } from '@/features/today/TodayPage';
import { AppLayout } from './layout/AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';

/**
 * Only the shell and the Today page are in the first chunk; every other screen
 * is fetched when it is first opened, which keeps the initial JavaScript inside
 * the budget checked by `npm run size` (docs/PLAN.md §9, Phase 5).
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'learn', lazy: async () => ({ Component: (await import('@/features/learn/LearnPage')).LearnPage }) },
      { path: 'review', lazy: async () => ({ Component: (await import('@/features/review/ReviewPage')).ReviewPage }) },
      { path: 'reading', lazy: async () => ({ Component: (await import('@/features/reading/ReadingLibraryPage')).ReadingLibraryPage }) },
      { path: 'reading/:textId', lazy: async () => ({ Component: (await import('@/features/reading/ReaderPage')).ReaderPage }) },
      { path: 'listening', lazy: async () => ({ Component: (await import('@/features/listening/ListeningPage')).ListeningPage }) },
      { path: 'listening/shadow', lazy: async () => ({ Component: (await import('@/features/speaking/ShadowingPage')).ShadowingPage }) },
      { path: 'listening/:textId', lazy: async () => ({ Component: (await import('@/features/listening/ListeningSession')).ListeningSession }) },
      { path: 'pinyin', lazy: async () => ({ Component: (await import('@/features/pinyin/PinyinHomePage')).PinyinHomePage }) },
      { path: 'pinyin/lessons/:lessonId', lazy: async () => ({ Component: (await import('@/features/pinyin/LessonPage')).LessonPage }) },
      { path: 'pinyin/chart', lazy: async () => ({ Component: (await import('@/features/pinyin/PinyinChartPage')).PinyinChartPage }) },
      { path: 'pinyin/drill/:drillType', lazy: async () => ({ Component: (await import('@/features/pinyin/DrillPage')).DrillPage }) },
      { path: 'writing', lazy: async () => ({ Component: (await import('@/features/writing/WritingPage')).WritingPage }) },
      { path: 'vocab', lazy: async () => ({ Component: (await import('@/features/vocab/VocabPage')).VocabPage }) },
      { path: 'stats', lazy: async () => ({ Component: (await import('@/features/stats/StatsPage')).StatsPage }) },
      { path: 'coach', lazy: async () => ({ Component: (await import('@/features/coach/CoachPage')).CoachPage }) },
      { path: 'settings', lazy: async () => ({ Component: (await import('@/features/settings/SettingsPage')).SettingsPage }) },
      { path: 'settings/sources', lazy: async () => ({ Component: (await import('@/features/settings/SourcesPage')).SourcesPage }) },
      { path: 'settings/voices', lazy: async () => ({ Component: (await import('@/features/settings/VoiceDiagnosticsPage')).VoiceDiagnosticsPage }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
