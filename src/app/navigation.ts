import {
  AudioLines,
  BookOpen,
  ChartColumn,
  Headphones,
  House,
  Library,
  RotateCcw,
  Settings,
  Sparkles,
  PenTool,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { vi } from '@/i18n/vi';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  end?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: vi.nav.today, icon: House, end: true },
  { to: '/learn', label: vi.nav.learn, icon: Sparkles },
  { to: '/review', label: vi.nav.review, icon: RotateCcw },
  { to: '/reading', label: vi.nav.reading, icon: BookOpen },
  { to: '/listening', label: vi.nav.listening, icon: Headphones },
  { to: '/pinyin', label: vi.nav.pinyin, icon: AudioLines },
  { to: '/writing', label: vi.nav.writing, icon: PenTool },
  { to: '/vocab', label: vi.nav.vocab, icon: Library },
  { to: '/stats', label: vi.nav.stats, icon: ChartColumn },
  { to: '/settings', label: vi.nav.settings, icon: Settings },
];
