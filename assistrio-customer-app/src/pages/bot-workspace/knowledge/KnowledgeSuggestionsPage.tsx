import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Lightbulb, Lock, MessageSquareReply, MoreVertical, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { appToast } from '@/lib/app-toast';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { useCloseOpenDetailsOnOutsidePress } from '@/lib/useCloseOpenDetailsOnOutsidePress';
import {
  patchCustomerBotSuggestionHideChipText,
  patchCustomerKnowledgeItemUseInReplies,
  postCustomerKnowledgeSuggestion,
  postCustomerKnowledgeSuggestionsSync,
} from '../../../api/customerApi';
import {
  bulkDeleteCustomerKnowledgeItems,
  reportCustomerKnowledgeItemDeleteRejected,
} from '@/lib/customerKnowledgeItemDelete';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { ReadOnlyWorkspaceNotice } from '@/components/workspace/ReadOnlyWorkspaceNotice';
import { useKnowledgeStorageUx, useDismissKnowledgeCompanionModalsOnStorageClose } from '@/context/KnowledgeStorageUxContext';
import {
  EXAMPLE_QUESTIONS_BACKEND_MAX,
  EXAMPLE_QUESTIONS_MAX,
  EXAMPLE_QUESTION_LABEL_MAX_UTF8_BYTES,
  EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES,
} from '../behaviorConstants';
import {
  exampleQuestionsToPatchPayload,
  hydrateExampleQuestionsFromBot,
  mergeExampleQuestionsWithKbStatusPoll,
  suggestionListHasScopedKnowledge,
  type ExampleQuestionItem,
} from '../exampleQuestionHelpers';
import { ws as styles } from '../workspace';
import { Button, Checkbox, FieldRow, Input, Textarea } from '@/components/ui';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { cn } from '@/lib/utils';
import {
  clampKnowledgeSourcesPageSize,
  KNOWLEDGE_LIST_SORT_DEFAULT,
  KNOWLEDGE_SOURCES_PAGE_SIZE,
  type KnowledgeListSort,
  KnowledgeDeleteConfirmModal,
  KnowledgeSaveConfirmModal,
  KnowledgeSortFilterCapsule,
  KnowledgeSourcesBulkBar,
  KnowledgeSourcesPageSelectAll,
  KnowledgeSourcesPagination,
  KnowledgeSourcesToolbar,
  sortSourceIndices,
  useKnowledgeTrainingGateModal,
} from './knowledgeSourcesListUi';
import {
  KnowledgeSuggestionChipLabelVisibilityTag,
  KnowledgeUseInRepliesTag,
  KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS,
} from './knowledgeItemDetailShared';
import { useKbTrainingStartedStatusRefetch } from './useKbTrainingStartedStatusRefetch';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import {
  clampStrUtf8Bytes,
  KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES,
  kbPlanLimitClientDescription,
  utf8ByteLength,
} from '@/lib/knowledgeContentUtf8Limits';
import {
  KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE,
  suggestionScopedUtf8Estimate,
} from '@/lib/knowledgeStorageLimits';
import {
  kbMergedTrainingStatusChipLabel,
  kbMergedTrainingStatusDotCanon,
} from './knowledgeViewTypes';
import {
  toastKnowledgeHideLabelInChatSaveFailed,
  toastKnowledgeHideLabelInChatSaved,
  toastKnowledgeUseInRepliesSaveFailed,
  toastKnowledgeUseInRepliesSaved,
} from '@/lib/knowledgeItemActionToasts';
import { findKnowledgeStatusItemById, isKnowledgeRowDeleteBlocked } from '@/lib/knowledgeTrainingMutationGate';
import { KNOWLEDGE_LIST_ADD_TEXTAREA_FIXED_CLASS } from './knowledgeItemDetailShared';
import { KnowledgeFieldInfoIcon } from './knowledgeFieldInfoIcon';
import {
  KB_SUGGESTION_CHIP_FIELD_HELPER,
  KB_SUGGESTION_SCOPE_FIELD_HELPER,
} from '@/lib/knowledgeSuggestionFieldCopy';

