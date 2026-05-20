import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Loader2, MessageSquareReply, MoreVertical, StickyNote, Trash2, Upload } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import {
  toastKnowledgeUseInRepliesSaveFailed,
  toastKnowledgeUseInRepliesSaved,
} from '@/lib/knowledgeItemActionToasts';
import {
  getAdminKnowledgeSnippetImportCsvSample,
  patchAdminKnowledgeItemUseInReplies,
  postAdminKnowledgeSnippet,
  postAdminKnowledgeSnippetImportCsv,
} from '@/api/adminApi';
import {
  bulkDeleteAdminKnowledgeItems,
  KB_DELETE_REQUIRES_SYNC_MESSAGE,
  reportAdminKnowledgeItemDeleteRejected,
} from '@/lib/adminKnowledgeItemDelete';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
import { useKnowledgeStorageUx, useDismissKnowledgeCompanionModalsOnStorageClose } from '@/context/KnowledgeStorageUxContext';
import { Button, Checkbox, FieldRow, Input, Modal, Textarea } from '@/components/ui';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import {
  KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES,
  KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES,
  clampStrUtf8Bytes,
  kbPlanLimitClientDescription,
} from '@/lib/knowledgeContentUtf8Limits';
import { KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE } from '@/lib/knowledgeStorageLimits';
import {
  isKnowledgeTrainingBusyError,
  knowledgeTrainingBusyConflictMessage,
} from '@/lib/knowledgeTrainingBusyConflict';
import { findKnowledgeStatusItemById, isKnowledgeRowDeleteBlocked } from '@/lib/knowledgeTrainingMutationGate';
import { useCloseOpenDetailsOnOutsidePress } from '@/lib/useCloseOpenDetailsOnOutsidePress';
import {
  kbMergedTrainingStatusChipLabel,
  kbMergedTrainingStatusDotCanon,
  mergeSnippetRowsWithKbStatusPoll,
  snippetKnowledgeItemStoredUtf8Bytes,
  snippetsFromBot,
} from './knowledgeViewTypes';
import { KnowledgeFieldInfoIcon } from './knowledgeFieldInfoIcon';
import { SNIPPET_FIELD_DESCRIPTION_HINT, SNIPPET_FIELD_TITLE_HINT_ADD } from './knowledgeSnippetPageCopy';
import { useKbTrainingStartedStatusRefetch } from './useKbTrainingStartedStatusRefetch';
import {
  KNOWLEDGE_LIST_ADD_TEXTAREA_FIXED_CLASS,
  KnowledgeUseInRepliesTag,
  KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS,
} from './knowledgeItemDetailShared';
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

