import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { pinyinToMarks } from '@/chinese/pinyin';
import { useSettings } from '@/db/settings';
import { gradePinyin, initialsHint } from '@/features/review/engine/grading';
import type { PinyinQuestion } from '@/features/review/engine/questions';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/form';
import type { QuestionViewProps } from '../session/types';
import { AudioPrompt } from './AudioPrompt';

/** Typing pinyin, either from the characters (read) or from audio (dictation). */
export function PinyinQuestionView({ question, answered, hints, onHint, onAnswer, onPlayPrompt }: QuestionViewProps<PinyinQuestion>) {
  const { tonelessEasyMode } = useSettings();
  const [typed, setTyped] = useState('');
  const dictation = question.type === 'pinyin-dictation';
  const { word } = question;

  const submit = () => {
    if (answered || !typed.trim()) return;
    const grade = gradePinyin(typed, question.accepted, tonelessEasyMode);
    onAnswer({
      correct: grade.correct,
      given: typed.trim(),
      signal: { toneOnlyError: grade.toneOnlyError, easyMode: tonelessEasyMode },
    });
  };

  return (
    <div>
      {dictation ? (
        <AudioPrompt onPlay={onPlayPrompt} />
      ) : (
        <div className="my-6 text-center">
          <p className="font-hanzi text-6xl leading-tight text-fg">{word.simplified}</p>
          <p className="mt-2 text-sub" lang="vi">
            {word.meaningVi.slice(0, 2).join('; ')}
          </p>
        </div>
      )}

      {question.cloze && !dictation && (
        <p className="mb-5 rounded-xl bg-surface-2/60 p-3 text-center">
          <span className="font-hanzi text-lg text-fg">
            {question.cloze.before}
            <span className="text-primary">＿＿</span>
            {question.cloze.after}
          </span>
          {question.cloze.sentence.en && <span className="mt-1 block text-sm text-sub">{question.cloze.sentence.en}</span>}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <TextInput
          aria-label={dictation ? 'Pinyin của từ vừa nghe' : 'Pinyin của từ này'}
          placeholder="Ví dụ: ni3 hao3 hoặc nǐ hǎo"
          value={typed}
          disabled={Boolean(answered)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="min-w-48 flex-1"
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing || answered) return;
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        />
        <Button onClick={submit} disabled={Boolean(answered) || !typed.trim()}>
          Kiểm tra
        </Button>
        <Button variant="ghost" onClick={onHint} disabled={Boolean(answered)} title="Phím H">
          <Lightbulb className="size-4" aria-hidden /> Gợi ý
        </Button>
      </div>

      {hints > 0 && !answered && (
        <p className="mt-3 text-sm text-sub">
          Thanh mẫu: <span className="font-semibold text-fg">{initialsHint(question.accepted[0] ?? '')}</span>
          {tonelessEasyMode && ' · đang bật chế độ bỏ qua thanh điệu'}
        </p>
      )}

      {answered && (
        <p className="mt-4 text-center text-lg">
          Đáp án: <strong className="text-fg">{pinyinToMarks(question.accepted[0] ?? word.pinyinNum)}</strong>
        </p>
      )}
    </div>
  );
}
