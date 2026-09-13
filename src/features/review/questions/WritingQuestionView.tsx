import { useState } from 'react';
import { toast } from 'sonner';
import { useSettings } from '@/db/settings';
import type { WritingQuestion } from '@/features/review/engine/questions';
import { gradeSentenceUse } from '@/services/ai/gemini';
import { Button } from '@/ui/Button';
import { PinyinText } from '@/ui/PinyinText';
import type { QuestionViewProps } from '../session/types';

/** Writes a sentence with the word; Gemini grades it (docs/PLAN.md §5.3). */
export function WritingQuestionView({ question, answered, onAnswer, onFallback }: QuestionViewProps<WritingQuestion>) {
  const settings = useSettings();
  const [typed, setTyped] = useState('');
  const [grading, setGrading] = useState(false);
  const { word } = question;

  const submit = async () => {
    if (answered || grading || !typed.trim()) return;
    setGrading(true);
    try {
      const grade = await gradeSentenceUse({
        apiKey: settings.geminiApiKey,
        model: settings.geminiTextModel,
        word,
        sentence: typed.trim(),
      });
      onAnswer({
        correct: grade.score >= 0.6,
        given: typed.trim(),
        signal: { score: grade.score },
        feedback: [grade.feedbackVi, grade.corrected && `Gợi ý: ${grade.corrected}`].filter(Boolean).join(' '),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không chấm được câu.');
      onFallback?.();
    } finally {
      setGrading(false);
    }
  };

  return (
    <div>
      <p className="mb-2 text-center text-sm text-muted">Đặt một câu tiếng Trung có dùng từ này</p>
      <div className="my-4 text-center">
        <p className="font-hanzi text-5xl text-fg">{word.simplified}</p>
        <PinyinText pinyin={word.pinyinNum} className="mt-1 block text-lg" />
        <p className="mt-1 text-sub" lang="vi">
          {word.meaningVi.slice(0, 2).join('; ')}
        </p>
      </div>
      {question.example && !answered && (
        <p className="mb-4 text-center text-sm text-muted">
          Mẫu: <span className="font-hanzi text-fg">{question.example.zh}</span>
        </p>
      )}
      <textarea
        aria-label="Câu của bạn"
        lang="zh-CN"
        rows={3}
        value={typed}
        disabled={Boolean(answered) || grading}
        autoFocus
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || answered) return;
          event.preventDefault();
          event.stopPropagation();
          void submit();
        }}
        className="font-hanzi w-full rounded-xl border border-line bg-surface-2 p-3 text-lg text-fg outline-none transition focus:border-primary disabled:opacity-60"
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <Button onClick={() => void submit()} disabled={Boolean(answered) || grading || !typed.trim()}>
          {grading ? 'Đang chấm…' : 'Nộp bài'}
        </Button>
        <Button variant="ghost" onClick={onFallback} disabled={Boolean(answered) || grading}>
          Đổi dạng câu hỏi
        </Button>
      </div>
    </div>
  );
}
