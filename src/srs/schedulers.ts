import type { Settings } from '@/domain/types';
import { fsrsScheduler } from './fsrs';
import type { Scheduler } from './scheduler';
import { sm2 } from './sm2';

export const SCHEDULERS: Record<Settings['scheduler'], Scheduler> = {
  sm2,
  fsrs: fsrsScheduler,
};

export const SCHEDULER_LABELS: Record<Settings['scheduler'], string> = {
  sm2: 'SM-2 (giống app tiếng Anh)',
  fsrs: 'FSRS (tính theo trí nhớ, thử nghiệm)',
};

export function schedulerFor(id: Settings['scheduler']): Scheduler {
  return SCHEDULERS[id] ?? sm2;
}
