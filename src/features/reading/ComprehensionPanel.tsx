import { useState } from 'react';
import type { ComprehensionQuestion } from '@/domain/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/form';

function QuestionItem({ question, answered, onAnswered }: { question: ComprehensionQuestion; answered: boolean; onAnswered: () => void }) {
  const [typed, setTyped] = useState('');
  const [revealed, setRevealed] = useState(answered);
  const [picked, setPicked] = useState<string | null>(answered ? question.answerZh : null);

  if (question.type === 'mcq' && question.options && question.options.length > 0) {
    return (
      <div className="space-y-2">
        <p className="font-hanzi text-lg text-fg">{question.qZh}</p>
        <p className="text-sm text-sub" lang="vi">
          {question.qVi}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options.map((option) => {
            const right = option === question.answerZh || option === question.answerVi;
            const state =
              picked === null
                ? 'border-line hover:bg-surface-2'
                : right
                  ? 'border-success bg-success/15'
                  : picked === option
                    ? 'border-danger bg-danger/15'
                    : 'border-line opacity-60';
            return (
              <button
                key={option}
                type="button"
                disabled={picked !== null}
                onClick={() => {
                  setPicked(option);
                  if (right) onAnswered();
                }}
                className={`rounded-xl border px-3 py-2 text-left text-fg transition ${state}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-hanzi text-lg text-fg">{question.qZh}</p>
      <p className="text-sm text-sub" lang="vi">
        {question.qVi}
      </p>
      <div className="flex flex-wrap gap-2">
        <TextInput
          aria-label="Câu trả lời của bạn"
          lang="zh-CN"
          value={typed}
          disabled={revealed}
          onChange={(event) => setTyped(event.target.value)}
          className="font-hanzi min-w-48 flex-1"
        />
        <Button
          onClick={() => {
            setRevealed(true);
            onAnswered();
          }}
          disabled={revealed || !typed.trim()}
        >
          Xem đáp án mẫu
        </Button>
      </div>
      {revealed && (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <p className="font-hanzi text-fg">{question.answerZh}</p>
          <p className="text-sub" lang="vi">
            {question.answerVi}
          </p>
        </div>
      )}
    </div>
  );
}

interface ComprehensionPanelProps {
  questions: readonly ComprehensionQuestion[];
  title?: string;
  description?: string;
  answered?: readonly number[];
  /** Called once per question, the first time it is answered. */
  onAnswered: (index: number) => void;
}

/** Comprehension questions for a text or a dialogue. */
export function ComprehensionPanel({ questions, title = 'Câu hỏi', description, answered = [], onAnswered }: ComprehensionPanelProps) {
  const [done, setDone] = useState<number[]>(() => [...answered]);
  if (questions.length === 0) return null;

  return (
    <Card title={title} description={description}>
      <div className="space-y-5">
        {questions.map((question, index) => (
          <QuestionItem
            key={index}
            question={question}
            answered={done.includes(index)}
            onAnswered={() => {
              if (done.includes(index)) return;
              setDone((previous) => [...previous, index]);
              onAnswered(index);
            }}
          />
        ))}
      </div>
    </Card>
  );
}
