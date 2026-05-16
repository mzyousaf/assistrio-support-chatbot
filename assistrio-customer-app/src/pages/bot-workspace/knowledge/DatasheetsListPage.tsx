import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, MessageSquareReply, MoreVertical, Table2, Trash2, Upload } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import {
  toastKnowledgeUseInRepliesSaveFailed,
  toastKnowledgeUseInRepliesSaved,
} from '@/lib/knowledgeItemActionToasts';
import {
  KNOWLEDGE_TABLES_MAX,
  MAX_DATASHEET_IMPORT_FILE_BYTES,
  CUSTOMER_DATASHEET_UPLOAD_SIZE_MESSAGE,
} from '@/lib/botFieldLimits';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import {
  patchCustomerKnowledgeItemUseInReplies,
  postCustomerBotDatasheetImportCancel,
  postCustomerBotDatasheetImportConfirm,
  postCustomerBotDatasheetPreview,
} from '../../../api/customerApi';
import {
  bulkDeleteCustomerKnowledgeItems,
  KB_DELETE_REQUIRES_SYNC_MESSAGE,
  reportCustomerKnowledgeItemDeleteRejected,
} from '@/lib/customerKnowledgeItemDelete';
import { getDatasheetImportConfirmToast, isBenignDatasheetImportCancelResult } from '@/lib/datasheetImportSession';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { Button, Checkbox, Modal } from '@/components/ui';
import { KbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { useKnowledgeStorageUx, useDismissKnowledgeCompanionModalsOnStorageClose } from '@/context/KnowledgeStorageUxContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { findKnowledgeStatusItemById, isKnowledgeRowDeleteBlocked } from '@/lib/knowledgeTrainingMutationGate';
import { cn } from '@/lib/utils';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import { ws as styles } from '../workspace';
import {
  datasheetGridUtf8Bytes,
  datasheetsFromBot,
  kbMergedTableTrainingChip,
  kbMergedTableTrainingDotCanon,
  mergeTableRowsWithKbStatusPoll,
  type TableBlock,
} from './knowledgeViewTypes';
import { useKbTrainingStartedStatusRefetch } from './useKbTrainingStartedStatusRefetch';
import {
  clampKnowledgeSourcesPageSize,
  KNOWLEDGE_LIST_SORT_DEFAULT,
  KNOWLEDGE_SOURCES_PAGE_SIZE,
  type KnowledgeListSort,
  KnowledgeDeleteConfirmModal,
  KnowledgeSortFilterCapsule,
  KnowledgeSourcesBulkBar,
  KnowledgeSourcesPageSelectAll,
  KnowledgeSourcesPagination,
  KnowledgeSourcesToolbar,
  sortSourceIndices,
  useKnowledgeTrainingGateModal,
} from './knowledgeSourcesListUi';
import {
  KnowledgeUseInRepliesTag,
  KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS,
} from './knowledgeItemDetailShared';

const PREVIEW_MAX_ROWS = 10;

type ImportPreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      importSessionId: string;
      fileName: string;
      columns: string[];
      previewRows: string[][];
      totalDataRows: number;
    };

function datasheetSearchBlob(t: TableBlock): string {
  return [t.title, ...t.columns].join(' ').toLowerCase();
}

