import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { tryHandleCustomerResourceGone } from '@/lib/customerResourceUnavailable';
import {
  patchCustomerBotSuggestionLabel,
  patchCustomerBotSuggestionScope,
} from '../../../api/customerApi';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { appToast } from '@/lib/app-toast';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { useKnowledgeStorageUx, useDismissKnowledgeCompanionModalsOnStorageClose } from '@/context/KnowledgeStorageUxContext';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { EXAMPLE_QUESTION_LABEL_MAX_UTF8_BYTES, EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES } from '../behaviorConstants';
import {
  clampStrUtf8Bytes,
  KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES,
  kbPlanLimitClientDescription,
} from '@/lib/knowledgeContentUtf8Limits';
import {
  KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE,
  suggestionScopedUtf8Estimate,
} from '@/lib/knowledgeStorageLimits';
import {
  isKnowledgeTrainingBusyError,
  knowledgeTrainingBusyConflictMessage,
} from '@/lib/knowledgeTrainingBusyConflict';
import { findKnowledgeStatusItemById } from '@/lib/knowledgeTrainingMutationGate';
import {
  hydrateExampleQuestionsFromBot,
  mergeExampleQuestionsWithKbStatusPoll,
} from '../exampleQuestionHelpers';
import { Button, FieldRow, Input, Textarea } from '@/components/ui';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KnowledgeSaveConfirmModal, useKnowledgeTrainingGateModal } from './knowledgeSourcesListUi';
import {
  KNOWLEDGE_EDIT_MODE_SECTION_LABEL_CLASS,
  KNOWLEDGE_EDITOR_FILL_TEXTAREA_CLASS,
  KnowledgeItemEditScrollSurface,
} from './knowledgeItemDetailShared';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import { KnowledgeFieldInfoIcon, KnowledgeHeadingInfoIcon } from './knowledgeFieldInfoIcon';
import { SUGGESTION_EDIT_TITLE_INFO } from './knowledgeSuggestionPageCopy';
import {
  KB_SUGGESTION_CHIP_FIELD_HELPER,
  KB_SUGGESTION_SCOPE_FIELD_HELPER,
} from '@/lib/knowledgeSuggestionFieldCopy';
import { useSyncKnowledgeLiveCrumb, useKnowledgeItemBreadcrumbsHiddenWhile } from './knowledgeItemRouteLayouts';

function suggestionEditorPersistFingerprint(label: string, context: string) {
  return JSON.stringify({
    label: clampStrUtf8Bytes(label.trim(), EXAMPLE_QUESTION_LABEL_MAX_UTF8_BYTES),
    context: clampStrUtf8Bytes(context.trim(), EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES),
  });
}

