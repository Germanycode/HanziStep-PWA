import { BookmarkPlus, Check, PenTool, Scissors, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { hanvietReading } from '@/chinese/hanviet';
import { lookupHeadword } from '@/data/dictionary';
import { loadHanvietData } from '@/data/hanvietData';
import { levelLabel, loadHskIndex } from '@/data/hsk';
import { db } from '@/db/db';
import { useSettings } from '@/db/settings';
import type { DictEntry } from '@/domain/types';
import { markWordKnown, saveWordForLater } from '@/features/vocab/repository';
import { wordFromDictEntry } from '@/features/vocab/wordFactory';
import { announceActivity } from '@/progress/announce';
import { generateText } from '@/services/ai/gemini';
import { useWordSpeaker } from '@/services/speech/wordSpeaker';
import { AudioButton } from '@/ui/AudioButton';
import { Button } from '@/ui/Button';
import { PinyinText } from '@/ui/PinyinText';
import type { RenderToken } from './pipeline';
import { HanziCanvas } from '@/features/writing/HanziCanvas';

export interface PopoverTarget {
  token: RenderToken;
  /** Candidate words starting at this token, longest first. */
  candidates: string[];
  sentenceIndex: number;
  sentence: string;
  sentenceVi?: string;
  anchor: DOMRect;
}

interface WordPopoverProps {
  target: PopoverTarget;
  textId: string;
  onClose: () => void;
  onSplit: (span: [number, number]) => void;
  onMerge: (span: [number, number]) => void;
  onChanged: () => void;
}

interface LoadedEntry {
  word: string;
  entries: DictEntry[];
  hanViet: string;
  level?: number;
}

const EXPLAIN_CACHE_KIND = 'explain';
const EXPLAIN_PROMPT_VERSION = 2;
const POPOVER_WIDTH = 340;
const POPOVER_HEIGHT = 320;

function position(anchor: DOMRect): { top: number; left: number } {
  const left = Math.min(Math.max(8, anchor.left), Math.max(8, window.innerWidth - POPOVER_WIDTH - 8));
  const below = anchor.bottom + 8;
  const fitsBelow = below + POPOVER_HEIGHT < window.innerHeight;
  return { top: fitsBelow ? below : Math.max(8, anchor.top - POPOVER_HEIGHT - 8), left };
}

function normalizedPinyin(value: string): string {
  return value.toLowerCase().replaceAll('ü', 'v').replaceAll('u:', 'v').replace(/[^a-zv0-9]/g, '');
}

export function entryForContext(entries: readonly DictEntry[], contextPinyin?: string): DictEntry | undefined {
  const reading = normalizedPinyin(contextPinyin ?? '');
  return (reading ? entries.find((candidate) => normalizedPinyin(candidate.p) === reading) : undefined) ?? entries[0];
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Word lookup on tap: every length, the full entry, and the actions from docs/PLAN.md §7.3. */
export function WordPopover({ target, textId, onClose, onSplit, onMerge, onChanged }: WordPopoverProps) {
  const settings = useSettings();
  const { sayWord } = useWordSpeaker();
  const [picked, setPicked] = useState<{ key: string; word: string } | null>(null);
  const [loaded, setLoaded] = useState<LoadedEntry | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [strokeView, setStrokeView] = useState<{ word: string; index: number } | null>(null);

  // Derived, so switching words never needs a state reset inside an effect.
  const targetKey = `${target.sentenceIndex}:${target.token.start}`;
  const selected = picked?.key === targetKey ? picked.word : (target.candidates[0] ?? target.token.text);
  const contextPinyin = selected === target.token.text ? target.token.pinyinNum : '';
  const strokeCharacters = [...selected].filter((character) => /\p{Script=Han}/u.test(character));
  const strokeCharacter = strokeView?.word === selected ? strokeCharacters[strokeView.index] : undefined;

  useEffect(() => {
    let active = true;
    Promise.all([
      lookupHeadword(selected),
      loadHanvietData().catch(() => null),
      loadHskIndex(settings.hskTrack).catch(() => null),
    ]).then(
      ([entries, hanvietData, hskIndex]) => {
        if (!active) return;
        const entry = entryForContext(entries, contextPinyin);
        const hanViet =
          entry && hanvietData ? hanvietReading(hanvietData, entry.t, entry.p, { context: entry.vi.join('; ') }).best : '';
        setLoaded({ word: selected, entries, hanViet, level: hskIndex?.get(selected) });
      },
      () => {
        if (active) setLoaded({ word: selected, entries: [], hanViet: '' });
      },
    );
    return () => {
      active = false;
    };
  }, [selected, contextPinyin, settings.hskTrack]);

  const current = loaded?.word === selected ? loaded : null;
  const entry = entryForContext(current?.entries ?? [], contextPinyin);
  const explanationKey = `${selected}:${normalizedPinyin(contextPinyin || entry?.p || '')}:${shortHash(target.sentence)}:${settings.geminiTextModel}:v${EXPLAIN_PROMPT_VERSION}`;
  const explanation = explanations[explanationKey];

  const save = async () => {
    if (!entry) return;
    setBusy(true);
    try {
      const hanvietData = await loadHanvietData().catch(() => null);
      const word = wordFromDictEntry(entry, hanvietData, Date.now(), 'reader');
      word.context = { sentence: target.sentence, sentenceVi: target.sentenceVi, textId };
      const { created, activity } = await saveWordForLater(word);
      if (activity) announceActivity(activity, `Lưu từ ${word.simplified}`);
      else toast(created ? 'Đã lưu từ.' : 'Từ này đã có trong danh sách của bạn.');
      onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được từ.');
    } finally {
      setBusy(false);
    }
  };

  const markKnown = async () => {
    if (!entry) return;
    setBusy(true);
    try {
      const hanvietData = await loadHanvietData().catch(() => null);
      await markWordKnown(wordFromDictEntry(entry, hanvietData, Date.now(), 'reader'));
      toast(`Đã đánh dấu “${selected}” là từ đã biết.`);
      onChanged();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được.');
    } finally {
      setBusy(false);
    }
  };

  const explain = async () => {
    const key = `${EXPLAIN_CACHE_KIND}:${explanationKey}`;
    setBusy(true);
    try {
      const cached = await db.caches.get(key);
      if (typeof cached?.value === 'string') {
        setExplanations((previous) => ({ ...previous, [explanationKey]: cached.value as string }));
        return;
      }
      const text = await generateText({
        apiKey: settings.geminiApiKey,
        model: settings.geminiTextModel,
        temperature: 0.3,
        prompt: [
          `Giải thích ngắn gọn cho người Việt mới học tiếng Trung từ "${selected}" trong câu: "${target.sentence}".`,
          'Tối đa 3 câu tiếng Việt: nghĩa trong câu này, sắc thái hoặc cách dùng, và một lưu ý nếu dễ nhầm.',
          'Không dùng markdown.',
        ].join('\n'),
      });
      const now = Date.now();
      await db.caches.put({ key, kind: EXPLAIN_CACHE_KIND, value: text, createdAt: now, expiresAt: now + 365 * 24 * 3600 * 1000 });
      setExplanations((previous) => ({ ...previous, [explanationKey]: text }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không giải thích được.');
    } finally {
      setBusy(false);
    }
  };

  const { top, left } = position(target.anchor);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={`Tra từ ${selected}`}
        style={{ top, left, width: POPOVER_WIDTH }}
        className="fixed z-50 max-h-80 overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-2xl"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {target.candidates.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setPicked({ key: targetKey, word: candidate })}
                className={`font-hanzi rounded-lg px-2 py-1 text-lg transition ${
                  selected === candidate ? 'bg-primary/20 text-fg' : 'bg-surface-2 text-sub hover:text-fg'
                }`}
              >
                {candidate}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-muted hover:text-fg">
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {!current ? (
          <p className="text-sm text-sub">Đang tra…</p>
        ) : !entry ? (
          <p className="text-sm text-sub">Không có trong từ điển.</p>
        ) : (
          <div className="space-y-2">
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="font-hanzi text-2xl text-fg">{entry.s}</span>
              {entry.t !== entry.s && <span className="font-hanzi text-sm text-muted">{entry.t}</span>}
              <PinyinText pinyin={contextPinyin || entry.p} className="text-base" />
              <AudioButton
                label={`Nghe ${entry.s}`}
                onPlay={() => sayWord({ simplified: entry.s, pinyinNum: contextPinyin || entry.p })}
                className="text-sub"
              />
              <button
                type="button"
                onClick={() => void sayWord({ simplified: entry.s, pinyinNum: contextPinyin || entry.p }, true).catch(() => {})}
                className="text-xs text-sub hover:text-fg"
              >
                chậm
              </button>
            </p>
            {contextPinyin && contextPinyin !== entry.p && (
              <p className="text-xs text-muted">
                Từ điển: <PinyinText pinyin={entry.p} colored={false} className="text-xs" />
              </p>
            )}
            {current.hanViet && <p className="text-sm font-semibold text-accent">{current.hanViet}</p>}
            <p className="text-sm text-fg" lang="vi">
              {entry.vi.slice(0, 4).join('; ') || '—'}
            </p>
            {entry.en.length > 0 && <p className="text-xs text-sub">{entry.en.slice(0, 3).join('; ')}</p>}
            <p className="flex flex-wrap gap-2 text-xs text-muted">
              {entry.cl.length > 0 && <span>Lượng từ: {entry.cl.join('、')}</span>}
              {current.level !== undefined && (
                <span className="rounded-full bg-primary/10 px-2 text-primary">{levelLabel(current.level)}</span>
              )}
            </p>
            {explanation && <p className="rounded-xl bg-surface-2 p-2 text-sm text-fg">{explanation}</p>}
            {strokeCharacter && (
              <div className="space-y-2">
                {strokeCharacters.length > 1 && (
                  <div className="flex justify-center gap-2" aria-label="Chọn chữ để xem nét">
                    {strokeCharacters.map((character, index) => (
                      <Button
                        key={`${character}-${index}`}
                        size="sm"
                        variant={strokeView?.index === index ? 'primary' : 'outline'}
                        aria-label={`Xem nét chữ ${character}`}
                        onClick={() => setStrokeView({ word: selected, index })}
                      >
                        <span className="font-hanzi text-lg">{character}</span>
                      </Button>
                    ))}
                  </div>
                )}
                <HanziCanvas character={strokeCharacter} mode="animate" />
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <Button size="sm" onClick={() => void save()} disabled={busy || !entry}>
            <BookmarkPlus className="size-4" aria-hidden /> Lưu từ
          </Button>
          <Button size="sm" variant="outline" onClick={() => void markKnown()} disabled={busy || !entry}>
            <Check className="size-4" aria-hidden /> Đã biết
          </Button>
          {[...target.token.text].length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => onSplit([target.token.start, target.token.start + 1])}>
              <Scissors className="size-4" aria-hidden /> Tách
            </Button>
          )}
          {selected.length > target.token.text.length && (
            <Button size="sm" variant="ghost" onClick={() => onMerge([target.token.start, target.token.start + selected.length])}>
              Gộp thành {selected}
            </Button>
          )}
          {settings.geminiApiKey && (
            <Button size="sm" variant="ghost" onClick={() => void explain()} disabled={busy}>
              <Sparkles className="size-4" aria-hidden /> Giải thích
            </Button>
          )}
          {strokeCharacters.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStrokeView((current) => current?.word === selected ? null : { word: selected, index: 0 })}
            >
              <PenTool className="size-4" aria-hidden /> Nét chữ
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
