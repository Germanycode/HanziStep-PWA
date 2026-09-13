import { useEffect, useState, type ReactNode } from 'react';
import { findExampleSentences } from '@/data/sentences';
import type { SentenceRecord } from '@/data/types';
import { levelLabel, levelOf, TRACK_LABELS } from '@/data/hsk';
import { useSettings } from '@/db/settings';
import type { Word } from '@/domain/types';
import { useWordSpeaker } from '@/services/speech/wordSpeaker';
import { AudioButton } from '@/ui/AudioButton';
import { PinyinText } from '@/ui/PinyinText';
import { posLabel } from './wordFactory';
import { WordImage } from './WordImage';

interface WordIntroCardProps {
  word: Word;
  /** Play the word once when shown. */
  autoPlay?: boolean;
  actions?: ReactNode;
}

/** Aligns "NGÂN HÀNG" with 银行 character by character when the counts match. */
function hanvietPairs(word: Word): { char: string; reading: string }[] | null {
  const chars = [...word.simplified];
  const readings = word.hanViet.split(' ').filter(Boolean);
  if (!word.hanViet || readings.length !== chars.length) return null;
  return chars.map((char, index) => ({ char, reading: readings[index] ?? '' }));
}

function useExamples(word: Word): SentenceRecord[] {
  const [loaded, setLoaded] = useState<{ wordId: string; examples: SentenceRecord[] } | null>(null);
  const stored = word.examples.length > 0;

  useEffect(() => {
    if (stored) return;
    let active = true;
    const level = word.hsk.hsk3 ?? word.hsk.hsk3Newest ?? word.hsk.hsk2 ?? 3;
    findExampleSentences(word.simplified, level, 2)
      .then((examples) => {
        if (active) setLoaded({ wordId: word.id, examples });
      })
      .catch(() => {
        if (active) setLoaded({ wordId: word.id, examples: [] });
      });
    return () => {
      active = false;
    };
  }, [word.id, word.simplified, word.hsk, stored]);

  if (stored) return word.examples.map((example) => ({ zh: example.zh, en: example.en ?? example.vi ?? '', ids: [] }));
  return loaded?.wordId === word.id ? loaded.examples : [];
}

/** Presentation of a word for learning: characters, tones, Hán-Việt, meanings, measure words, examples. */
export function WordIntroCard({ word, autoPlay = false, actions }: WordIntroCardProps) {
  const settings = useSettings();
  const { sayWord, saySentence } = useWordSpeaker();
  const examples = useExamples(word);
  const pairs = hanvietPairs(word);
  const level = levelOf(word.hsk, settings.hskTrack);

  useEffect(() => {
    if (!autoPlay) return;
    const controller = new AbortController();
    sayWord(word, false, controller.signal).catch(() => {});
    return () => controller.abort();
  }, [autoPlay, sayWord, word]);

  return (
    <article className="space-y-5" data-word-id={word.id}>
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-3">
            <span className="font-hanzi text-6xl leading-none text-fg sm:text-7xl">{word.simplified}</span>
            {word.traditional && <span className="font-hanzi pb-1 text-2xl text-muted">({word.traditional})</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PinyinText pinyin={word.pinyinNum} className="text-2xl font-semibold" />
            <AudioButton label="Nghe" onPlay={() => sayWord(word)} className="size-10 bg-primary/10 text-primary" />
            <button type="button" onClick={() => void sayWord(word, true).catch(() => {})} className="text-sm text-sub hover:text-fg">
              Nghe chậm
            </button>
          </div>
          {pairs ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label={`Hán Việt: ${word.hanViet}`}>
              {pairs.map((pair, index) => (
                <span key={index} className="flex flex-col items-center rounded-lg bg-surface-2 px-3 py-1.5">
                  <span className="font-hanzi text-lg text-fg">{pair.char}</span>
                  <span className="text-xs font-semibold tracking-wide text-accent">{pair.reading}</span>
                </span>
              ))}
              {word.cognate && (
                <span className="self-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">≈ Hán Việt</span>
              )}
            </div>
          ) : (
            word.hanViet && <p className="mt-3 text-sm font-semibold text-accent">Hán Việt: {word.hanViet}</p>
          )}
        </div>
        <WordImage word={word} className="size-32 shrink-0 sm:size-40" />
      </div>

      <div>
        <ul className="space-y-1">
          {word.meaningVi.slice(0, 3).map((meaning) => (
            <li key={meaning} className="text-lg font-medium text-fg">
              {meaning}
            </li>
          ))}
        </ul>
        {word.meaningEn.length > 0 && <p className="mt-1 text-sm text-sub">{word.meaningEn.slice(0, 2).join('; ')}</p>}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {word.pos.slice(0, 3).map((pos) => (
          <span key={pos} className="rounded-full border border-line px-2 py-0.5 text-sub">
            {posLabel(pos)}
          </span>
        ))}
        {word.classifiers.length > 0 && (
          <span className="rounded-full border border-line px-2 py-0.5 text-sub">
            Lượng từ: <span className="font-hanzi text-fg">{word.classifiers.join('、')}</span>
          </span>
        )}
        {level !== undefined && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            {TRACK_LABELS[settings.hskTrack]} · {levelLabel(level)}
          </span>
        )}
      </div>

      {examples.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase">Câu ví dụ</p>
          {examples.map((example) => (
            <div key={example.zh} className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3">
              <AudioButton label="Nghe câu ví dụ" size="sm" onPlay={() => saySentence(example.zh)} className="mt-1 text-sub" />
              <div className="min-w-0">
                <p className="font-hanzi text-lg text-fg">{example.zh}</p>
                {example.en && <p className="text-sm text-sub">{example.en}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {word.context?.sentence && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase">Câu bạn đã gặp từ này</p>
          <div className="flex items-start gap-3 rounded-xl bg-surface-2/60 p-3">
            <AudioButton
              label="Nghe câu đã lưu"
              size="sm"
              onPlay={() => saySentence(word.context?.sentence ?? '')}
              className="mt-1 text-sub"
            />
            <div className="min-w-0">
              <p className="font-hanzi text-lg text-fg">{word.context.sentence}</p>
              {word.context.sentenceVi && <p className="text-sm text-sub">{word.context.sentenceVi}</p>}
            </div>
          </div>
        </div>
      )}

      {actions}
    </article>
  );
}
