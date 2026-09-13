import { syllableToMarks } from '@/chinese/pinyin/marks';
import { parsePinyin } from '@/chinese/pinyin/parse';
import { TONE_TEXT_CLASS } from '@/chinese/toneColors';
import { useSettings } from '@/db/settings';

interface PinyinTextProps {
  /** Numbered or marked pinyin, e.g. "ni3 hao3". */
  pinyin: string;
  /** Overrides the "tone colours" setting. */
  colored?: boolean;
  className?: string;
}

/** Pinyin with tone marks, coloured by tone when enabled. Erhua "r" is joined to the previous syllable. */
export function PinyinText({ pinyin, colored, className = '' }: PinyinTextProps) {
  const { toneColors } = useSettings();
  const useColor = colored ?? toneColors;
  const { syllables } = parsePinyin(pinyin);

  return (
    <span className={className}>
      {syllables.map((syllable, index) => {
        const next = syllables[index + 1];
        const separator = next && next.base !== 'r' ? ' ' : '';
        return (
          <span key={index} className={useColor ? TONE_TEXT_CLASS[syllable.tone] : undefined}>
            {syllableToMarks(syllable)}
            {separator}
          </span>
        );
      })}
    </span>
  );
}
