import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

const CONTROL =
  'h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg outline-none transition focus:border-primary disabled:opacity-60';

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[minmax(0,13rem)_1fr] sm:items-start sm:gap-4">
      <label htmlFor={htmlFor} className="pt-2 text-sm font-medium text-fg">
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function SelectInput({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${CONTROL} ${className}`} {...props} />;
}

/** Integer input that clamps and commits on blur or Enter. Give it `key={value}` to resync after external changes. */
export function NumberInput({
  id,
  value,
  min,
  max,
  onCommit,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? value : Math.min(max, Math.max(min, parsed));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <TextInput
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
      className="max-w-32"
    />
  );
}

export function Switch({
  id,
  checked,
  label,
  onChange,
}: {
  id?: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative mt-2 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-surface-2 ring-1 ring-line'}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  );
}
