import { Mic, MicOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { lookupHeadword } from '@/data/dictionary';
import type { SpeakQuestion } from '@/features/review/engine/questions';
import { scoreUtterance, type SyllableMark, type UtteranceScore } from '@/features/speaking/scoreUtterance';
import { listenOnce, recognitionSupport } from '@/services/speech/recognition';
import { Button } from '@/ui/Button';
import { PinyinText } from '@/ui/PinyinText';
import type { QuestionViewProps } from '../session/types';
import { AudioPrompt } from './AudioPrompt';

const MARK_CLASS: Record<SyllableMark, string> = {
  match: 'bg-success/20 text-success',
  homophone: 'bg-warning/20 text-warning',
  wrong: 'bg-danger/20 text-danger',
  missing: 'bg-surface-2 text-muted',
};

const MARK_LABEL: Record<SyllableMark, string> = {
  match: 'đúng chữ',
  homophone: 'đúng âm, khác chữ',
  wrong: 'khác âm',
  missing: 'chưa nghe thấy',
};

/** Readings for what the recogniser heard, so homophones can be told apart. */
async function readingsFor(texts: readonly string[]): Promise<Map<string, string>> {
  const readings = new Map<string, string>();
  await Promise.all(
    [...new Set(texts)].map(async (text) => {
      const [entry] = await lookupHeadword(text).catch(() => []);
      if (entry) {
        readings.set(text, entry.p);
        return;
      }
      // Fall back to per-character readings for whole sentences.
      const perChar = await Promise.all([...text].map((char) => lookupHeadword(char).catch(() => [])));
      readings.set(text, perChar.map(([item]) => item?.p ?? '').filter(Boolean).join(' '));
    }),
  );
  return readings;
}

/** Say the word; the recogniser judges characters only, never tones (docs/PLAN.md §8.4). */
export function SpeakQuestionView({ question, answered, pinyinRevealed, onAnswer, onPlayPrompt }: QuestionViewProps<SpeakQuestion>) {
  const [support] = useState(() => recognitionSupport());
  const [listening, setListening] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const [score, setScore] = useState<UtteranceScore | null>(null);
  const { word } = question;
  const target =
    question.mode === 'sentence' && question.sentence
      ? { hanzi: question.sentence.zh, pinyinNum: '' }
      : { hanzi: word.simplified, pinyinNum: word.pinyinNum };

  const listen = async () => {
    if (answered || listening) return;
    setListening(true);
    try {
      const alternatives = await listenOnce({ maxAlternatives: 5 });
      const readings = await readingsFor(alternatives);
      const result = scoreUtterance(target, alternatives, { readingOf: (text) => readings.get(text) ?? '', attempt });
      setScore(result);
      // The characters must match to pass on the first try; a homophone earns a second go.
      if (result.charMatch || attempt >= 2) {
        onAnswer({
          correct: result.charMatch || result.tonelessSyllableMatch,
          given: result.best || '(không nghe thấy)',
          signal: { attempts: attempt },
        });
      } else {
        setAttempt(2);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không dùng được micro.');
    } finally {
      setListening(false);
    }
  };

  return (
    <div>
      {question.mode === 'echo' ? (
        <AudioPrompt onPlay={onPlayPrompt} label="Nghe mẫu" />
      ) : (
        <div className="my-6 text-center">
          {question.mode === 'from-meaning' ? (
            <p className="text-2xl font-semibold text-fg" lang="vi">
              {word.meaningVi.slice(0, 2).join('; ')}
            </p>
          ) : question.mode === 'sentence' && question.sentence ? (
            <>
              <p className="text-lg text-sub" lang="vi">
                {question.sentence.en || word.meaningVi[0]}
              </p>
              <p className="font-hanzi mt-2 text-3xl text-fg">{question.sentence.zh}</p>
            </>
          ) : (
            <p className="font-hanzi text-6xl text-fg">{word.simplified}</p>
          )}
          {(pinyinRevealed || Boolean(answered)) && <PinyinText pinyin={word.pinyinNum} className="mt-2 block text-xl" />}
        </div>
      )}

      <p className="mb-4 text-center text-sm text-muted">
        {question.mode === 'echo' ? 'Nghe rồi nhắc lại' : 'Nói thành tiếng'}
        {attempt === 2 && !answered && ' · thử lại lần cuối'}
      </p>

      {support.supported ? (
        <div className="flex flex-col items-center gap-3">
          <Button size="lg" onClick={() => void listen()} disabled={Boolean(answered) || listening}>
            <Mic className={`size-5 ${listening ? 'animate-pulse' : ''}`} aria-hidden />
            {listening ? 'Đang nghe…' : 'Bấm rồi nói'}
          </Button>
          <p className="max-w-md text-center text-xs text-muted">
            Máy chỉ so chữ, <strong>không nghe được thanh điệu</strong>. Luyện thanh ở mục Phát âm. {support.note}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="flex items-center gap-2 text-sm text-warning">
            <MicOff className="size-4" aria-hidden /> {support.note}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => onAnswer({ correct: true, given: 'tự đánh giá: nói được', signal: { attempts: 1 } })} disabled={Boolean(answered)}>
              Tôi nói được
            </Button>
            <Button
              variant="outline"
              onClick={() => onAnswer({ correct: false, given: 'tự đánh giá: chưa được', signal: { attempts: 2 } })}
              disabled={Boolean(answered)}
            >
              Chưa được
            </Button>
          </div>
        </div>
      )}

      {score && (
        <div className="mt-5 space-y-2 text-center">
          <p className="text-sm text-sub">
            Máy nghe được: <span className="font-hanzi text-fg">{score.best || '(không có)'}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[...target.hanzi].map((char, index) => {
              const mark = score.perSyllable[index] ?? 'missing';
              return (
                <span key={index} className={`font-hanzi rounded-lg px-2 py-1 text-lg ${MARK_CLASS[mark]}`} title={MARK_LABEL[mark]}>
                  {char}
                </span>
              );
            })}
          </div>
          {score.tonelessSyllableMatch && !score.charMatch && (
            <p className="text-xs text-warning">Đúng âm nhưng máy nghe ra chữ khác — có thể do đồng âm.</p>
          )}
        </div>
      )}
    </div>
  );
}
