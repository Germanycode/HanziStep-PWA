import { useState } from 'react';
import { gradeDictation } from '@/features/review/engine/grading';
import type { DictationQuestion } from '@/features/review/engine/questions';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/form';
import type { QuestionViewProps } from '../session/types';
import { AudioPrompt } from './AudioPrompt';

/** Types a whole sentence from audio; graded by character accuracy. */
export function DictationQuestionView({ question, answered, onAnswer, onPlayPrompt }: QuestionViewProps<DictationQuestion>) {
  const [typed, setTyped] = useState('');

  const submit = () => {
    if (answered || !typed.trim()) return;
    const { accuracy, correct } = gradeDictation(typed, question.sentence.zh);
    onAnswer({ correct, given: typed.trim(), signal: { accuracy } });
  };

  return (
    <div>
      <AudioPrompt onPlay={onPlayPrompt} label="Nghe câu" />
      <p className="mb-3 text-center text-sm text-muted">Gõ lại câu vừa nghe bằng chữ Hán</p>
      <div className="flex flex-wrap gap-2">
        <TextInput
          aria-label="Câu vừa nghe"
          lang="zh-CN"
          value={typed}
          disabled={Boolean(answered)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="font-hanzi min-w-48 flex-1 text-lg"
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
      </div>
      {answered && (
        <div className="mt-4 text-center">
          <p className="font-hanzi text-xl text-fg">{question.sentence.zh}</p>
          {question.sentence.en && <p className="mt-1 text-sm text-sub">{question.sentence.en}</p>}
          <p className="mt-1 text-sm text-muted">
            Độ chính xác: {Math.round((answered.signal?.accuracy ?? 0) * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}
