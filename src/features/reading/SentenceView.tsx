import { Volume2 } from 'lucide-react';
import { syllableToMarks, toMarks } from '@/chinese/pinyin/marks';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { TONE_TEXT_CLASS } from '@/chinese/toneColors';
import type { PinyinDisplay } from '@/domain/types';
import type { PreparedSentence, RenderToken } from './pipeline';
import type { TokenStatus } from './tokens';

const STATUS_CLASS: Record<TokenStatus, string> = {
  known: 'border-b-2 border-transparent',
  learning: 'border-b-2 border-warning/70',
  target: 'border-b-2 border-primary',
  new: 'border-b-2 border-accent/50',
  unknown: 'border-b-2 border-dashed border-danger/60',
  other: '',
};

function showsPinyin(mode: PinyinDisplay, status: TokenStatus): boolean {
  if (mode === 'none') return false;
  if (mode === 'all') return true;
  return status !== 'known';
}

/** Characters with their reading above, per character when the syllables line up. */
function Ruby({ token, colored }: { token: RenderToken; colored: boolean }) {
  const syllables = parsePinyin(token.pinyinNum).syllables;
  const chars = [...token.text];
  if (syllables.length !== chars.length) {
    return (
      <ruby>
        {token.text}
        <rt className="text-[0.6em] font-normal text-sub">{toMarks(syllables)}</rt>
      </ruby>
    );
  }
  return (
    <>
      {chars.map((char, index) => {
        const syllable = syllables[index];
        if (!syllable) return char;
        return (
          <ruby key={index}>
            {char}
            <rt className={`text-[0.6em] font-normal ${colored ? TONE_TEXT_CLASS[syllable.tone] : 'text-sub'}`}>
              {syllableToMarks(syllable)}
            </rt>
          </ruby>
        );
      })}
    </>
  );
}

interface SentenceViewProps {
  sentence: PreparedSentence;
  pinyinMode: PinyinDisplay;
  toneColors: boolean;
  /** The sentence being read aloud. */
  active: boolean;
  /** Until the dictionary is imported every word looks unknown, so the warning underline waits. */
  dictReady: boolean;
  showVi: boolean;
  selectedStart?: number;
  onTokenClick: (token: RenderToken, anchor: HTMLElement) => void;
  onPlay: () => void;
}

export function SentenceView({
  sentence,
  pinyinMode,
  toneColors,
  active,
  dictReady,
  showVi,
  selectedStart,
  onTokenClick,
  onPlay,
}: SentenceViewProps) {
  return (
    <div
      className={`rounded-xl px-2 py-1 transition-colors ${active ? 'bg-primary/10' : ''}`}
      data-sentence-index={sentence.index}
    >
      <p className="font-hanzi flex flex-wrap items-end gap-y-2 text-2xl leading-loose text-fg">
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Nghe câu ${sentence.index + 1}`}
          className="mr-1 self-center text-muted transition hover:text-primary"
        >
          <Volume2 className="size-4" aria-hidden />
        </button>
        {sentence.tokens.map((token, index) => {
          const status = !dictReady && token.status === 'unknown' ? 'other' : token.status;
          return token.kind === 'word' ? (
            <button
              key={index}
              type="button"
              title={token.pinyinNum || undefined}
              data-token-start={token.start}
              data-token-text={token.text}
              onClick={(event) => onTokenClick(token, event.currentTarget)}
              className={`rounded transition hover:bg-primary/15 ${STATUS_CLASS[status]} ${
                selectedStart === token.start ? 'bg-primary/20' : ''
              }`}
            >
              {showsPinyin(pinyinMode, status) && token.pinyinNum ? <Ruby token={token} colored={toneColors} /> : token.text}
            </button>
          ) : (
            <span key={index} className={token.kind === 'space' ? 'w-1' : undefined}>
              {token.text}
            </span>
          );
        })}
      </p>
      {showVi && sentence.vi && (
        <p className="mt-1 pl-6 text-sm text-sub" lang="vi">
          {sentence.vi}
        </p>
      )}
    </div>
  );
}
