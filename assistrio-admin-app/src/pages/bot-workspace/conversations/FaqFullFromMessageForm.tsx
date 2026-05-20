import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { postAdminKnowledgeFaq } from '@/api/adminApi';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { Button, FieldRow, Input, Textarea } from '@/components/ui';
import { appToast } from '@/lib/app-toast';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import {
  KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES,
  clampFaqQuestionLineInCombinedBudget,
  clampFaqQuestionsToCombinedUtf8Budget,
  clampStrUtf8Bytes,
  faqQuestionsCombinedUtf8Bytes,
  kbPlanLimitClientDescription,
} from '@/lib/knowledgeContentUtf8Limits';
import {
  isKnowledgeTrainingBusyError,
  knowledgeTrainingBusyConflictMessage,
} from '@/lib/knowledgeTrainingBusyConflict';
import {
  faqsToPatchPayload,
  qaFormPassesBackendNormalize,
} from '@/pages/bot-workspace/knowledge/knowledgeViewTypes';
import {
  QaFieldInfoIcon,
  QA_FIELD_ANSWER_HINT,
  QA_FIELD_QUESTIONS_HINT,
  QA_FIELD_TITLE_HINT,
} from '@/pages/bot-workspace/knowledge/knowledgeQaPageCopy';
import { KNOWLEDGE_QA_QUESTIONS_MAX } from '@/lib/botFieldLimits';

export type FaqFullFromMessageFormProps = {
  botId: string;
  initialTitle: string;
  /** First FAQ variant line — avoids unstable array identity from callers. */
  seedQuestion: string;
  initialAnswer: string;
  formId: string;
  onSaved: () => void;
  onBusyChange?: (busy: boolean) => void;
};

export function FaqFullFromMessageForm({
  botId,
  initialTitle,
  seedQuestion,
  initialAnswer,
  formId,
  onSaved,
  onBusyChange,
}: FaqFullFromMessageFormProps) {
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<string[]>(['']);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const trimmedSeed = seedQuestion.trim();
    const qs = trimmedSeed ? [trimmedSeed] : [''];
    setTitle(clampStrUtf8Bytes(initialTitle.trim(), KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES));
    setQuestions(clampFaqQuestionsToCombinedUtf8Budget(qs, KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES));
    setAnswer(clampStrUtf8Bytes(initialAnswer, KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES));
    setError('');
    setSaving(false);
    onBusyChange?.(false);
  }, [initialTitle, seedQuestion, initialAnswer, onBusyChange]);

  function setBusy(next: boolean) {
    setSaving(next);
    onBusyChange?.(next);
  }

  function setQuestionLine(i: number, v: string) {
    setQuestions((prev) =>
      clampFaqQuestionLineInCombinedBudget(prev, i, v, KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const t = title.trim();
    const qLines = questions.map((q) => q.trim()).filter(Boolean);
    const a = answer.trim();
    if (!qaFormPassesBackendNormalize(t, qLines, a)) {
      setError('Add a title or at least one question, plus a non-empty answer.');
      return;
    }
    const payload = faqsToPatchPayload([{ title: t, questions: qLines, answer: a, active: true }])[0];
    if (!payload) {
      setError('Could not build a valid FAQ payload. Check fields.');
      return;
    }
    setBusy(true);
    try {
      const res = await postAdminKnowledgeFaq(botId, payload as Record<string, unknown>);
      if (!res.ok) {
        if (isKnowledgeTrainingBusyError(res)) {
          setError(knowledgeTrainingBusyConflictMessage(res));
          return;
        }
        setError(kbPlanLimitClientDescription(res.errorCode, res.error, res.body));
        return;
      }
      appToast.success('FAQ added', { description: 'Saved to your knowledge base.' });
      requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id={formId} className="flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)}>
      <FieldRow
        label="Title (optional)"
        htmlFor={`${formId}-title`}
        labelTrailing={<QaFieldInfoIcon content={QA_FIELD_TITLE_HINT} ariaLabel="About Title" />}
        labelAddon={
          <KnowledgeUtf8Meter
            value={title}
            maxBytes={KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES}
            className="shrink-0 whitespace-nowrap"
          />
        }
      >
        <Input
          id={`${formId}-title`}
          quiet
          value={title}
          onChange={(ev) => setTitle(clampStrUtf8Bytes(ev.target.value, KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES))}
          disabled={saving}
          className="w-full min-w-0 text-sm"
          autoComplete="off"
          placeholder="Shipping and returns"
        />
      </FieldRow>

      <FieldRow
        label="Questions"
        htmlFor={`${formId}-question-0`}
        labelTrailing={<QaFieldInfoIcon content={QA_FIELD_QUESTIONS_HINT} ariaLabel="About Questions" />}
        labelAddon={
          <KnowledgeUtf8Meter
            value=""
            displayUsedBytes={faqQuestionsCombinedUtf8Bytes(questions)}
            maxBytes={KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES}
            className="shrink-0 whitespace-nowrap"
          />
        }
      >
        <div className="flex flex-col gap-2">
          {questions.map((q, i) => (
            <div key={`${formId}-q-${i}`} className="flex gap-2">
              <Input
                id={`${formId}-question-${i}`}
                quiet
                value={q}
                onChange={(ev) => setQuestionLine(i, ev.target.value)}
                disabled={saving}
                className="min-w-0 flex-1 text-sm"
                autoComplete="off"
                placeholder={i === 0 ? 'When do you ship?' : 'Another phrasing…'}
                aria-label={`Question ${i + 1}`}
              />
              {questions.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2"
                  disabled={saving}
                  title="Remove question"
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 size={16} className="text-slate-500" aria-hidden />
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="outlinePrimary"
            size="sm"
            disabled={saving || questions.length >= KNOWLEDGE_QA_QUESTIONS_MAX}
            className="gap-1 self-start font-normal shadow-none"
            onClick={() => setQuestions((prev) => [...prev, ''])}
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
            Add question
          </Button>
        </div>
      </FieldRow>

      <FieldRow
        label="Answer"
        htmlFor={`${formId}-answer`}
        required
        labelTrailing={<QaFieldInfoIcon content={QA_FIELD_ANSWER_HINT} ariaLabel="About Answer" />}
        labelAddon={
          <KnowledgeUtf8Meter
            value={answer}
            maxBytes={KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES}
            className="shrink-0 whitespace-nowrap"
          />
        }
      >
        <Textarea
          id={`${formId}-answer`}
          quiet
          rows={8}
          value={answer}
          onChange={(ev) => setAnswer(clampStrUtf8Bytes(ev.target.value, KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES))}
          disabled={saving}
          className="min-h-[10rem] text-sm"
          autoComplete="off"
          placeholder="Short factual answer the assistant can use."
        />
      </FieldRow>

      {error ? (
        <p className="m-0 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