function suggestionSearchBlob(s: ExampleQuestionItem): string {
  return [s.label, s.context].join(' ').toLowerCase();
}

export function KnowledgeSuggestionsPage() {
  const { id: botId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const sourcesSearchId = useId();
  const pageSelectId = useId();
  const perPageSelectId = useId();
  const { bot, loadState, softReload, canManageBot } = useBotWorkspace();
  const { notifyPlanLimitFromApi, interceptKnowledgeStorageIncrease } = useKnowledgeStorageUx();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();

  const fromBot = useMemo(() => hydrateExampleQuestionsFromBot(bot), [bot]);
  const suggestionStatusSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'suggestion'),
    [knowledgeStatusItems],
  );
  const displaySuggestions = useMemo(
    () => mergeExampleQuestionsWithKbStatusPoll(fromBot, suggestionStatusSlice),
    [fromBot, suggestionStatusSlice],
  );
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();

  useKbTrainingStartedStatusRefetch(botId, 'suggestion');

  useEffect(() => {
    if (!botId) return;
    void refreshKnowledgeStatus('suggestion');
  }, [botId, refreshKnowledgeStatus]);

  useKbKnowledgeStatusPollInterest(Boolean(botId), 'suggestion');

  const [listSearch, setListSearch] = useState('');
  const [listSort, setListSort] = useState<KnowledgeListSort>(KNOWLEDGE_LIST_SORT_DEFAULT);
  const [listPageSize, setListPageSize] = useState(KNOWLEDGE_SOURCES_PAGE_SIZE);
  const [listPage, setListPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<null | { kind: 'row'; i: number } | 'bulk'>(null);

  const [addLabel, setAddLabel] = useState('');
  const [addContext, setAddContext] = useState('');
  const [addAttempted, setAddAttempted] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addSaveConfirmOpen, setAddSaveConfirmOpen] = useState(false);
  const [hideChipPatchIndex, setHideChipPatchIndex] = useState<number | null>(null);
  const [useInRepliesBusyId, setUseInRepliesBusyId] = useState<string | null>(null);

  const rowDetailsMenuListRef = useRef<HTMLUListElement>(null);
  useCloseOpenDetailsOnOutsidePress(rowDetailsMenuListRef);

  useDismissKnowledgeCompanionModalsOnStorageClose(() => setAddSaveConfirmOpen(false));

  const onHideChipTextInChatRow = useCallback(
    async (index: number, next: boolean) => {
      if (!botId) return;
      setHideChipPatchIndex(index);
      try {
        const res = await patchCustomerBotSuggestionHideChipText(botId, index, { hideChipTextInChat: next });
        if (!res.ok) {
          toastKnowledgeHideLabelInChatSaveFailed(res.error);
          return;
        }
        toastKnowledgeHideLabelInChatSaved(next);
        await softReload();
        requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
      } finally {
        setHideChipPatchIndex(null);
      }
    },
    [botId, softReload],
  );

  const toggleSuggestionUseInReplies = useCallback(
    async (itemId: string, currentlyIncluded: boolean) => {
      if (!botId || !itemId.trim()) return;
      const next = !currentlyIncluded;
      const id = itemId.trim();
      setUseInRepliesBusyId(id);
      try {
        const res = await patchCustomerKnowledgeItemUseInReplies(botId, id, { useInReplies: next });
        if (!res.ok) {
          toastKnowledgeUseInRepliesSaveFailed(res.error);
          return;
        }
        toastKnowledgeUseInRepliesSaved(next);
        await softReload();
        requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
        void refreshKnowledgeStatus('suggestion', id);
        void refreshTrainingStatus();
      } finally {
        setUseInRepliesBusyId(null);
      }
    },
    [botId, softReload, refreshKnowledgeStatus, refreshTrainingStatus],
  );

  const filteredIndices = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return fromBot.map((_, i) => i);
    return fromBot
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => suggestionSearchBlob(s).includes(q))
      .map(({ i }) => i);
  }, [fromBot, listSearch]);

  const titleKey = useCallback(
    (i: number) => {
      const s = fromBot[i];
      return s?.label.trim() || `Suggestion ${i + 1}`;
    },
    [fromBot],
  );

  const sortedFilteredIndices = useMemo(
    () =>
      sortSourceIndices(filteredIndices, listSort, titleKey, (i) => {
        const s = fromBot[i];
        return typeof s?.suggestionIndex === 'number' && Number.isFinite(s.suggestionIndex) ? s.suggestionIndex : i;
      }),
    [filteredIndices, listSort, titleKey, fromBot],
  );

  const listPageCount = Math.max(1, Math.ceil(sortedFilteredIndices.length / listPageSize) || 1);
  const safeListPage = Math.min(listPage, listPageCount);

  useEffect(() => {
    setListPage(1);
  }, [listSearch, listPageSize]);

  useEffect(() => {
    if (listPage > listPageCount) setListPage(listPageCount);
  }, [listPage, listPageCount]);

  const pagedIndices = useMemo(() => {
    const start = (safeListPage - 1) * listPageSize;
    return sortedFilteredIndices.slice(start, start + listPageSize);
  }, [sortedFilteredIndices, safeListPage, listPageSize]);

  useEffect(() => {
    setSelected((prev) => {
      const n = new Set<number>();
      for (const k of prev) {
        if (k >= 0 && k < fromBot.length) n.add(k);
      }
      return n;
    });
  }, [fromBot.length]);

  const isIndexSelectionBlockedForBulk = useCallback(
    (i: number) => {
      const row = displaySuggestions[i];
      if (!row) return false;
      return isKnowledgeRowDeleteBlocked(suggestionStatusSlice, row.knowledgeItemId, row);
    },
    [displaySuggestions, suggestionStatusSlice],
  );

  const togglePageSelection = useCallback(() => {
    setSelected((prev) => {
      const n = new Set(prev);
      const eligible = pagedIndices.filter((i) => !isIndexSelectionBlockedForBulk(i));
      const allEligibleSelected = eligible.length > 0 && eligible.every((i) => n.has(i));
      if (allEligibleSelected) {
        pagedIndices.forEach((i) => n.delete(i));
      } else if (eligible.length === 0) {
        if (pagedIndices.some((i) => n.has(i))) pagedIndices.forEach((i) => n.delete(i));
      } else {
        eligible.forEach((i) => n.add(i));
      }
      return n;
    });
  }, [pagedIndices, isIndexSelectionBlockedForBulk]);

  const toggleOneSelected = useCallback(
    (i: number) => {
      setSelected((prev) => {
        const n = new Set(prev);
        if (n.has(i)) n.delete(i);
        else {
          const row = displaySuggestions[i];
          if (row && isKnowledgeRowDeleteBlocked(suggestionStatusSlice, row.knowledgeItemId, row)) return prev;
          n.add(i);
        }
        return n;
      });
    },
    [displaySuggestions, suggestionStatusSlice],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  function requestAddSuggestion() {
    setAddAttempted(true);
    const label = addLabel.trim();
    if (!label) return;
    if (fromBot.length >= EXAMPLE_QUESTIONS_MAX) {
      appToast.error('Limit reached', {
        description: `You can add at most ${EXAMPLE_QUESTIONS_MAX} suggestions.`,
      });
      return;
    }
    setAddSaveConfirmOpen(true);
  }

  async function confirmAddSuggestion() {
    if (!botId) return;
    const label = clampStrUtf8Bytes(addLabel.trim(), EXAMPLE_QUESTION_LABEL_MAX_UTF8_BYTES);
    const context = clampStrUtf8Bytes(addContext.trim(), EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES);
    if (!label) {
      setAddSaveConfirmOpen(false);
      setAddAttempted(true);
      return;
    }
    if (fromBot.length >= EXAMPLE_QUESTIONS_MAX) {
      setAddSaveConfirmOpen(false);
      return;
    }
    const delta = suggestionScopedUtf8Estimate(label, context);
    if (!(await interceptKnowledgeStorageIncrease(delta, KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE))) {
      setAddSaveConfirmOpen(false);
      return;
    }
    setAddSaving(true);
    try {
      const addRes = await postCustomerKnowledgeSuggestion(botId, {
        label,
        ...(context ? { context } : {}),
      });
      if (!addRes.ok) {
        const nextDraft: ExampleQuestionItem[] = [...fromBot, { label, context: context || '' }];
        if (suggestionListHasScopedKnowledge(nextDraft) && notifyPlanLimitFromApi(addRes)) {
          return;
        }
        appToast.error('Could not add suggestion', {
          description: kbPlanLimitClientDescription(addRes.errorCode, addRes.error, addRes.body),
        });
        return;
      }
      appToast.success('Suggestion added');
      setAddSaveConfirmOpen(false);
      setAddLabel('');
      setAddContext('');
      setAddAttempted(false);
      await softReload();
      requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
      const newIndex =
        typeof addRes.data?.index === 'number' && Number.isFinite(addRes.data.index) ? addRes.data.index : fromBot.length;
      void navigate(`${base}/suggestions/${newIndex}`);
    } finally {
      setAddSaving(false);
    }
  }

  async function deleteByIndices(
    indicesToRemove: Set<number>,
    message: string,
    mode: 'row' | 'bulk',
  ): Promise<boolean> {
    if (!botId) return false;
    if (mode === 'row') setDeleting(true);
    else setBulkDeleting(true);
    try {
      const idsOrdered = [...indicesToRemove].map((i) => displaySuggestions[i]?.knowledgeItemId?.trim() ?? '');
      const useDeleteApi = idsOrdered.length === indicesToRemove.size && idsOrdered.every((id) => id.length > 0);

      let resOk = false;
      if (useDeleteApi) {
        const delRes = await bulkDeleteCustomerKnowledgeItems(botId, idsOrdered);
        if (reportCustomerKnowledgeItemDeleteRejected(navigate, delRes, { notifyPlanLimitFromApi })) {
          return false;
        }
        resOk = true;
      } else {
        const next = fromBot.filter((_, i) => !indicesToRemove.has(i));
        const res = await postCustomerKnowledgeSuggestionsSync(botId, exampleQuestionsToPatchPayload(next));
        if (!res.ok) {
          if (suggestionListHasScopedKnowledge(next) && notifyPlanLimitFromApi(res)) {
            return false;
          }
          appToast.error('Could not remove', {
            description: kbPlanLimitClientDescription(res.errorCode, res.error, res.body),
          });
          return false;
        }
        resOk = true;
      }

      if (!resOk) return false;
      appToast.success(message);
      setSelected((prev) => {
        const n = new Set(prev);
        indicesToRemove.forEach((i) => n.delete(i));
        return n;
      });
      await softReload();
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('suggestion');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
      return true;
    } finally {
      if (mode === 'row') setDeleting(false);
      else setBulkDeleting(false);
    }
  }

  function openRowDeleteModal(i: number) {
    if (!botId) return;
    const row = displaySuggestions[i];
    if (
      row &&
      blockIfTrainingForItem(
        findKnowledgeStatusItemById(suggestionStatusSlice, row.knowledgeItemId?.trim() ?? ''),
        row,
      )
    ) {
      return;
    }
    setDeleteModal({ kind: 'row', i });
  }

  function openBulkDeleteModal() {
    if (!botId || selected.size === 0) return;
    for (const i of selected) {
      const row = displaySuggestions[i];
      if (
        row &&
        blockIfTrainingForItem(
          findKnowledgeStatusItemById(suggestionStatusSlice, row.knowledgeItemId?.trim() ?? ''),
          row,
        )
      ) {
        return;
      }
    }
    setDeleteModal('bulk');
  }

  async function confirmDeleteModal() {
    if (!botId) return;
    if (deleteModal && typeof deleteModal === 'object' && deleteModal.kind === 'row') {
      const i = deleteModal.i;
      const ok = await deleteByIndices(new Set([i]), 'Suggestion removed', 'row');
      if (ok) setDeleteModal(null);
      return;
    }
    if (deleteModal === 'bulk' && selected.size > 0) {
      const n = selected.size;
      const copy = new Set(selected);
      const ok = await deleteByIndices(
        copy,
        n === 1 ? 'Suggestion removed' : `${n} suggestions removed`,
        'bulk',
      );
      if (ok) {
        setSelected(new Set());
        setDeleteModal(null);
      }
    }
  }

  if (!botId) return null;

  const listBusy = loadState === 'loading' && !bot;
  const selectedCount = selected.size;
  const deleteConfirmTitle =
    deleteModal === 'bulk'
      ? selectedCount > 1
        ? `Delete ${selectedCount} suggestions?`
        : 'Delete this suggestion?'
      : 'Remove this suggestion?';
  const deleteConfirmDescription =
    deleteModal === 'bulk' && selectedCount > 1
      ? 'These suggestions will stop being used right away.'
      : 'This suggestion will stop being used right away.';

  const addLabelInvalid = addAttempted && !addLabel.trim();
  const hasListData = fromBot.length > 0;
  const listingFillsColumn = !hasListData;
  const atCapacity = fromBot.length >= EXAMPLE_QUESTIONS_MAX;

  const suggestionSourcesCountBadge = (
    <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">
      {fromBot.length}/{EXAMPLE_QUESTIONS_BACKEND_MAX}
    </span>
  );

  return (
    <div className={styles.knowledgeSourcesPageRoot} data-knowledge-suggestions-list>
      <div className={styles.knowledgeSourcesPageBody}>
      {!canManageBot ? <ReadOnlyWorkspaceNotice variant="knowledge" className="shrink-0" /> : null}
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <h1 className={styles.workspaceEditorH1}>Suggestions</h1>
            <p className={styles.workspaceEditorLead}>
              Suggestion chips in your chat widget surface suggested questions, with optional text behind the first
              answer. Add below, or open a row from the list to edit.
            </p>
          </div>
        </div>
      </header>

      {canManageBot ? (
      <div className={cn(styles.knowledgeSourcesAddCard, 'relative overflow-hidden')}>
        <div
          className={cn(atCapacity && 'pointer-events-none select-none')}
          aria-hidden={atCapacity || undefined}
        >
          <p className={styles.knowledgeSourcesAddCardOverline}>Add suggestion</p>
          <div className={styles.knowledgeSourcesAddCardFieldStack}>
            <FieldRow
              label="Chip text"
              htmlFor="suggestion-add-label"
              required
              labelTrailing={
                <KnowledgeFieldInfoIcon content={KB_SUGGESTION_CHIP_FIELD_HELPER} ariaLabel="About chip text" />
              }
              error={addLabelInvalid ? 'Chip text is required.' : undefined}
              labelAddon={
                <KnowledgeUtf8Meter
                  value={addLabel}
                  maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES}
                  displayFormat="plain"
                />
              }
              labelRowClassName="w-full min-w-0"
            >
              <Input
                id="suggestion-add-label"
                quiet
                className="w-full min-w-0"
                value={addLabel}
                invalid={addLabelInvalid}
                disabled={addSaving || listBusy || atCapacity}
                onChange={(e) =>
                  setAddLabel(clampStrUtf8Bytes(e.target.value, EXAMPLE_QUESTION_LABEL_MAX_UTF8_BYTES))
                }
                autoComplete="off"
                placeholder="What services do you offer?"
              />
            </FieldRow>
            <FieldRow
              label="Scoped content"
              htmlFor="suggestion-add-context"
              labelTrailing={
                <KnowledgeFieldInfoIcon content={KB_SUGGESTION_SCOPE_FIELD_HELPER} ariaLabel="About scoped content" />
              }
              labelAddon={<KnowledgeUtf8Meter value={addContext} maxBytes={EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES} />}
              labelRowClassName="w-full min-w-0"
            >
              <Textarea
                id="suggestion-add-context"
                quiet
                rows={5}
                value={addContext}
                disabled={addSaving || listBusy || atCapacity}
                onChange={(e) =>
                  setAddContext(clampStrUtf8Bytes(e.target.value, EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES))
                }
                placeholder="e.g. pricing: Starter $9/mo, Pro $29/mo…"
                className={cn(
                  styles.workspaceEditorControlInput,
                  KNOWLEDGE_LIST_ADD_TEXTAREA_FIXED_CLASS,
                  'py-2.5',
                )}
              />
            </FieldRow>
            <div className={styles.knowledgeFormActionsRow}>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={addSaving || listBusy || atCapacity}
                onClick={() => void requestAddSuggestion()}
                className={styles.knowledgeFormActionPrimary}
              >
                {addSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {addSaving ? 'Saving…' : 'Add suggestion'}
              </Button>
            </div>
          </div>
        </div>
        {atCapacity ? (
          <div className="absolute inset-0 z-[1] flex min-h-[11rem] items-start justify-center px-4 pt-8 sm:pt-10">
            <div
              className="absolute inset-0 bg-white/[0.72] backdrop-blur-[2px] backdrop-saturate-[1.05]"
              aria-hidden
            />
            <div
              className="relative z-[1] max-w-[18rem] rounded-xl border border-slate-200/95 bg-white px-4 py-3.5 text-center shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.05]"
              role="status"
            >
              <div
                className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border-slate-200 bg-slate-100 text-slate-600"
                aria-hidden
              >
                <Lock className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="m-0 text-sm font-semibold leading-snug text-slate-900">Suggestion limit reached</p>
              <p className={cn(styles.workspaceEditorHelperText, 'm-0 mt-1.5 text-pretty')}>
                Remove one from the list below to add another.
              </p>
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      <div
        className={cn(
          styles.knowledgeSourcesListShell,
          listingFillsColumn
            ? 'min-h-[232px] w-full min-w-0 flex-1 flex-col overflow-visible border-slate-200/80'
            : 'shrink-0 overflow-visible border-slate-200/80',
        )}
      >
        <KnowledgeSourcesToolbar
          title="Suggestions Sources"
          titleAddon={suggestionSourcesCountBadge}
          search={listSearch}
          onSearch={setListSearch}
          inputId={sourcesSearchId}
        />
        {fromBot.length === 0 ? (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-0 pb-2 text-center sm:pt-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/80">
              <Lightbulb size={20} strokeWidth={1.75} className="text-teal-600" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">No suggestions yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
              {canManageBot ? (
                <>
                  Use <span className="font-medium text-slate-700">Add suggestion</span> above to create your first chip.
                </>
              ) : (
                'No suggestion chips have been added yet.'
              )}
            </p>
          </div>
        ) : (
          <div className="flex w-full min-w-0 flex-col">
            <div className={styles.knowledgeSourcesListControlsStack}>
              {canManageBot && sortedFilteredIndices.length > 0 ? (
                <KnowledgeSourcesPageSelectAll
                  id={pageSelectId}
                  pageIndices={pagedIndices}
                  selected={selected}
                  onToggleAllOnPage={togglePageSelection}
                  selectionBlocked={isIndexSelectionBlockedForBulk}
                  endSlot={<KnowledgeSortFilterCapsule value={listSort} onChange={setListSort} />}
                />
              ) : sortedFilteredIndices.length > 0 ? (
                <div className="flex justify-end">
                  <KnowledgeSortFilterCapsule value={listSort} onChange={setListSort} />
                </div>
              ) : null}
              {canManageBot ? (
                <KnowledgeSourcesBulkBar
                  count={selected.size}
                  noun="suggestion"
                  busy={bulkDeleting}
                  onRequestDelete={openBulkDeleteModal}
                  onClear={clearSelection}
                />
              ) : null}
            </div>
            {sortedFilteredIndices.length === 0 ? (
              <div className="flex w-full min-w-0 flex-col items-center justify-center px-0 pb-2 pt-10 text-center">
                <p className="m-0 text-sm font-medium text-slate-700">No matches</p>
                <p className="m-0 mt-1.5 text-sm text-slate-500">Try a different search term.</p>
              </div>
            ) : (
              <ul
                ref={rowDetailsMenuListRef}
                className={styles.knowledgeSourcesListRowGap}
                aria-label="Suggestions list"
              >
                {pagedIndices.map((i) => {
                  const s = displaySuggestions[i]!;
                  const head = s.label.trim() || `Suggestion ${i + 1}`;
                  const hasScope = Boolean(s.context.trim());
                  const statusDotCanon = kbMergedTrainingStatusDotCanon({ ...s, sourceType: 'suggestion' });
                  const suggestionStoredUtf8 = utf8ByteLength(s.context ?? '');
                  return (
                    <li key={i} className="min-w-0">
                      <div
                        className={cn(
                          'relative flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 ring-1 ring-slate-900/[0.02] transition-colors sm:px-4 sm:py-3',
                          'hover:border-slate-300/90 hover:bg-slate-50/80',
                          '[&:has(details[open])]:z-50',
                        )}
                      >
                        <div
                          className="shrink-0 self-start pt-0.5 leading-none"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {canManageBot &&
                          !deleting &&
                          !bulkDeleting &&
                          (!isKnowledgeRowDeleteBlocked(suggestionStatusSlice, s.knowledgeItemId, s) ||
                            selected.has(i)) ? (
                            <Checkbox
                              checked={selected.has(i)}
                              onChange={() => toggleOneSelected(i)}
                              aria-label={`Select suggestion: ${head}`}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 pr-9 sm:pr-10">
                          <button
                            type="button"
                            onClick={() => {
                              void navigate(`${base}/suggestions/${i}`);
                            }}
                            className="w-full rounded-md border-0 bg-transparent px-0 py-0 text-left leading-snug"
                          >
                            <p className="m-0 text-sm font-medium leading-tight text-slate-900">{head}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                              {hasScope ? (
                                <>
                                  <span
                                    className="tabular-nums"
                                    title="Approximate UTF-8 size of scoped knowledge text"
                                  >
                                    {formatKnowledgeBytes(suggestionStoredUtf8)}
                                  </span>
                                  <span className="text-slate-300" aria-hidden>
                                    |
                                  </span>
                                  <span className="inline-flex max-w-full min-w-0 items-center">
                                    <KbTrainingStatusTagWithSchedule
                                      label={kbMergedTrainingStatusChipLabel({ ...s, sourceType: 'suggestion' })}
                                      statusForBadge={statusDotCanon}
                                      row={{ runAfter: s.runAfter ?? null }}
                                      dotCanon={statusDotCanon}
                                      showHoverDescription
                                    />
                                  </span>
                                  <span className="text-slate-300" aria-hidden>
                                    |
                                  </span>
                                  <KnowledgeUseInRepliesTag
                                    active={s.active !== false}
                                    showHoverDescription
                                  />
                                  <span className="text-slate-300" aria-hidden>
                                    |
                                  </span>
                                  <KnowledgeSuggestionChipLabelVisibilityTag
                                    chipLabelHidden={s.hideChipTextInChat === true}
                                  />
                                </>
                              ) : (
                                <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                  <span className="text-slate-400">
                                    Chip only — no scope; first reply uses the full knowledge base
                                  </span>
                                  <span className="text-slate-300" aria-hidden>
                                    |
                                  </span>
                                  <KnowledgeSuggestionChipLabelVisibilityTag
                                    chipLabelHidden={s.hideChipTextInChat === true}
                                  />
                                </span>
                              )}
                            </div>
                            {hasScope && statusDotCanon === 'failed' && s.trainingError ? (
                              <p className="m-0 mt-1 text-xs font-medium text-red-600">{s.trainingError}</p>
                            ) : null}
                          </button>
                        </div>
                        {canManageBot ? (
                        <div className="absolute right-1 top-1 z-10 sm:right-2 sm:top-2">
                          <details className="relative isolate inline-block">
                            <summary
                              className="relative z-0 flex h-8 w-8 list-none cursor-pointer items-center justify-center rounded-md text-slate-500 hover:text-slate-700 [&::-webkit-details-marker]:hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical size={16} />
                            </summary>
                            <div className="absolute right-0 top-[calc(100%+0.25rem)] z-10 min-w-[10.5rem] rounded-lg border border-slate-200 bg-white p-1 shadow-[var(--shadow-dropdown)]">
                              {s.knowledgeItemId?.trim() ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={
                                    deleting || bulkDeleting || useInRepliesBusyId === s.knowledgeItemId.trim()
                                  }
                                  title={
                                    s.active !== false
                                      ? KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.active
                                      : KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.excluded
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute(
                                      'open',
                                    );
                                    void toggleSuggestionUseInReplies(s.knowledgeItemId!, s.active !== false);
                                  }}
                                >
                                  <MessageSquareReply className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                  <span className="min-w-0">
                                    {s.active !== false ? 'Turn off in replies' : 'Turn on in replies'}
                                  </span>
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={deleting || bulkDeleting || listBusy || hideChipPatchIndex === i}
                                title={
                                  s.hideChipTextInChat === true
                                    ? 'Make this chip visible in the chat widget again.'
                                    : 'Hide this chip from the chat widget.'
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute(
                                    'open',
                                  );
                                  void onHideChipTextInChatRow(i, !(s.hideChipTextInChat === true));
                                }}
                              >
                                {s.hideChipTextInChat === true ? (
                                  <Eye className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                )}
                                <span className="min-w-0">
                                  {s.hideChipTextInChat === true ? 'Make chip visible' : 'Hide chip from chat'}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-[var(--color-danger-text-emphasis)] hover:bg-slate-50"
                                title="Delete this suggestion"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                                  openRowDeleteModal(i);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                <span className="min-w-0">Delete</span>
                              </button>
                            </div>
                          </details>
                        </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="shrink-0 pt-4">
              <KnowledgeSourcesPagination
                page={safeListPage}
                pageCount={listPageCount}
                totalFiltered={sortedFilteredIndices.length}
                pageSize={listPageSize}
                perPageSelectId={perPageSelectId}
                onPageSizeChange={(s) => {
                  setListPageSize(clampKnowledgeSourcesPageSize(s));
                  setListPage(1);
                }}
                onPageChange={setListPage}
              />
            </div>
          </div>
        )}
      </div>
      </div>

      <KnowledgeSaveConfirmModal
        open={addSaveConfirmOpen}
        onClose={() => setAddSaveConfirmOpen(false)}
        onConfirm={() => void confirmAddSuggestion()}
        title="Add this suggestion?"
        description="It will be saved to this assistant and shown as a chip in the chat when configured."
        bodyNote={
          <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
            You can edit or remove this suggestion anytime from the suggestions list.
          </p>
        }
        confirmLabel="Add suggestion"
        busy={addSaving}
      />
      <KnowledgeDeleteConfirmModal
        open={deleteModal !== null}
        onClose={() => setDeleteModal(null)}
        onConfirm={() => void confirmDeleteModal()}
        title={deleteConfirmTitle}
        description={deleteConfirmDescription}
        busy={deleteModal === 'bulk' ? bulkDeleting : deleting}
      />
      {trainingGateModal}
    </div>
  );
}
