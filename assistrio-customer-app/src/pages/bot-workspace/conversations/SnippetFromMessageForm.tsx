import { useEffect, useState, type FormEvent } from 'react';
import { postCustomerKnowledgeSnippet } from '@/api/customerApi';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { FieldRow, Input, Textarea } from '@/components/ui';
import { appToast } from '@/lib/app-toast';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import {
  KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES,
  KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES,
  clampStrUtf8Bytes,
  kbPlanLimitClientDescription,
} from '@/lib/knowledgeContentUtf8Limits';
import {
  isKnowledgeTrainingBusyError,
  knowledgeTrainingBusyConflictMessage,
} from '@/lib/knowledgeTrainingBusyConflict';
import {
  snippetAppendPayloadFromForm,
  snippetFormPassesBackendNormalize,
} from '@/pages/bot-workspace/knowledge/knowledgeViewTypes';
import { KnowledgeFieldInfoIcon } from '@/pages/bot-workspace/knowledge/knowledgeFieldInfoIcon';
import { SNIPPET_FIELD_DESCRIPTION_HINT, SNIPPET_FIELD_TITLE_HINT_ADD } from '@/pages/bot-workspace/knowledge/knowledgeSnippetPageCopy';

export type SnippetFromMessageFormProps = {
  botId: string;
  initialTitle: string;
  initialContent: string;
  formId: string;
  onSaved: () => void;
  onBusyChange?: (busy: boolean) => void;
};

export function SnippetFromMessageForm({
  botId,
  initialTitle,
  initialContent,
  formId,
  onSaved,
  onBusyChange,
}: SnippetFromMessageFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(clampStrUtf8Bytes(initialTitle, KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES));
    setContent(clampStrUtf8Bytes(initialContent, KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES));
    setError('');
    setSaving(false);
    onBusyChange?.(false);
  }, [initialTitle, initialContent, onBusyChange]);

  function setBusy(next: boolean) {
    setSaving(next);
    onBusyChange?.(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const c = content.trim();
    if (!snippetFormPassesBackendNormalize(c)) {
      setError('Description cannot be empty.');
      return;
    }
    const payload = snippetAppendPayloadFromForm(title, c, true);
    if (!payload) {
      setError('Could not build a valid snippet. Check the description.');
      return;
    }
    setBusy(true);
    try {
      const res = await postCustomerKnowledgeSnippet(botId, payload);
      if (!res.ok) {
        if (isKnowledgeTrainingBusyError(res)) {
          setError(knowledgeTrainingBusyConflictMessage(res));
          return;
        }
        setError(kbPlanLimitClientDescription(res.errorCode, res.error, res.body));
        return;
      }
      appToast.success('Snippet added', { description: 'Saved to your knowledge base.' });
      requestWorkspaceBotRefresh(botId, { affectedSections: ['note'] });
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
        labelTrailing={
          <KnowledgeFieldInfoIcon content={SNIPPET_FIELD_TITLE_HINT_ADD} ariaLabel="About Title" />
        }
        labelAddon={
          <KnowledgeUtf8Meter
            value={title}
            maxBytes={KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES}
            className="shrink-0 whitespace-nowrap"
          />
        }
      >
        <Input
          id={`${formId}-title`}
          quiet
          value={title}
          onChange={(ev) =>
            setTitle(clampStrUtf8Bytes(ev.target.value, KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES))
          }
          disabled={saving}
          className="w-full min-w-0 text-sm"
          autoComplete="off"
          placeholder="e.g. Return policy"
        />
      </FieldRow>
      <FieldRow
        label="Description"
        htmlFor={`${formId}-body`}
        required
        labelTrailing={
          <KnowledgeFieldInfoIcon content={SNIPPET_FIELD_DESCRIPTION_HINT} ariaLabel="About Description" />
        }
        labelAddon={
          <KnowledgeUtf8Meter
            value={content}
            maxBytes={KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES}
            className="shrink-0 whitespace-nowrap"
          />
        }
      >
        <Textarea
          id={`${formId}-body`}
          quiet
          rows={8}
          value={content}
          onChange={(ev) =>
            setContent(clampStrUtf8Bytes(ev.target.value, KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES))
          }
          disabled={saving}
          className="min-h-[10rem] text-sm"
          autoComplete="off"
          placeholder="Factual text the model may quote or paraphrase."
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
