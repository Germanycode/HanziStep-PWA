import type { ReactNode } from 'react';

export interface ChoiceOption {
  id: string;
  label: ReactNode;
  /** Accessible name when the label is not plain text. */
  ariaLabel?: string;
}

interface ChoiceGridProps {
  options: readonly ChoiceOption[];
  answerId: string;
  /** Set once the learner has answered; reveals right and wrong options. */
  selectedId?: string;
  onSelect: (id: string) => void;
  optionClassName?: string;
}

/** Up to four answer buttons with keyboard hints 1–4 (the page handles the keys). */
export function ChoiceGrid({ options, answerId, selectedId, onSelect, optionClassName = '' }: ChoiceGridProps) {
  const answered = selectedId !== undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option, index) => {
        let state = 'border-line hover:border-line-hover hover:bg-surface-2';
        if (answered) {
          if (option.id === answerId) state = 'border-success bg-success/15';
          else if (option.id === selectedId) state = 'border-danger bg-danger/15';
          else state = 'border-line opacity-60';
        }
        return (
          <button
            key={option.id}
            type="button"
            disabled={answered}
            onClick={() => onSelect(option.id)}
            aria-label={option.ariaLabel}
            data-choice-id={option.id}
            className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-fg transition ${state} ${optionClassName}`}
          >
            <kbd className="rounded bg-surface-2 px-1.5 text-xs text-muted">{index + 1}</kbd>
            <span className="min-w-0 flex-1">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
