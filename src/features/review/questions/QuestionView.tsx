import type { QuestionViewProps } from '../session/types';
import { ChoiceQuestionView } from './ChoiceQuestionView';
import { DictationQuestionView } from './DictationQuestionView';
import { ImeClozeView } from './ImeClozeView';
import { MatchQuestionView } from './MatchQuestionView';
import { OrderQuestionView } from './OrderQuestionView';
import { PinyinQuestionView } from './PinyinQuestionView';
import { SpeakQuestionView } from './SpeakQuestionView';
import { WritingQuestionView } from './WritingQuestionView';

/** Renders the view for the current question type. */
export function QuestionView(props: QuestionViewProps) {
  const { question } = props;
  switch (question.kind) {
    case 'choice':
      return <ChoiceQuestionView {...props} question={question} />;
    case 'pinyin':
      return <PinyinQuestionView {...props} question={question} />;
    case 'ime-cloze':
      return <ImeClozeView {...props} question={question} />;
    case 'order':
      return <OrderQuestionView {...props} question={question} />;
    case 'dictation':
      return <DictationQuestionView {...props} question={question} />;
    case 'match':
      return <MatchQuestionView {...props} question={question} />;
    case 'writing':
      return <WritingQuestionView {...props} question={question} />;
    case 'speak':
      return <SpeakQuestionView {...props} question={question} />;
  }
}