export function DatasheetsListPage() {
  const { id: botId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sourcesSearchId = useId();
  const pageSelectId = useId();
  const perPageSelectId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { bot, softReload } = useBotWorkspace();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const { interceptKnowledgeStorageIncrease, notifyPlanLimitFromApi } = useKnowledgeStorageUx();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const rows = useMemo(() => (bot ? datasheetsFromBot(bot) : []), [bot]);
  const atDatasheetLimit = rows.length >= KNOWLEDGE_TABLES_MAX;
  const tableStatusSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'table'),
    [knowledgeStatusItems],
  );
  const displayRows = useMemo(
    () => mergeTableRowsWithKbStatusPoll(rows, tableStatusSlice),
    [rows, tableStatusSlice],
  );
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();

  useKbTrainingStartedStatusRefetch(botId, 'table');

  useEffect(() => {
    if (!botId) return;
    void refreshKnowledgeStatus('table');
  }, [botId, refreshKnowledgeStatus]);

  useKbKnowledgeStatusPollInterest(Boolean(botId), 'table');

  const [importingSheet, setImportingSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [listSort, setListSort] = useState<KnowledgeListSort>(KNOWLEDGE_LIST_SORT_DEFAULT);
  const [listPageSize, setListPageSize] = useState(KNOWLEDGE_SOURCES_PAGE_SIZE);
  const [listPage, setListPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<null | { kind: 'row'; i: number } | 'bulk'>(null);
  /** Index into `rows` for which the per-row ⋮ menu is open. */
  const [datasheetRowMenuIndex, setDatasheetRowMenuIndex] = useState<number | null>(null);
  const [useInRepliesBusyId, setUseInRepliesBusyId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewState>({ kind: 'idle' });
  /** Column indices hidden in preview — sent as dropColumnIndices on import-confirm. */
  const [previewColumnsRemoved, setPreviewColumnsRemoved] = useState<Set<number>>(() => new Set());
  const importPreviewCancelRef = useRef(false);
  /** Set after successful import-confirm so modal close skips server cancel. */
  const importConfirmedRef = useRef(false);
  const importDismissInFlightRef = useRef(false);

  const filteredIndices = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return rows.map((_, i) => i);
    return rows
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => datasheetSearchBlob(t).includes(q))
      .map(({ i }) => i);
  }, [rows, listSearch]);

  const dsTitleKey = useCallback(
    (i: number) => (rows[i]?.title || `Datasheet ${i + 1}`).trim() || `Datasheet ${i + 1}`,
    [rows],
  );

  const sortedFilteredIndices = useMemo(
    () =>
      sortSourceIndices(filteredIndices, listSort, dsTitleKey, (i) => {
        const t = rows[i];
        return typeof t?.tableIndex === 'number' && Number.isFinite(t.tableIndex) ? t.tableIndex : i;
      }),
    [filteredIndices, listSort, dsTitleKey, rows],
  );

  const listPageCount = Math.max(1, Math.ceil(sortedFilteredIndices.length / listPageSize) || 1);
  const safeListPage = Math.min(listPage, listPageCount);

  useEffect(() => {
    setListPage(1);
  }, [listSearch, listPageSize]);

  useEffect(() => {
    setDatasheetRowMenuIndex(null);
  }, [listSearch, safeListPage, listPageSize]);

  useEffect(() => {
    if (datasheetRowMenuIndex == null) return;
    const menuId = `datasheet-row-menu-${datasheetRowMenuIndex}`;
    const onPointerDown = (e: PointerEvent) => {
      const root = document.getElementById(menuId);
      if (root && !root.contains(e.target as Node)) setDatasheetRowMenuIndex(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDatasheetRowMenuIndex(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [datasheetRowMenuIndex]);

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
        if (k >= 0 && k < rows.length) n.add(k);
      }
      return n;
    });
  }, [rows.length]);

  const isIndexSelectionBlockedForBulk = useCallback(
    (i: number) => {
      const row = displayRows[i];
      if (!row) return false;
      return isKnowledgeRowDeleteBlocked(tableStatusSlice, row.knowledgeItemId, row);
    },
    [displayRows, tableStatusSlice],
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
          const row = displayRows[i];
          if (row && isKnowledgeRowDeleteBlocked(tableStatusSlice, row.knowledgeItemId, row)) return prev;
          n.add(i);
        }
        return n;
      });
    },
    [displayRows, tableStatusSlice],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const dismissImportModal = useCallback(
    async (opts?: { evenIfImporting?: boolean }) => {
      if (!opts?.evenIfImporting && importingSheet) return;
      if (importDismissInFlightRef.current) return;
      importDismissInFlightRef.current = true;
      try {
        const skipCancel = importConfirmedRef.current;
        if (!skipCancel && botId && importPreview.kind === 'ready') {
          const res = await postCustomerBotDatasheetImportCancel(botId, {
            importSessionId: importPreview.importSessionId,
          });
          if (!isBenignDatasheetImportCancelResult(res) && import.meta.env.DEV && !res.ok) {
            console.warn('[datasheet import] import-cancel failed', res.error, res.errorCode);
          }
        }
      } finally {
        importPreviewCancelRef.current = true;
        importConfirmedRef.current = false;
        setImportModalOpen(false);
        setImportPreview({ kind: 'idle' });
        setPreviewColumnsRemoved(new Set());
        importDismissInFlightRef.current = false;
      }
    },
    [botId, importingSheet, importPreview],
  );

  useDismissKnowledgeCompanionModalsOnStorageClose(() => {
    void dismissImportModal({ evenIfImporting: true });
  });

  const runImportFromPending = useCallback(async () => {
    if (!botId) return;
    if (importPreview.kind !== 'ready') return;
    if (
      !(await interceptKnowledgeStorageIncrease(
        1,
        'This datasheet may fail after processing if it exceeds your remaining storage.',
      ))
    ) {
      return;
    }
    setImportingSheet(true);
    try {
      const dropColumnIndices =
        previewColumnsRemoved.size > 0 ? [...previewColumnsRemoved].sort((a, b) => a - b) : undefined;
      const res = await postCustomerBotDatasheetImportConfirm(botId, {
        importSessionId: importPreview.importSessionId,
        dropColumnIndices,
      });
      if (!res.ok) {
        if (notifyPlanLimitFromApi(res)) {
          return;
        }
        const toast = getDatasheetImportConfirmToast(res);
        if (res.errorCode === 'session_already_consumed') {
          importConfirmedRef.current = true;
          await softReload();
          void refreshTrainingStatus();
          void refreshKnowledgeStatus('table');
          requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
          if (toast) {
            appToast.info(toast.title, { description: toast.description });
          } else {
            appToast.info('Import already started', { description: 'Check your datasheets list.' });
          }
          await dismissImportModal({ evenIfImporting: true });
          return;
        }
        if (res.errorCode === 'import_session_cancelled' || res.errorCode === 'import_session_expired') {
          if (toast) {
            appToast.error(toast.title, { description: toast.description });
          }
          await dismissImportModal({ evenIfImporting: true });
          return;
        }
        if (toast) {
          appToast.error(toast.title, { description: toast.description });
        } else {
          appToast.error('Import failed', { description: res.error });
        }
        return;
      }
      importConfirmedRef.current = true;
      await softReload();
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('table');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
      appToast.success(
        res.data.idempotent ? 'Datasheet import already in progress' : 'Datasheet import started — training when ready',
      );
      await dismissImportModal({ evenIfImporting: true });
    } finally {
      setImportingSheet(false);
    }
  }, [
    botId,
    dismissImportModal,
    importPreview,
    interceptKnowledgeStorageIncrease,
    notifyPlanLimitFromApi,
    previewColumnsRemoved,
    refreshKnowledgeStatus,
    refreshTrainingStatus,
    softReload,
  ]);

  if (!botId) return null;

  const importSheetBusy = importPreview.kind === 'loading' || importingSheet;

  function requestImportFile(f: File | undefined) {
    if (!f || !botId) return;
    void (async () => {
      if (!(await interceptKnowledgeStorageIncrease(1))) return;
      if (atDatasheetLimit) {
        appToast.error('Datasheet limit reached', {
          description: `Each agent can have at most ${KNOWLEDGE_TABLES_MAX} datasheets. Remove one to import another.`,
        });
        return;
      }
      if (f.size > MAX_DATASHEET_IMPORT_FILE_BYTES) {
        appToast.error('File too large', { description: CUSTOMER_DATASHEET_UPLOAD_SIZE_MESSAGE });
        return;
      }
      importPreviewCancelRef.current = false;
      importConfirmedRef.current = false;
      setImportModalOpen(true);
      setPreviewColumnsRemoved(new Set());
      setImportPreview({ kind: 'loading' });
      const fd = new FormData();
      fd.append('file', f);
      const id = botId;
      const res = await postCustomerBotDatasheetPreview(id, fd);
      if (importPreviewCancelRef.current) return;
      if (!res.ok) {
        if (notifyPlanLimitFromApi(res)) {
          void dismissImportModal({ evenIfImporting: true });
          return;
        }
        setImportPreview({ kind: 'error', message: res.error });
        return;
      }
      setImportPreview({
        kind: 'ready',
        importSessionId: res.data.importSessionId,
        fileName: res.data.fileName,
        columns: res.data.columns,
        previewRows: res.data.previewRows,
        totalDataRows: res.data.totalDataRows,
      });
    })();
  }

  async function deleteDatasheetsByIndices(toRemove: Set<number>, message: string): Promise<boolean> {
    if (!botId) return false;
    await dismissImportModal({ evenIfImporting: true });
    setDeleting(true);
    try {
      const idsOrdered = [...toRemove].map((i) => displayRows[i]?.knowledgeItemId?.trim() ?? '');
      const useDeleteApi = idsOrdered.length === toRemove.size && idsOrdered.every((id) => id.length > 0);

      let resOk = false;
      if (useDeleteApi) {
        const delRes = await bulkDeleteCustomerKnowledgeItems(botId, idsOrdered);
        if (reportCustomerKnowledgeItemDeleteRejected(navigate, delRes, {
          notifyPlanLimitFromApi,
        })) {
          return false;
        }
        resOk = true;
      } else {
        appToast.error('Could not delete', { description: KB_DELETE_REQUIRES_SYNC_MESSAGE });
        return false;
      }

      if (!resOk) return false;
      appToast.success(message);
      setSelected((prev) => {
        const n = new Set(prev);
        toRemove.forEach((i) => n.delete(i));
        return n;
      });
      await softReload();
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('table');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
      return true;
    } finally {
      setDeleting(false);
    }
  }

  const toggleDatasheetUseInReplies = useCallback(
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
        requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
        void refreshKnowledgeStatus('table', id);
      } finally {
        setUseInRepliesBusyId(null);
      }
    },
    [botId, softReload, refreshKnowledgeStatus],
  );

  function openRowDeleteModal(i: number) {
    if (!botId) return;
    const row = displayRows[i];
    if (
      row &&
      blockIfTrainingForItem(
        findKnowledgeStatusItemById(tableStatusSlice, row.knowledgeItemId?.trim() ?? ''),
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
      const row = displayRows[i];
      if (
        row &&
        blockIfTrainingForItem(
          findKnowledgeStatusItemById(tableStatusSlice, row.knowledgeItemId?.trim() ?? ''),
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
      const ok = await deleteDatasheetsByIndices(new Set([i]), 'Datasheet removed');
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
    await dismissImportModal({ evenIfImporting: true });
    const n = selected.size;
    setBulkDeleting(true);
    try {
      const idsOrdered = [...selected].map((i) => displayRows[i]?.knowledgeItemId?.trim() ?? '');
      const useDeleteApi = idsOrdered.length === selected.size && idsOrdered.every((id) => id.length > 0);

      let resOk = false;
      if (useDeleteApi) {
        const delRes = await bulkDeleteCustomerKnowledgeItems(botId, idsOrdered);
        if (reportCustomerKnowledgeItemDeleteRejected(navigate, delRes, { notifyPlanLimitFromApi })) {
          return false;
        }
        resOk = true;
      } else {
        appToast.error('Could not delete', { description: KB_DELETE_REQUIRES_SYNC_MESSAGE });
        return false;
      }

      if (!resOk) return false;
      appToast.success(n === 1 ? 'Datasheet removed' : `${n} datasheets removed`);
      setSelected(new Set());
      await softReload();
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('table');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
      return true;
    } finally {
      setBulkDeleting(false);
    }
  }

  const selectedCount = selected.size;
  const deleteConfirmTitle =
    deleteModal === 'bulk'
      ? selectedCount > 1
        ? `Delete ${selectedCount} datasheets?`
        : 'Delete this datasheet?'
      : 'Delete this datasheet?';
  const deleteConfirmDescription =
    deleteModal === 'bulk' && selectedCount > 1
      ? 'These datasheets will stop being used for answers right away.'
      : 'This datasheet will stop being used for answers right away.';

  return (
    <div className={styles.knowledgeSourcesPageRoot} data-knowledge-datasheets-list>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-4 px-0 pb-10">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        tabIndex={-1}
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = '';
          requestImportFile(f);
        }}
      />
      <header className="mb-6 w-full min-w-0 shrink-0">
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className={styles.workspaceEditorH1}>Datasheets</h1>
          <div className="flex min-w-0 flex-col gap-2 sm:items-end">
            {!atDatasheetLimit ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className={cn(styles.knowledgeFormActionPrimary, 'w-full shrink-0 sm:w-auto')}
                disabled={importSheetBusy}
                onClick={() => fileRef.current?.click()}
                aria-busy={importSheetBusy || undefined}
              >
                <Upload size={15} strokeWidth={2} aria-hidden />
                {rows.length > 0 ? 'Import another (CSV / Excel)' : 'Import CSV / Excel'}
              </Button>
            ) : (
              <p className="m-0 max-w-md text-right text-xs leading-snug text-slate-500 sm:max-w-sm">
                This agent reached the maximum of {KNOWLEDGE_TABLES_MAX} datasheets. Remove one before importing another.
              </p>
            )}
          </div>
        </div>
        <p className={cn(styles.workspaceEditorLead, 'mt-2')}>
          Tabular data from CSV or Excel—catalogs, pricing, inventory, and more. Import a file below, or open a datasheet
          from the list to view and edit.
        </p>
      </header>

      <div
        className={cn(
          'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-visible rounded-xl border border-dashed border-slate-200/90 p-5 sm:p-6',
          rows.length === 0 ? 'bg-white' : 'border-slate-200/80 bg-white',
        )}
      >
        {rows.length === 0 ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center py-6 text-center sm:py-10">
            <div className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/80">
              <Table2 size={20} strokeWidth={1.75} className="text-teal-600" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">No datasheets yet</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
              Import a <span className="font-medium">CSV or Excel</span> file—e.g. product sheets, PIM or ERP exports, a database
              table, or any grid you use.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className={cn('mt-6', styles.knowledgeFormActionPrimary)}
              disabled={importSheetBusy || atDatasheetLimit}
              onClick={() => fileRef.current?.click()}
              aria-busy={importSheetBusy || undefined}
            >
              <Upload size={15} strokeWidth={2} aria-hidden />
              Import CSV / Excel
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <KnowledgeSourcesToolbar
              title="Datasheet Sources"
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
                noun="datasheet"
                busy={bulkDeleting}
                onRequestDelete={openBulkDeleteModal}
                onClear={clearSelection}
              />
            </div>
            {sortedFilteredIndices.length === 0 ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center py-10 text-center">
                <p className="m-0 text-sm font-medium text-slate-700">No matches</p>
                <p className="m-0 mt-1.5 text-sm text-slate-500">Try a different search term.</p>
              </div>
            ) : (
              <ul className="m-0 flex w-full list-none flex-col gap-3 p-0" aria-label="Datasheets list">
                {pagedIndices.map((i) => {
                  const t = displayRows[i]!;
                  const head = t.title || `Datasheet ${i + 1}`;
                  const rowKey =
                    typeof t.knowledgeItemId === 'string' && t.knowledgeItemId.trim()
                      ? t.knowledgeItemId.trim()
                      : `idx-${typeof t.tableIndex === 'number' ? t.tableIndex : i}-${head}`;
                  const gridUtf8 = datasheetGridUtf8Bytes(t);
                  const rowMenuOpen = datasheetRowMenuIndex === i;
                  return (
                    <li key={rowKey} className="min-w-0">
                      <div
                        className={cn(
                          'relative flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 ring-1 ring-slate-900/[0.02] transition-colors sm:px-4 sm:py-3',
                          'hover:border-slate-300/90 hover:bg-slate-50/80',
                          rowMenuOpen && 'z-50',
                        )}
                      >
                        <div
                          className="shrink-0 self-start pt-0.5 leading-none"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {!importSheetBusy &&
                          !deleting &&
                          !bulkDeleting &&
                          (!isKnowledgeRowDeleteBlocked(tableStatusSlice, t.knowledgeItemId, t) ||
                            selected.has(i)) ? (
                            <Checkbox
                              checked={selected.has(i)}
                              onChange={() => toggleOneSelected(i)}
                              aria-label={`Select datasheet: ${head}`}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 pr-9 sm:pr-10">
                          <Link
                            to={`${base}/datasheets/${i}`}
                            className="block w-full rounded-md border-0 bg-transparent px-0 py-0 no-underline"
                          >
                            <p className="m-0 text-sm font-medium leading-tight text-slate-900">{head}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                              <span
                                className="tabular-nums"
                                title="Approximate stored UTF-8 size for this datasheet (title + table cells)"
                              >
                                {formatKnowledgeBytes(gridUtf8)}
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span className="inline-flex max-w-full min-w-0 items-center">
                                <KbTrainingStatusTagWithSchedule
                                  label={kbMergedTableTrainingChip(t)}
                                  statusForBadge={kbMergedTableTrainingDotCanon(t)}
                                  row={{ runAfter: t.runAfter ?? null }}
                                  dotCanon={kbMergedTableTrainingDotCanon(t)}
                                  showHoverDescription
                                />
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <KnowledgeUseInRepliesTag active={t.active !== false} showHoverDescription />
                            </div>
                          </Link>
                        </div>
                        <div
                          id={`datasheet-row-menu-${i}`}
                          className="absolute right-1 top-1 z-10 sm:right-2 sm:top-2"
                        >
                          <button
                            type="button"
                            aria-expanded={rowMenuOpen}
                            aria-haspopup="menu"
                            aria-label={`Actions for datasheet: ${head}`}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:text-slate-700"
                            disabled={importSheetBusy || deleting || bulkDeleting}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDatasheetRowMenuIndex((prev) => (prev === i ? null : i));
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {rowMenuOpen ? (
                            <div
                              role="menu"
                              className="absolute right-0 top-[calc(100%+0.25rem)] z-20 min-w-[10.5rem] rounded-lg border border-slate-200 bg-white p-1 shadow-[var(--shadow-dropdown)]"
                            >
                              {t.knowledgeItemId?.trim() ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={
                                    importSheetBusy ||
                                    deleting ||
                                    bulkDeleting ||
                                    useInRepliesBusyId === t.knowledgeItemId.trim()
                                  }
                                  title={
                                    t.active !== false
                                      ? KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.active
                                      : KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.excluded
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDatasheetRowMenuIndex(null);
                                    void toggleDatasheetUseInReplies(t.knowledgeItemId!, t.active !== false);
                                  }}
                                >
                                  <MessageSquareReply className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                  <span className="min-w-0">
                                    {t.active !== false ? 'Turn off in replies' : 'Turn on in replies'}
                                  </span>
                                </button>
                              ) : null}
                              <button
                                type="button"
                                role="menuitem"
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-[var(--color-danger-text-emphasis)] hover:bg-slate-50"
                                title="Delete this datasheet"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDatasheetRowMenuIndex(null);
                                  openRowDeleteModal(i);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                <span className="min-w-0">Delete</span>
                              </button>
                            </div>
                          ) : null}
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
        open={importModalOpen}
        onClose={() => {
          void dismissImportModal();
        }}
        size="lg"
        className="!max-w-3xl"
        title="Import datasheet"
        description={
          importPreview.kind === 'ready' ? (
            <span className="break-all text-slate-500">{importPreview.fileName}</span>
          ) : null
        }
        allowDismiss={!importingSheet}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.knowledgeFormActionSecondary}
              onClick={() => {
                void dismissImportModal();
              }}
              disabled={importingSheet}
            >
              {importPreview.kind === 'error' ? 'Close' : 'Cancel'}
            </Button>
            {importPreview.kind === 'ready' ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                className={styles.knowledgeModalActionPrimary}
                disabled={importingSheet}
                aria-busy={importingSheet}
                onClick={() => void runImportFromPending()}
              >
                {importingSheet ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
                {importingSheet ? 'Importing…' : 'Import'}
              </Button>
            ) : null}
          </>
        }
      >
        {importPreview.kind === 'loading' ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="m-0 text-sm">Loading preview…</p>
          </div>
        ) : null}
        {importPreview.kind === 'error' ? (
          <p className="m-0 text-sm text-[var(--color-danger-text-emphasis)]">{importPreview.message}</p>
        ) : null}
        {importPreview.kind === 'ready' ? (
          <div>
            <p className="m-0 mb-2 text-xs text-slate-500">
              {importPreview.totalDataRows === 0
                ? 'No data rows in this sheet (headers only).'
                : `Preview: first ${Math.min(PREVIEW_MAX_ROWS, importPreview.totalDataRows)} of ${importPreview.totalDataRows} data row${
                    importPreview.totalDataRows === 1 ? '' : 's'
                  } (first worksheet).`}
            </p>
            <div className="max-h-64 w-full min-w-0 overflow-auto rounded-lg border border-slate-200/90">
              <table className="w-max min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {importPreview.columns
                      .map((c, ci) => ({ c, ci }))
                      .filter(({ ci }) => !previewColumnsRemoved.has(ci))
                      .map(({ c, ci }) => {
                        const visibleCount = importPreview.columns.filter(
                          (_, j) => !previewColumnsRemoved.has(j),
                        ).length;
                        const canRemove = visibleCount > 1;
                        return (
                          <th
                            key={ci}
                            className="sticky top-0 z-[1] min-w-[calc(100px+min-content)] border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left align-top text-xs font-semibold text-slate-600"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="min-w-0 break-words leading-snug">{c.trim() || `Column ${ci + 1}`}</span>
                              {canRemove ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 shrink-0 p-0 text-slate-400 hover:text-red-600"
                                  aria-label={`Remove column ${c.trim() || String(ci + 1)} from import`}
                                  onClick={() => setPreviewColumnsRemoved((prev) => new Set([...prev, ci]))}
                                >
                                  <Trash2 size={14} aria-hidden />
                                </Button>
                              ) : null}
                            </div>
                          </th>
                        );
                      })}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.previewRows.length === 0
                    ? null
                    : importPreview.previewRows.map((row, ri) => (
                        <tr key={ri} className="bg-white">
                          {importPreview.columns
                            .map((_, ci) => ci)
                            .filter((ci) => !previewColumnsRemoved.has(ci))
                            .map((ci) => (
                              <td
                                key={`p-${ri}-${ci}`}
                                className="min-w-[calc(100px+min-content)] max-w-[32rem] border-b border-slate-100 px-2 py-1.5 text-slate-800"
                              >
                                <span className="line-clamp-3 break-words">{row[ci] ?? ''}</span>
                              </td>
                            ))}
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
      </div>
    </div>
  );
}
