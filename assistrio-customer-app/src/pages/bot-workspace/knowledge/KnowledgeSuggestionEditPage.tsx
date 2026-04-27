import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import { patchCustomerBot } from '../../../api/customerApi';
import { useBotWorkspace } from '../BotWorkspaceContext';
import {
  EXAMPLE_QUESTION_CONTEXT_MAX,
  EXAMPLE_QUESTION_MAX_CHARS,
} from '../behaviorConstants';
import { exampleQuestionsToPatchPayload, hydrateExampleQuestionsFromBot, type ExampleQuestionItem } from '../exampleQuestionHelpers';
import { Button, FieldRow, Input, Textarea } from '@/components/ui';
import { KnowledgeBackBreadcrumbRow, KnowledgeSaveConfirmModal } from './knowledgeSourcesListUi';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';

function RecommendedCharLabelAddon({ length, max }: { length: number; max: number }) {
  const over = length > max;
  return (
    <span
      className={cn(
        'ml-auto shrink-0 text-xs tabular-nums leading-tight text-slate-500',
        over && 'text-amber-800',
      )}
      aria-live="polite"
    >
      {length.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

export function KnowledgeSuggestionEditPage() {
  const labelId = useId();
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);

  const fromBot = useMemo(() => hydrateExampleQuestionsFromBot(bot), [bot]);
  const [label, setLabel] = useState('');
  const [context, setContext] = useState('');
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  useEffect(() => {
    if (indexParam === 'new') {
      void navigate(`${base}/suggestions`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) {
      void navigate(`${base}/suggestions`, { replace: true });
      return;
    }
    const s = fromBot[numIndex]!;
    setLabel(s.label);
    setContext(s.context);
  }, [indexParam, numIndex, fromBot, loadState, bot, navigate, base]);

  async function persistAll(next: ExampleQuestionItem[], successToast: string): Promise<boolean> {
    if (!botId) return false;
    setSaving(true);
    try {
      const res = await patchCustomerBot(botId, { exampleQuestions: exampleQuestionsToPatchPayload(next) });
      if (!res.ok) {
        appToast.error('Could not save', { description: res.error });
        return false;
      }
      appToast.success(successToast);
      await softReload();
      return true;
    } finally {
      setSaving(false);
    }
  }

  function requestSave() {
    setSaveAttempted(true);
    if (!label.trim()) return;
    setSaveConfirmOpen(true);
  }

  async function confirmSave() {
    if (!botId || indexParam === 'new') return;
    const t = label.trim().slice(0, EXAMPLE_QUESTION_MAX_CHARS);
    const ctx = context.trim().slice(0, EXAMPLE_QUESTION_CONTEXT_MAX);
    if (!t) {
      setSaveConfirmOpen(false);
      setSaveAttempted(true);
      return;
    }
    if (numIndex < 0 || numIndex >= fromBot.length) {
      setSaveConfirmOpen(false);
      return;
    }
    const next = fromBot.map((s, i) => (i === numIndex ? { label: t, context: ctx || '' } : s));
    const ok = await persistAll(next, 'Suggestion updated');
    if (ok) {
      setSaveConfirmOpen(false);
      setSaveAttempted(false);
      void navigate(`${base}/suggestions/${numIndex}`, { replace: true });
    }
  }

  if (!botId) return null;
  if (indexParam === 'new') return null;

  const listBusy = loadState === 'loading' && !bot;
  if (listBusy) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  const labelInvalid = saveAttempted && !label.trim();
  const lastCrumb = label.trim() || 'Suggestion';

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-6 px-0"
      data-knowledge-suggestion-editor
    >
      <div className="shrink-0">
        <KnowledgeBackBreadcrumbRow
          backLabel="Back"
          onBack={() => void navigate(`${base}/suggestions/${numIndex}`)}
          sectionLabel="Suggestions"
          lastCrumb={lastCrumb}
          tailLabel="Edit"
        />
      </div>

      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <h1 className={styles.workspaceEditorH1}>Suggestions</h1>
            <p className={styles.workspaceEditorLead}>
              Update chip text and optional scoped information, then apply your changes.
            </p>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'shrink-0 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        )}
      >
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Edit suggestion</p>
        <div className="mt-4 w-full min-w-0 space-y-5">
          <FieldRow
            label="Chip text"
            htmlFor={labelId}
            required
            helperText="Short text on the chip; sent as the visitor’s first message when tapped."
            error={labelInvalid ? 'Chip text is required.' : undefined}
            labelAddon={<RecommendedCharLabelAddon length={label.length} max={EXAMPLE_QUESTION_MAX_CHARS} />}
            labelRowClassName="w-full min-w-0"
          >
            <Input
              id={labelId}
              quiet
              className="w-full min-w-0"
              value={label}
              invalid={labelInvalid}
              maxLength={EXAMPLE_QUESTION_MAX_CHARS}
              onChange={(e) => setLabel(e.target.value.slice(0, EXAMPLE_QUESTION_MAX_CHARS))}
              autoComplete="off"
              placeholder="What services do you offer?"
            />
          </FieldRow>
          <FieldRow
            label="Scoped information (optional)"
            htmlFor="suggestion-edit-context"
            helperText="If set, the first reply uses only this text. Leave empty for full knowledge search."
            labelAddon={<RecommendedCharLabelAddon length={context.length} max={EXAMPLE_QUESTION_CONTEXT_MAX} />}
            labelRowClassName="w-full min-w-0"
          >
            <Textarea
              id="suggestion-edit-context"
              quiet
              rows={4}
              value={context}
              maxLength={EXAMPLE_QUESTION_CONTEXT_MAX}
              onChange={(e) => setContext(e.target.value.slice(0, EXAMPLE_QUESTION_CONTEXT_MAX))}
              placeholder="e.g. pricing: Starter $9/mo, Pro $29/mo…"
              className={cn(styles.workspaceEditorControlInput, 'min-h-[6.5rem] w-full resize-y py-2.5')}
            />
          </FieldRow>
          <div className={styles.knowledgeFormActionsRow}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.knowledgeFormActionSecondary}
              disabled={saving}
              onClick={() => void navigate(`${base}/suggestions/${numIndex}`)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={saving}
              onClick={() => void requestSave()}
              className={styles.knowledgeFormActionPrimary}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Updating…' : 'Update'}
            </Button>
          </div>
        </div>
      </div>

      <KnowledgeSaveConfirmModal
        open={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={() => void confirmSave()}
        title="Update suggestion?"
        description="Your changes will be saved for this assistant’s chat suggestions."
        confirmLabel="Update"
        busy={saving}
      />
    </div>
  );
}