export function SnippetsListPage() {
  const { id: botId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const base = botId ? `/bots/${botId}/knowledge` : '';
  const sourcesSearchId = useId();
  const pageSelectId = useId();
  const perPageSelectId = useId();
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const { bot, loadState, softReload } = useAdminBotWorkspace();
  const { notifyPlanLimitFromApi, interceptKnowledgeStorageIncrease } = useKnowledgeStorageUx();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const fromBot = useMemo(() => snippetsFromBot(bot), [bot]);
  const noteStatusSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'note'),
    [knowledgeStatusItems],
  );
  const displaySnippets = useMemo(
    () => mergeSnippetRowsWithKbStatusPoll(fromBot, noteStatusSlice),
    [fromBot, noteStatusSlice],
  );
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();

  useKbTrainingStartedStatusRefetch(botId, 'note');

  useEffect(() => {
    if (!botId) return;
    void refreshKnowledgeStatus('note');
  }, [botId, refreshKnowledgeStatus]);

  useKbKnowledgeStatusPollInterest(Boolean(botId), 'note');
  const [listSearch, setListSearch] = useState('');
  const [listSort, setListSort] = useState<KnowledgeListSort>(KNOWLEDGE_LIST_SORT_DEFAULT);
  const [listPageSize, setListPageSize] = useState(KNOWLEDGE_SOURCES_PAGE_SIZE);
  const [listPage, setListPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<null | { kind: 'row'; i: number } | 'bulk'>(null);
  const [useInRepliesBusyId, setUseInRepliesBusyId] = useState<string | null>(null);

  const [addTitle, setAddTitle] = useState('');
  const [addBody, setAddBody] = useState('');
  const [addAttempted, setAddAttempted] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addSaveConfirmOpen, setAddSaveConfirmOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; column: string; message: string }>>([]);

  const rowDetailsMenuListRef = useRef<HTMLUListElement>(null);
  useCloseOpenDetailsOnOutsidePress(rowDetailsMenuListRef);

  useDismissKnowledgeCompanionModalsOnStorageClose(() => setAddSaveConfirmOpen(false));
  useDismissKnowledgeCompanionModalsOnStorageClose(() => setImportOpen(false));

  async function downloadSnippetSampleCsv() {
    if (!botId) return;
    const res = await getAdminKnowledgeSnippetImportCsvSample(botId);
    if (!res.ok) {
      appToast.error('Could not download sample', { description: res.error });
      return;
    }
    const blob = new Blob([res.data.content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.data.fileName || 'snippets-import-sample.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importSnippetCsv(file: File | undefined) {
    if (!file || !botId) return;
    setImportingCsv(true);
    setImportErrors([]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await postAdminKnowledgeSnippetImportCsv(botId, fd);
      if (!res.ok) {
        const details =
          res.body && typeof res.body === 'object' && Array.isArray((res.body as { details?: unknown[] }).details)
            ? ((res.body as { details: Array<{ row: number; column: string; message: string }> }).details ?? [])
            : [];
        if (details.length > 0) setImportErrors(details);
        appToast.error('Import failed', { description: res.error });
        return;
      }
      appToast.success(
        res.data.skippedDueToCapacity && res.data.skippedDueToCapacity > 0
          ? `Imported ${res.data.imported} snippets (${res.data.skippedDueToCapacity} skipped: capacity reached)`
          : `Imported ${res.data.imported} snippets`,
      );
      setImportOpen(false);
      await softReload();
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('note');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['note'] });
    } finally {
      setImportingCsv(false);
    }
  }

  const filteredIndices = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return fromBot.map((_, i) => i);
    return fromBot
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => {
        const t = (s.title || '').toLowerCase();
        const b = (s.snippet || '').toLowerCase();
        return t.includes(q) || b.includes(q);
      })
      .map(({ i }) => i);
  }, [fromBot, listSearch]);

  const sortedFilteredIndices = useMemo(
    () =>
      sortSourceIndices(
        filteredIndices,
        listSort,
        (i) => {
          const t = (fromBot[i]?.title ?? '').trim();
          return t || `Snippet ${i + 1}`;
        },
        (i) => {
          const s = fromBot[i];
          return typeof s?.snippetIndex === 'number' && Number.isFinite(s.snippetIndex) ? s.snippetIndex : i;
        },
      ),
    [filteredIndices, listSort, fromBot],
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
      const row = displaySnippets[i];
      if (!row) return false;
      return isKnowledgeRowDeleteBlocked(noteStatusSlice, row.knowledgeItemId, row);
    },
    [displaySnippets, noteStatusSlice],
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
          const row = displaySnippets[i];
          if (row && isKnowledgeRowDeleteBlocked(noteStatusSlice, row.knowledgeItemId, row)) return prev;
          n.add(i);
        }
        return n;
      });
    },
    [displaySnippets, noteStatusSlice],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  async function persistSnippetForAdd(title: string, snippet: string, successToast: string): Promise<boolean> {
    if (!botId) return false;
    setAddSaving(true);
    try {
      const res = await postAdminKnowledgeSnippet(botId, {
        title: title.trim() || 'Snippet',
        snippet: snippet.trim(),
        active: true,
      });
      if (!res.ok) {
        if (notifyPlanLimitFromApi(res)) {
          return false;
        }
        if (isKnowledgeTrainingBusyError(res)) {
          appToast.error(knowledgeTrainingBusyConflictMessage(res));
          return false;
        }
        appToast.error('Could not save', {
          description: kbPlanLimitClientDescription(res.errorCode, res.error, res.body),
        });
        return false;
      }
      appToast.success(successToast);
      await softReload();
      requestWorkspaceBotRefresh(botId, { affectedSections: ['note'] });
      return true;
    } finally {
      setAddSaving(false);
    }
  }

  function requestAddSnippet() {
    setAddAttempted(true);
    const snippet = addBody.trim();
    if (!snippet) return;
    setAddSaveConfirmOpen(true);
  }

  async function confirmAddSnippet() {
    if (!botId) return;
    const snippet = addBody.trim();
    if (!snippet) {
      setAddSaveConfirmOpen(false);
      setAddAttempted(true);
      return;
    }
    const t = addTitle.trim();
    const delta = snippetKnowledgeItemStoredUtf8Bytes({ title: t || 'Snippet', snippet });
    if (!(await interceptKnowledgeStorageIncrease(delta, KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE))) {
      setAddSaveConfirmOpen(false);
      return;
    }
    const ok = await persistSnippetForAdd(t, snippet, 'Snippet added');
    if (ok) {
      setAddSaveConfirmOpen(false);
      setAddTitle('');
      setAddBody('');
      setAddAttempted(false);
    }
  }

  async function deleteSnippetsByIndices(indicesToRemove: Set<number>, message: string): Promise<boolean> {
    if (!botId) return false;
    setDeleting(true);
    try {
      const idsOrdered = [...indicesToRemove].map((i) => displaySnippets[i]?.knowledgeItemId?.trim() ?? '');
      const useDeleteApi = idsOrdered.length === indicesToRemove.size && idsOrdered.every((id) => id.length > 0);

      let resOk = false;
      if (useDeleteApi) {
        const delRes = await bulkDeleteAdminKnowledgeItems(botId, idsOrdered);
        if (reportAdminKnowledgeItemDeleteRejected(navigate, delRes, { notifyPlanLimitFromApi })) {
          return false;
        }
        resOk = true;
      } else {
        appToast.error('Could not remove', { description: KB_DELETE_REQUIRES_SYNC_MESSAGE });
        return false;
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
      void refreshKnowledgeStatus('note');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['note'] });
      return true;
    } finally {
      setDeleting(false);
    }
  }

  const toggleSnippetUseInReplies = useCallback(
    async (itemId: string, currentlyIncluded: boolean) => {
      if (!botId || !itemId.trim()) return;
      const next = !currentlyIncluded;
      const id = itemId.trim();
      setUseInRepliesBusyId(id);
      try {
        const res = await patchAdminKnowledgeItemUseInReplies(botId, id, { useInReplies: next });
        if (!res.ok) {
          toastKnowledgeUseInRepliesSaveFailed(res.error);
          return;
        }
        toastKnowledgeUseInRepliesSaved(next);
        await softReload();
        requestWorkspaceBotRefresh(botId, { affectedSections: ['note'] });
        void refreshKnowledgeStatus('note', id);
      } finally {
        setUseInRepliesBusyId(null);
      }
    },
    [botId, softReload, refreshKnowledgeStatus],
  );

  function openRowDeleteModal(i: number) {
    if (!botId) return;
    const row = displaySnippets[i];
    if (
      row &&
      blockIfTrainingForItem(
        findKnowledgeStatusItemById(noteStatusSlice, row.knowledgeItemId?.trim() ?? ''),
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
      const row = displaySnippets[i];
      if (
        row &&
        blockIfTrainingForItem(
          findKnowledgeStatusItemById(noteStatusSlice, row.knowledgeItemId?.trim() ?? ''),
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
      const ok = await deleteSnippetsByIndices(new Set([i]), 'Snippet removed');
      if (ok) setDeleteModal(null);
      return;
    }
    if (deleteModal === 'bulk') {
      const ok = await runBulkDeleteInternal();
      if (ok) setDeleteModal(null);
    }
  }

  async function runBulkDeleteInternal(): Promise<boolean> {
    if (!botId || selected.size === 0) return false;
    const n = selected.size;
    setBulkDeleting(true);
    try {
      const idsOrdered = [...selected].map((i) => displaySnippets[i]?.knowledgeItemId?.trim() ?? '');
      const useDeleteApi = idsOrdered.length === selected.size && idsOrdered.every((id) => id.length > 0);

      let resOk = false;
      if (useDeleteApi) {
        const delRes = await bulkDeleteAdminKnowledgeItems(botId, idsOrdered);
        if (reportAdminKnowledgeItemDeleteRejected(navigate, delRes, { notifyPlanLimitFromApi })) {
          return false;
        }
        resOk = true;
      } else {
        appToast.error('Could not remove', { description: KB_DELETE_REQUIRES_SYNC_MESSAGE });
        return false;
      }

      if (!resOk) return false;
      appToast.success(n === 1 ? 'Snippet removed' : `${n} snippets removed`);
      setSelected(new Set());
      await softReload();
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('note');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['note'] });
      return true;
    } finally {
      setBulkDeleting(false);
    }
  }

  if (!botId) return null;

  const listBusy = loadState === 'loading' && !bot;
  const selectedCount = selected.size;
  const deleteConfirmTitle =
    deleteModal === 'bulk'
      ? selectedCount > 1
        ? `Delete ${selectedCount} snippets?`
        : 'Delete this snippet?'
      : 'Remove this snippet?';
  const deleteConfirmDescription =
    deleteModal === 'bulk' && selectedCount > 1
      ? 'These snippets will stop being used for answers right away.'
      : 'This snippet will stop being used for answers right away.';

  const addDescInvalid = addAttempted && !addBody.trim();

  const hasListData = fromBot.length > 0;
  const listingFillsColumn = !hasListData;

  return (
    <div className={styles.knowledgeSourcesPageRoot} data-knowledge-snippets-list>
      <div className={styles.knowledgeSourcesPageBody}>
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <h1 className={styles.workspaceEditorH1}>Snippets</h1>
            <p className={styles.workspaceEditorLead}>
              Add a snippet below, or open an existing one from the list to edit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outlinePrimary" size="sm" onClick={() => setImportOpen(true)}>
              <Upload size={14} aria-hidden />
              Import CSV
            </Button>
          </div>
        </div>
      </header>
      <input
        ref={importFileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        tabIndex={-1}
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = '';
          void importSnippetCsv(f);
        }}
      />

      <div className={styles.knowledgeSourcesAddCard}>
        <p className={styles.knowledgeSourcesAddCardOverline}>Add snippet</p>
        <div className={styles.knowledgeSourcesAddCardFieldStack}>
          <FieldRow
            label="Title"
            htmlFor="snippet-add-title"
            labelTrailing={<KnowledgeFieldInfoIcon content={SNIPPET_FIELD_TITLE_HINT_ADD} ariaLabel="About Title" />}
            labelAddon={<KnowledgeUtf8Meter value={addTitle} maxBytes={KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES} />}
          >
            <Input
              id="snippet-add-title"
              quiet
              className="w-full min-w-0"
              value={addTitle}
              onChange={(e) => setAddTitle(clampStrUtf8Bytes(e.target.value, KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES))}
              autoComplete="off"
              placeholder="e.g. Return policy"
            />
          </FieldRow>
          <FieldRow
            label="Description"
            htmlFor="snippet-add-body"
            required
            labelTrailing={
              <KnowledgeFieldInfoIcon content={SNIPPET_FIELD_DESCRIPTION_HINT} ariaLabel="About Description" />
            }
            labelAddon={<KnowledgeUtf8Meter value={addBody} maxBytes={KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES} />}
            error={addDescInvalid ? 'Description is required.' : undefined}
          >
            <Textarea
              id="snippet-add-body"
              quiet
              rows={5}
              value={addBody}
              invalid={addDescInvalid}
              onChange={(e) => setAddBody(clampStrUtf8Bytes(e.target.value, KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES))}
              placeholder="Factual text the model may quote or paraphrase."
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
              disabled={addSaving || listBusy}
              onClick={() => void requestAddSnippet()}
              className={styles.knowledgeFormActionPrimary}
            >
              {addSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {addSaving ? 'Saving…' : 'Add Snippet'}
            </Button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          styles.knowledgeSourcesListShell,
          listingFillsColumn
            ? 'min-h-[232px] w-full min-w-0 flex-1 flex-col overflow-visible border-slate-200/80'
            : 'shrink-0 overflow-visible border-slate-200/80',
        )}
      >
        {fromBot.length === 0 ? (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-0 text-center sm:pt-0">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/80">
              <StickyNote size={20} strokeWidth={1.75} className="text-teal-600" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">No snippets yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
              Use the form above to add your first snippet.
            </p>
          </div>
        ) : (
          <div className="flex w-full min-w-0 flex-col">
            <KnowledgeSourcesToolbar
              title="Snippets Sources"
              search={listSearch}
              onSearch={setListSearch}
              inputId={sourcesSearchId}
            />
            <div className={styles.knowledgeSourcesListControlsStack}>
              {sortedFilteredIndices.length > 0 ? (
                <KnowledgeSourcesPageSelectAll
                  id={pageSelectId}
                  pageIndices={pagedIndices}
                  selected={selected}
                  onToggleAllOnPage={togglePageSelection}
                  selectionBlocked={isIndexSelectionBlockedForBulk}
                  endSlot={<KnowledgeSortFilterCapsule value={listSort} onChange={setListSort} />}
                />
              ) : null}
              <KnowledgeSourcesBulkBar
                count={selected.size}
                noun="snippet"
                busy={bulkDeleting}
                onRequestDelete={openBulkDeleteModal}
                onClear={clearSelection}
              />
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
                aria-label="Snippets list"
              >
                {pagedIndices.map((i) => {
                  const s = displaySnippets[i]!;
                  const rawTitle = (s.title || '').trim();
                  const head = rawTitle || `Snippet ${i + 1}`;
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
                          {!deleting &&
                          !bulkDeleting &&
                          (!isKnowledgeRowDeleteBlocked(noteStatusSlice, s.knowledgeItemId, s) ||
                            selected.has(i)) ? (
                            <Checkbox
                              checked={selected.has(i)}
                              onChange={() => toggleOneSelected(i)}
                              aria-label={`Select snippet: ${head}`}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 pr-9 sm:pr-10">
                          <button
                            type="button"
                            onClick={() => {
                              void navigate(`${base}/notes/${i}`);
                            }}
                            className="w-full rounded-md border-0 bg-transparent px-0 py-0 text-left leading-snug"
                          >
                            <p className="m-0 text-sm font-medium leading-tight text-slate-900">{head}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                              <span
                                className="tabular-nums"
                                title="Approximate stored UTF-8 size for this snippet"
                              >
                                {formatKnowledgeBytes(snippetKnowledgeItemStoredUtf8Bytes(s))}
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span className="inline-flex max-w-full min-w-0 items-center">
                                <KbTrainingStatusTagWithSchedule
                                  label={kbMergedTrainingStatusChipLabel({ ...s, sourceType: 'note' })}
                                  statusForBadge={kbMergedTrainingStatusDotCanon({ ...s, sourceType: 'note' })}
                                  row={{ runAfter: s.runAfter ?? null }}
                                  dotCanon={kbMergedTrainingStatusDotCanon({ ...s, sourceType: 'note' })}
                                  showHoverDescription
                                />
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <KnowledgeUseInRepliesTag active={s.active !== false} showHoverDescription />
                            </div>
                          </button>
                        </div>
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
                                    void toggleSnippetUseInReplies(s.knowledgeItemId!, s.active !== false);
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
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-[var(--color-danger-text-emphasis)] hover:bg-slate-50"
                                title="Delete this snippet"
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
        onConfirm={() => void confirmAddSnippet()}
        title="Add this snippet?"
        description="It will be saved to this bot’s knowledge base."
        bodyNote={
          <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
            You can edit or remove this snippet anytime from your snippets library.
          </p>
        }
        confirmLabel="Add snippet"
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
      <Modal
        open={importOpen}
        onClose={() => {
          if (importingCsv) return;
          setImportOpen(false);
          setImportErrors([]);
        }}
        title={
          <span className="inline-flex items-center gap-2">
            <StickyNote size={16} className="text-teal-600" aria-hidden />
            <span>Import snippets from CSV</span>
          </span>
        }
        description="Required columns: title, snippet"
        allowDismiss={!importingCsv}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (importingCsv) return;
                setImportOpen(false);
                setImportErrors([]);
              }}
              disabled={importingCsv}
            >
              Close
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => importFileRef.current?.click()} disabled={importingCsv}>
              {importingCsv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload size={14} aria-hidden />}
              {importingCsv ? 'Importing…' : 'Choose CSV'}
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold tracking-wide text-slate-700">CSV Template</p>
              <p className="m-0 mt-1 text-xs text-slate-600">
                Download the sample and fill each row with a title and snippet text before upload.
              </p>
            </div>
            <Button
              type="button"
              variant="outlinePrimary"
              size="sm"
              className="shrink-0"
              onClick={() => void downloadSnippetSampleCsv()}
              disabled={importingCsv}
            >
              <Download size={14} aria-hidden />
              Get template
            </Button>
          </div>
        </div>
        {importErrors.length > 0 ? (
          <div className="mt-3 max-h-56 overflow-auto rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="m-0 mb-2 text-xs font-medium text-rose-700">Fix these rows and re-import:</p>
            <ul className="m-0 list-disc pl-5 text-xs text-rose-700">
              {importErrors.slice(0, 50).map((e, i) => (
                <li key={`${e.row}-${e.column}-${i}`}>
                  Row {e.row} ({e.column}): {e.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
