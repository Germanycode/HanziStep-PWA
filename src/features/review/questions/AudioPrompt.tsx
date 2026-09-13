import { Volume2 } from 'lucide-react';

/** Big speaker button used by every listening question. */
export function AudioPrompt({ onPlay, label = 'Nghe lại' }: { onPlay: (slow?: boolean) => void; label?: string }) {
  return (
    <div className="my-6 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => onPlay()}
        aria-label={label}
        className="grid size-24 place-items-center rounded-full bg-linear-to-r from-primary to-primary-end text-white shadow-lg transition hover:brightness-110"
      >
        <Volume2 className="size-10" aria-hidden />
      </button>
      <button type="button" onClick={() => onPlay(true)} className="text-sm text-sub hover:text-fg">
        Nghe chậm · Space để nghe lại
      </button>
    </div>
  );
}
