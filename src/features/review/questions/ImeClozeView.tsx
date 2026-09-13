import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { gradeHanzi } from '@/features/review/engine/grading';
import type { ImeClozeQuestion } from '@/features/review/engine/questions';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/form';
import { PinyinText } from '@/ui/PinyinText';
import type { QuestionViewProps } from '../session/types';

/** Types the missing word in a sentence with a Chinese IME. */
export function ImeClozeView({ question, answered, hints, pinyinRevealed, onHint, onAnswer }: QuestionViewProps<ImeClozeQuestion>) {
  const [typed, setTyped] = useState('');
  const { word, cloze } = question;
  const showPinyin = pinyinRevealed || hints > 0;

  const submit = () => {
    if (answered || !typed.trim()) return;
    onAnswer({ correct: gradeHanzi(typed, question.answers), given: typed.trim() });
  };

  return (
    <div>
      <p className="mb-2 text-center text-sm text-muted">Gõ chữ Hán còn thiếu (cần bộ gõ tiếng Trung)</p>
      <p className="my-5 text-center">
        <span className="font-hanzi text-3xl leading-relaxed text-fg">
          {cloze.before}
          <span className="mx-1 border-b-2 border-primary px-6 text-primary">{answered ? word.simplified : '　'}</span>
          {cloze.after}
        </span>
        {cloze.sentence.en && <span className="mt-2 block text-sm text-sub">{cloze.sentence.en}</span>}
      </p>
      <p className="mb-5 text-center text-lg font-medium text-fg" lang="vi">
        {word.meaningVi.slice(0, 2).join('; ')}
        {showPinyin && <PinyinText pinyin={word.pinyinNum} className="ml-2 text-base text-sub" />}
      </p>

      <div className="flex flex-wrap gap-2">
        <TextInput
          aria-label="Chữ Hán còn thiếu"
          lang="zh-CN"
          value={typed}
          disabled={Boolean(answered)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="font-hanzi min-w-40 flex-1 text-lg"
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
        <Button variant="ghost" onClick={onHint} disabled={Boolean(answered) || showPinyin} title="Phím H">
          <Lightbulb className="size-4" aria-hidden /> Hiện pinyin
        </Button>
      </div>
    </div>
  );
}
