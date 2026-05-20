import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { tryHandleAdminResourceGone } from '@/lib/adminResourceUnavailable';
import { patchAdminKnowledgeSnippet } from '@/api/adminApi';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { appToast } from '@/lib/app-toast';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
import { useKnowledgeStorageUx, useDismissKnowledgeCompanionModalsOnStorageClose } from '@/context/KnowledgeStorageUxContext';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { Button, FieldRow, Input, Textarea } from '@/components/ui';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KbTrainingStatusTag, KbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';
import { KnowledgeSaveConfirmModal, useKnowledgeTrainingGateModal } from './knowledgeSourcesListUi';
import {
  KNOWLEDGE_EDIT_MODE_SECTION_LABEL_CLASS,
  KNOWLEDGE_EDITOR_FILL_TEXTAREA_CLASS,
  KnowledgeItemEditScrollSurface,
} from './knowledgeItemDetailShared';
import { cn } from '@/lib/utils';
import {
  clampStrUtf8Bytes,
  KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES,
  KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES,
  kbPlanLimitClientDescription,
} from '@/lib/knowledgeContentUtf8Limits';
import {
  KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE,
  knowledgeRowIndicatesPlanLimitTotal,
} from '@/lib/knowledgeStorageLimits';
import {
  isKnowledgeTrainingBusyError,
  knowledgeTrainingBusyConflictMessage,
} from '@/lib/knowledgeTrainingBusyConflict';
import { findKnowledgeStatusItemById } from '@/lib/knowledgeTrainingMutationGate';
import { ws as styles } from '../workspace';
import { KnowledgeFieldInfoIcon, KnowledgeHeadingInfoIcon } from './knowledgeFieldInfoIcon';
import {
  SNIPPET_EDIT_TITLE_INFO,
  SNIPPET_FIELD_DESCRIPTION_HINT,
  SNIPPET_FIELD_TITLE_HINT_EDIT,
} from './knowledgeSnippetPageCopy';
import {
  kbMergedTrainingStatusChipLabel,
  kbMergedTrainingStatusDotCanon,
  mergeSnippetRowsWithKbStatusPoll,
  snippetsFromBot,
  snippetKnowledgeItemStoredUtf8Bytes,
} from './knowledgeViewTypes';
import { useSyncKnowledgeLiveCrumb, useKnowledgeItemBreadcrumbsHiddenWhile } from './knowledgeItemRouteLayouts';

function snippetEditorPersistFingerprint(title: string, snippet: string) {
  return JSON.stringify({
    title: title.trim() || 'Snippet',
    snippet: snippet.trim(),
  });
}

