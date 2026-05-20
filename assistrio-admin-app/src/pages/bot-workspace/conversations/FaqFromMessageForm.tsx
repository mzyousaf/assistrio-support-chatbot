import { useEffect, useState, type FormEvent } from 'react';
import { postAdminKnowledgeFaq } from '@/api/adminApi';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { FieldRow, Textarea } from '@/components/ui';
import { appToast } from '@/lib/app-toast';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import {
  KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES,
  clampStrUtf8Bytes,
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
import { QA_FIELD_ANSWER_HINT, QA_FIELD_QUESTIONS_HINT } from '@/pages/bot-workspace/knowledge/knowledgeQaPageCopy';

export type FaqFromMessageFormProps = {
  botId: string;
  initialQuestion: string;
  initialAnswer: string;
  formId: string;
  onSaved: () => void;
  /** For disabling external footer buttons */
  onBusyChange?: (busy: boolean) => void;
};

export function FaqFromMessageForm({
  botId,
  initialQuestion,
  initialAnswer,
  formId,
  onSaved,
  onBusyChange,
}: FaqFromMessageFormProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuestion(clampStrUtf8Bytes(initialQuestion, KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES));
    setAnswer(clampStrUtf8Bytes(initialAnswer, KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES));
    setError('');
    setSaving(false);
    onBusyChange?.(false);
  }, [initialQuestion, initialAnswer, onBusyChange]);

  function setBusy(next: boolean) {
    setSaving(next);
    onBusyChange?.(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const q = question.trim();
    const a = answer.trim();
    if (!q) {
      setError('Question cannot be empty.');
      return;
    }
    if (!a) {
      setError('Answer cannot be empty.');
      return;
    }
    if (!qaFormPassesBackendNormalize('', [q], a)) {
      setError('Add a question and a non-empty answer.');
      return;
    }
    const payload = faqsToPatchPayload([{ title: '', questions: [q], answer: a, active: true }])[0];
    if (!payload) {
      setError('Could not build a valid FAQ payload. Check question and answer.');
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
      <FieldRow label="Question" htmlFor={`${formId}-question`} required helperText={QA_FIELD_QUESTIONS_HINT}>
        <Textarea
          id={`${formId}-question`}
          rows={3}
          value={question}
          onChange={(ev) => setQuestion(clampStrUtf8Bytes(ev.target.value, KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES))}
          disabled={saving}
          className="min-h-[4rem] text-sm"
          autoComplete="off"
        />
        <div className="mt-1 flex justify-end">
          <KnowledgeUtf8Meter value={question} maxBytes={KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES} />
        </div>
      </FieldRow>
      <FieldRow label="Answer" htmlFor={`${formId}-answer`} required helperText={QA_FIELD_ANSWER_HINT}>
        <Textarea
          id={`${formId}-answer`}
          rows={8}
          value={answer}
          onChange={(ev) => setAnswer(clampStrUtf8Bytes(ev.target.value, KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES))}
          disabled={saving}
          className="min-h-[10rem] text-sm"
          autoComplete="off"
        />
        <div className="mt-1 flex justify-end">
          <KnowledgeUtf8Meter value={answer} maxBytes={KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES} />
        </div>
      </FieldRow>
      {error ? (
        <p className="m-0 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
