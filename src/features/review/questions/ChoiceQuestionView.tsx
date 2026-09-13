import { useEffect, useState } from 'react';
import type { ChoiceQuestion, QuestionOption } from '@/features/review/engine/questions';
import { WordImage } from '@/features/vocab/WordImage';
import { PinyinText } from '@/ui/PinyinText';
import type { QuestionViewProps } from '../session/types';
import { AudioPrompt } from './AudioPrompt';
import { ChoiceGrid } from './ChoiceGrid';

function Prompt({ question, revealed, onPlayPrompt }: { question: ChoiceQuestion; revealed: boolean; onPlayPrompt: (slow?: boolean) => void }) {
  const { word } = question;
  switch (question.prompt) {
    case 'audio':
      return <AudioPrompt onPlay={onPlayPrompt} />;
    case 'image':
      return (
        <div className="my-4 flex justify-center">
          <WordImage word={word} className="size-48" />
        </div>
      );
    case 'meaning':
      return (
        <p className="my-6 text-center text-2xl font-semibold text-fg" lang="vi">
          {word.meaningVi.slice(0, 2).join('; ')}
        </p>
      );
    case 'classifier':
      return (
        <div className="my-6 text-center">
          <p className="font-hanzi text-4xl text-fg">
            一 <span className="text-primary">＿</span> {word.simplified}
          </p>
          <p className="mt-2 text-sub">{word.meaningVi[0]}</p>
        </div>
      );
    default:
      return (
        <div className="my-6 text-center">
          <p className="font-hanzi text-6xl leading-tight text-fg">{word.simplified}</p>
          {(question.showPinyin || revealed) && <PinyinText pinyin={word.pinyinNum} className="mt-2 block text-xl" />}
        </div>
      );
  }
}

function optionLabel(question: ChoiceQuestion, option: QuestionOption, revealed: boolean) {
  switch (question.optionKind) {
    case 'hanzi':
      return (
        <span className="flex flex-col">
          <span className="font-hanzi text-2xl text-fg">{option.value}</span>
          {(question.showPinyin || revealed) && option.pinyinNum && <PinyinText pinyin={option.pinyinNum} className="text-sm" />}
        </span>
      );
    case 'pinyin':
      return <PinyinText pinyin={option.value} className="text-xl font-medium" />;
    case 'classifier':
      return <span className="font-hanzi text-2xl text-fg">{option.value}</span>;
    default:
      return <span lang="vi">{option.value}</span>;
  }
}

/** Multiple choice for every recognition question (meanings, characters, pinyin, measure words). */
export function ChoiceQuestionView({ question, answered, pinyinRevealed, onAnswer, onPlayPrompt }: QuestionViewProps<ChoiceQuestion>) {
  const [selected, setSelected] = useState<string | undefined>();

  useEffect(() => {
    if (answered) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !/^[1-4]$/.test(event.key)) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const option = question.options[Number(event.key) - 1];
      if (!option) return;
      event.preventDefault();
      setSelected(option.id);
      onAnswer({ correct: option.id === question.answerId, given: option.value });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answered, question, onAnswer]);

  return (
    <div>
      <Prompt question={question} revealed={pinyinRevealed} onPlayPrompt={onPlayPrompt} />
      <ChoiceGrid
        options={question.options.map((option) => ({
          id: option.id,
          label: optionLabel(question, option, pinyinRevealed || Boolean(answered)),
          ariaLabel: option.value,
        }))}
        answerId={question.answerId}
        selectedId={answered ? (selected ?? '') : undefined}
        onSelect={(id) => {
          setSelected(id);
          const option = question.options.find((item) => item.id === id);
          onAnswer({ correct: id === question.answerId, given: option?.value });
        }}
      />
    </div>
  );
}