export function SnippetEditPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useAdminBotWorkspace();
  const { notifyPlanLimitFromApi, interceptKnowledgeStorageIncrease } = useKnowledgeStorageUx();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const base = botId ? `/bots/${botId}/knowledge` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);

  const fromBot = useMemo(() => snippetsFromBot(bot), [bot]);
  const noteStatusSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'note'),
    [knowledgeStatusItems],
  );
  const mergedSnippets = useMemo(
    () => mergeSnippetRowsWithKbStatusPoll(fromBot, noteStatusSlice),
    [fromBot, noteStatusSlice],
  );
  const mergedSnippetRow =
    Number.isFinite(numIndex) && numIndex >= 0 && numIndex < mergedSnippets.length
      ? mergedSnippets[numIndex]!
      : null;
  const snippetPollItemId = (mergedSnippetRow?.knowledgeItemId ?? '').trim();
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();
  const kbPollForEdit = useMemo(() => {
    if (!snippetPollItemId) return null;
    return findKnowledgeStatusItemById(noteStatusSlice, snippetPollItemId) ?? null;
  }, [noteStatusSlice, snippetPollItemId]);

  useKbKnowledgeStatusPollInterest(
    Boolean(botId && indexParam !== 'new' && mergedSnippetRow),
    'note',
    snippetPollItemId || undefined,
  );

  const planLimitTraining = mergedSnippetRow
    ? knowledgeRowIndicatesPlanLimitTotal({ trainingError: mergedSnippetRow.trainingError })
    : false;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
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
      void navigate(`${base}/notes`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (!botId || indexParam === 'new') return;
    void refreshKnowledgeStatus('note', snippetPollItemId || undefined);
  }, [botId, indexParam, refreshKnowledgeStatus, snippetPollItemId]);

  useEffect(() => {
    if (indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) return;
    const s = fromBot[numIndex]!;
    setTitle(s.title);
    setBody(s.snippet);
  }, [indexParam, numIndex, fromBot, loadState, bot]);

  async function persistEditedSnippet(successToast: string): Promise<{ committed: boolean; trainingBusyMessage?: string }> {
    if (!botId) return { committed: false };
    if (
      mergedSnippetRow &&
      blockIfTrainingForItem(kbPollForEdit, mergedSnippetRow, {
        onAcknowledge: () => {
          setSaveConfirmOpen(false);
          setSaveConflictNotice(null);
        },
      })
    ) {
      return { committed: false };
    }
    const snippetText = body.trim();
    const titleTrim = title.trim();
    setSaving(true);
    try {
      const res = await patchAdminKnowledgeSnippet(botId, numIndex, {
        title: titleTrim || 'Snippet',
        snippet: snippetText,
        active: fromBot[numIndex]?.active !== false,
      });
      if (tryHandleAdminResourceGone(navigate, res, `${base}/notes`)) {
        return { committed: false };
      }
      if (!res.ok) {
        if (notifyPlanLimitFromApi(res)) {
          return { committed: false };
        }
        if (isKnowledgeTrainingBusyError(res)) {
          return {
            committed: false,
            trainingBusyMessage: knowledgeTrainingBusyConflictMessage(res),
          };
        }
        appToast.error('Could not save', {
          description: kbPlanLimitClientDescription(res.errorCode, res.error, res.body),
        });
        return { committed: false };
      }
      appToast.success(successToast);
      await softReload();
      requestWorkspaceBotRefresh(botId, { affectedSections: ['note'] });
      void refreshKnowledgeStatus('note', snippetPollItemId || undefined);
      void refreshTrainingStatus();
      return { committed: true };
    } finally {
      setSaving(false);
    }
  }

  function requestSave() {
    setSaveConflictNotice(null);
    setSaveAttempted(true);
    if (!body.trim()) return;
    setSaveConfirmOpen(true);
  }

  async function confirmSave() {
    if (!botId || indexParam === 'new') return;
    const snippet = body.trim();
    if (!snippet) {
      setSaveConfirmOpen(false);
      setSaveAttempted(true);
      return;
    }
    if (numIndex < 0 || numIndex >= fromBot.length) {
      setSaveConfirmOpen(false);
      return;
    }
    const titleTrim = title.trim();
    const oldS = fromBot[numIndex]!;
    const delta =
      snippetKnowledgeItemStoredUtf8Bytes({ title: titleTrim || 'Snippet', snippet: snippet }) -
      snippetKnowledgeItemStoredUtf8Bytes({ title: oldS.title, snippet: oldS.snippet });
    if (!(await interceptKnowledgeStorageIncrease(delta, KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE))) {
      setSaveConfirmOpen(false);
      return;
    }
    const outcome = await persistEditedSnippet('Snippet updated');
    if (outcome.trainingBusyMessage) {
      setSaveConflictNotice(outcome.trainingBusyMessage);
      return;
    }
    if (outcome.committed) {
      setSaveConflictNotice(null);
      setSaveConfirmOpen(false);
      setSaveAttempted(false);
      void navigate('..', { relative: 'path' });
    }
  }

  const baselineFingerprint = useMemo(() => {
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) return null;
    const s = fromBot[numIndex]!;
    return snippetEditorPersistFingerprint(s.title, s.snippet);
  }, [numIndex, fromBot]);

  const draftFingerprint = useMemo(() => snippetEditorPersistFingerprint(title, body), [title, body]);

  const hasDirtyEdits = baselineFingerprint != null && draftFingerprint !== baselineFingerprint;
  const saveEnabled = hasDirtyEdits && Boolean(body.trim());

  const editorListBusy =
    Boolean(botId) && indexParam !== 'new' && loadState === 'loading' && !bot;

  useKnowledgeItemBreadcrumbsHiddenWhile(editorListBusy);

  useSyncKnowledgeLiveCrumb((title.trim() || `Snippet ${numIndex + 1}`).trim() || `Snippet ${numIndex + 1}`);

  if (!botId) return null;
  if (indexParam === 'new') return null;

  const descInvalid = saveAttempted && !body.trim();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden" data-knowledge-snippet-editor>
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
              <h1 className={styles.workspaceEditorH1}>Snippets</h1>
              <KnowledgeHeadingInfoIcon text={SNIPPET_EDIT_TITLE_INFO} ariaLabel="About editing snippets" />
            </div>
            <p className={styles.workspaceEditorLead}>
              Short notes the model can retrieve. Update the fields below, then apply your changes.
            </p>
            {mergedSnippetRow ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:text-sm">
                {planLimitTraining ? (
                  <KbTrainingStatusTag
                    className="font-normal"
                    label="Storage limit reached"
                    statusForBadge="failed"
                  />
                ) : (
                  <KbTrainingStatusTagWithSchedule
                    label={kbMergedTrainingStatusChipLabel({ ...mergedSnippetRow, sourceType: 'note' })}
                    statusForBadge={kbMergedTrainingStatusDotCanon({ ...mergedSnippetRow, sourceType: 'note' })}
                    row={{ runAfter: mergedSnippetRow.runAfter ?? null }}
                    dotCanon={kbMergedTrainingStatusDotCanon({ ...mergedSnippetRow, sourceType: 'note' })}
                    sublineLayout="inline-pipe"
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <KnowledgeItemEditScrollSurface layout="fill">
        <p className={KNOWLEDGE_EDIT_MODE_SECTION_LABEL_CLASS}>Edit snippet</p>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
          <FieldRow
            label="Title"
            htmlFor="snippet-title"
            labelTrailing={
              <KnowledgeFieldInfoIcon content={SNIPPET_FIELD_TITLE_HINT_EDIT} ariaLabel="About Title" />
            }
            labelAddon={<KnowledgeUtf8Meter value={title} maxBytes={KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES} />}
            className="shrink-0"
          >
            <Input
              id="snippet-title"
              quiet
              className="w-full min-w-0"
              value={title}
              onChange={(e) =>
                setTitle(clampStrUtf8Bytes(e.target.value, KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES))
              }
              autoComplete="off"
              placeholder="e.g. Return policy"
            />
          </FieldRow>
          <FieldRow
            label="Description"
            htmlFor="snippet-body"
            required
            labelTrailing={
              <KnowledgeFieldInfoIcon content={SNIPPET_FIELD_DESCRIPTION_HINT} ariaLabel="About Description" />
            }
            labelAddon={<KnowledgeUtf8Meter value={body} maxBytes={KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES} />}
            error={descInvalid ? 'Description is required.' : undefined}
            className="flex min-h-0 flex-1 flex-col"
            controlClassName="flex min-h-0 flex-1 flex-col"
          >
            <Textarea
              id="snippet-body"
              quiet
              rows={3}
              value={body}
              invalid={descInvalid}
              onChange={(e) =>
                setBody(clampStrUtf8Bytes(e.target.value, KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES))
              }
              placeholder="Factual text the model may quote or paraphrase."
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
                onClick={() => void navigate(`${base}/notes/${numIndex}`)}
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
        title="Update snippet?"
        description="This replaces the saved snippet for this assistant."
        bodyNote={
          <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
            Replies use this text after training completes, depending on your Knowledge Overview settings. You can edit
            it again anytime from the snippets library.
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