export function KnowledgeSuggestionEditPage() {
  const labelId = useId();
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const { notifyPlanLimitFromApi, interceptKnowledgeStorageIncrease } = useKnowledgeStorageUx();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);

  const fromBot = useMemo(() => hydrateExampleQuestionsFromBot(bot), [bot]);
  const suggestionStatusSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'suggestion'),
    [knowledgeStatusItems],
  );
  const mergedSuggestions = useMemo(
    () => mergeExampleQuestionsWithKbStatusPoll(fromBot, suggestionStatusSlice),
    [fromBot, suggestionStatusSlice],
  );
  const mergedSuggestionRow =
    indexParam !== 'new' && Number.isFinite(numIndex) && numIndex >= 0 && numIndex < mergedSuggestions.length
      ? mergedSuggestions[numIndex]!
      : null;
  const suggestionPollItemId = mergedSuggestionRow?.knowledgeItemId?.trim() ?? '';
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();
  const kbPollForEdit = useMemo(() => {
    if (!suggestionPollItemId) return null;
    return findKnowledgeStatusItemById(suggestionStatusSlice, suggestionPollItemId) ?? null;
  }, [suggestionStatusSlice, suggestionPollItemId]);

  useKbKnowledgeStatusPollInterest(
    Boolean(botId && mergedSuggestionRow),
    'suggestion',
    suggestionPollItemId || undefined,
  );

  const [label, setLabel] = useState('');
  const [context, setContext] = useState('');
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveConflictNotice, setSaveConflictNotice] = useState<string | null>(null);

  useDismissKnowledgeCompanionModalsOnStorageClose(() => {
    setSaveConfirmOpen(false);
    setSaveConflictNotice(null);
  });

  useEffect(() => {
    if (indexParam === 'new') {
      void navigate(`${base}/suggestions`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (!botId || indexParam === 'new') return;
    void refreshKnowledgeStatus('suggestion', suggestionPollItemId || undefined);
  }, [botId, indexParam, refreshKnowledgeStatus, suggestionPollItemId]);

  useEffect(() => {
    if (indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) return;
    const s = fromBot[numIndex]!;
    setLabel(s.label);
    setContext(s.context);
  }, [indexParam, numIndex, fromBot, loadState, bot]);

  function requestSave() {
    setSaveConflictNotice(null);
    setSaveAttempted(true);
    if (!label.trim()) return;
    setSaveConfirmOpen(true);
  }

  async function confirmSave() {
    if (!botId || indexParam === 'new') return;
    const t = clampStrUtf8Bytes(label.trim(), EXAMPLE_QUESTION_LABEL_MAX_UTF8_BYTES);
    const ctx = clampStrUtf8Bytes(context.trim(), EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES);
    if (!t) {
      setSaveConfirmOpen(false);
      setSaveAttempted(true);
      return;
    }
    if (numIndex < 0 || numIndex >= fromBot.length) {
      setSaveConfirmOpen(false);
      return;
    }
    const prevRow = fromBot[numIndex]!;
    const prevL = clampStrUtf8Bytes((prevRow.label ?? '').trim(), EXAMPLE_QUESTION_LABEL_MAX_UTF8_BYTES);
    const prevC = clampStrUtf8Bytes((prevRow.context ?? '').trim(), EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES);
    const delta = suggestionScopedUtf8Estimate(t, ctx) - suggestionScopedUtf8Estimate(prevL, prevC);
    if (!(await interceptKnowledgeStorageIncrease(delta, KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE))) {
      setSaveConfirmOpen(false);
      return;
    }
    if (
      mergedSuggestionRow &&
      blockIfTrainingForItem(kbPollForEdit, mergedSuggestionRow, {
        onAcknowledge: () => {
          setSaveConfirmOpen(false);
          setSaveConflictNotice(null);
        },
      })
    ) {
      return;
    }
    setSaving(true);
    try {
      const labelRes = await patchCustomerBotSuggestionLabel(botId, numIndex, { label: t });
      if (tryHandleCustomerResourceGone(navigate, labelRes, `${base}/suggestions`)) {
        return;
      }
      if (!labelRes.ok) {
        if (notifyPlanLimitFromApi(labelRes)) {
          await softReload();
          requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
          void refreshKnowledgeStatus('suggestion', suggestionPollItemId || undefined);
          void refreshTrainingStatus();
          return;
        }
        if (isKnowledgeTrainingBusyError(labelRes)) {
          setSaveConflictNotice(knowledgeTrainingBusyConflictMessage(labelRes));
          return;
        }
        appToast.error('Could not update chip text', {
          description: kbPlanLimitClientDescription(labelRes.errorCode, labelRes.error, labelRes.body),
        });
        return;
      }

      /** Chip PATCH already re-syncs KB row when scope exists; skip scope PATCH unless scoped text changed — avoids storage / gate errors for chip-only edits. */
      const scopeUnchanged = ctx === prevC;

      if (!scopeUnchanged) {
        const scopeRes = await patchCustomerBotSuggestionScope(botId, numIndex, { context: ctx });
        if (tryHandleCustomerResourceGone(navigate, scopeRes, `${base}/suggestions`)) {
          return;
        }
        if (!scopeRes.ok) {
          if (notifyPlanLimitFromApi(scopeRes)) {
            await softReload();
            requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
            void refreshKnowledgeStatus('suggestion', suggestionPollItemId || undefined);
            void refreshTrainingStatus();
            return;
          }
          if (isKnowledgeTrainingBusyError(scopeRes)) {
            setSaveConflictNotice(knowledgeTrainingBusyConflictMessage(scopeRes));
            return;
          }
          appToast.error('Scoped information could not be saved', {
            description: kbPlanLimitClientDescription(scopeRes.errorCode, scopeRes.error, scopeRes.body),
          });
          await softReload();
          requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
          void refreshKnowledgeStatus('suggestion', suggestionPollItemId || undefined);
          void refreshTrainingStatus();
          return;
        }
      }

      appToast.success('Suggestion updated');
      setSaveConflictNotice(null);
      await softReload();
      requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
      void refreshKnowledgeStatus('suggestion', suggestionPollItemId || undefined);
      void refreshTrainingStatus();
      setSaveConfirmOpen(false);
      setSaveAttempted(false);
      void navigate('..', { relative: 'path' });
    } finally {
      setSaving(false);
    }
  }

  const baselineFingerprint = useMemo(() => {
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) return null;
    const s = fromBot[numIndex]!;
    return suggestionEditorPersistFingerprint(s.label, s.context);
  }, [numIndex, fromBot]);

  const draftFingerprint = useMemo(
    () => suggestionEditorPersistFingerprint(label, context),
    [label, context],
  );

  const hasDirtyEdits = baselineFingerprint != null && draftFingerprint !== baselineFingerprint;
  const saveEnabled = hasDirtyEdits && Boolean(label.trim());

  const editorListBusy =
    Boolean(botId) && indexParam !== 'new' && loadState === 'loading' && !bot;

  useKnowledgeItemBreadcrumbsHiddenWhile(editorListBusy);

  useSyncKnowledgeLiveCrumb(label.trim() || 'Suggestion');

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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden" data-knowledge-suggestion-editor>
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
              <h1 className={styles.workspaceEditorH1}>Suggestions</h1>
              <KnowledgeHeadingInfoIcon text={SUGGESTION_EDIT_TITLE_INFO} ariaLabel="About editing suggestions" />
            </div>
            <p className={styles.workspaceEditorLead}>Update the fields below, then apply your changes.</p>
          </div>
        </div>
      </header>

      <KnowledgeItemEditScrollSurface layout="fill">
        <p className={KNOWLEDGE_EDIT_MODE_SECTION_LABEL_CLASS}>Edit suggestion</p>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
          <FieldRow
            label="Chip text"
            htmlFor={labelId}
            required
            labelTrailing={
              <KnowledgeFieldInfoIcon content={KB_SUGGESTION_CHIP_FIELD_HELPER} ariaLabel="About chip text" />
            }
            error={labelInvalid ? 'Chip text is required.' : undefined}
            labelAddon={
              <KnowledgeUtf8Meter
                value={label}
                maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES}
                displayFormat="plain"
              />
            }
            labelRowClassName="w-full min-w-0"
            className="shrink-0"
          >
            <Input
              id={labelId}
              quiet
              className="w-full min-w-0"
              value={label}
              invalid={labelInvalid}
              onChange={(e) => setLabel(clampStrUtf8Bytes(e.target.value, EXAMPLE_QUESTION_LABEL_MAX_UTF8_BYTES))}
              autoComplete="off"
              placeholder="What services do you offer?"
            />
          </FieldRow>
          <FieldRow
            label="Scoped content"
            htmlFor="suggestion-edit-context"
            labelTrailing={
              <KnowledgeFieldInfoIcon content={KB_SUGGESTION_SCOPE_FIELD_HELPER} ariaLabel="About scoped content" />
            }
            labelAddon={<KnowledgeUtf8Meter value={context} maxBytes={EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES} />}
            labelRowClassName="w-full min-w-0"
            className="flex min-h-0 flex-1 flex-col"
            controlClassName="flex min-h-0 flex-1 flex-col"
          >
            <Textarea
              id="suggestion-edit-context"
              quiet
              rows={3}
              value={context}
              onChange={(e) =>
                setContext(clampStrUtf8Bytes(e.target.value, EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES))
              }
              placeholder="e.g. pricing: Starter $9/mo, Pro $29/mo…"
              className={cn(
                styles.workspaceEditorControlInput,
                KNOWLEDGE_EDITOR_FILL_TEXTAREA_CLASS,
                'py-2.5',
              )}
            />
          </FieldRow>
          <div className={cn(styles.knowledgeFormActionsRow, 'shrink-0')}>
            {hasDirtyEdits ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.knowledgeFormActionSecondary}
                disabled={saving}
                onClick={() => void navigate('..', { relative: 'path' })}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={saving || !saveEnabled}
              onClick={() => void requestSave()}
              className={styles.knowledgeFormActionPrimary}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Updating…' : 'Update'}
            </Button>
          </div>
        </div>
      </KnowledgeItemEditScrollSurface>

      <KnowledgeSaveConfirmModal
        open={saveConfirmOpen}
        onClose={() => {
          setSaveConflictNotice(null);
          setSaveConfirmOpen(false);
        }}
        onConfirm={() => void confirmSave()}
        title="Update suggestion?"
        description="This saves the chip text and scoped chat content for your assistant."
        bodyNote={
          <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
            Chips and scoped replies follow training and your widget settings. You can edit this entry again anytime from
            the suggestions list.
          </p>
        }
        saveConflictNotice={saveConflictNotice}
        confirmLabel="Update"
        busy={saving}
      />
      {trainingGateModal}
    </div>
  );
}
