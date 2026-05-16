import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Maximize2, Pencil, Plus, Table2, Trash2 } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import {
  toastKnowledgeUseInRepliesSaveFailed,
  toastKnowledgeUseInRepliesSaved,
} from '@/lib/knowledgeItemActionToasts';
import { useNotifyKbItemDeletedOnce, tryHandleCustomerResourceGone } from '@/lib/customerResourceUnavailable';
import { patchCustomerKnowledgeDatasheet, patchCustomerKnowledgeItemUseInReplies } from '../../../api/customerApi';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { useKnowledgeStorageUx } from '@/context/KnowledgeStorageUxContext';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { Button, Checkbox, FieldRow, Input, Textarea, Modal } from '@/components/ui';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KbTrainingStatusTag, KbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';
import {
  KnowledgeDeleteConfirmModal,
  KnowledgeSourcesBulkBar,
  KnowledgeSourcesPageSelectAll,
  useKnowledgeTrainingGateModal,
} from './knowledgeSourcesListUi';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import type { TableBlock } from './knowledgeViewTypes';
import { KNOWLEDGE_INLINE_TITLE_INPUT_WRAPPER_CLASS } from './knowledgeItemDetailShared';
import { useSyncKnowledgeLiveCrumb, useKnowledgeItemBreadcrumbsHiddenWhile } from './knowledgeItemRouteLayouts';
import {
  datasheetsFromBot,
  datasheetGridUtf8Bytes,
  kbMergedTableTrainingChip,
  kbMergedTableTrainingDotCanon,
  mergeTableRowsWithKbStatusPoll,
} from './knowledgeViewTypes';
import { KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES, KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES, clampStrUtf8Bytes } from '@/lib/knowledgeContentUtf8Limits';
import {
  isKnowledgeStorageDatasheetViewOnly,
  KB_STORAGE_DATASHEET_VIEW_ONLY_MESSAGE,
  KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE,
  knowledgeRowIndicatesPlanLimitTotal,
} from '@/lib/knowledgeStorageLimits';
import { DATASHEET_LOCKED_COLUMNS_LEAD, DATASHEET_LOCKED_COLUMNS_TITLE_HINT } from './datasheetEditCopy';
import { KnowledgeDetailUseInRepliesSwitchRow } from './knowledgeItemDetailShared';
import { findKnowledgeStatusItemById } from '@/lib/knowledgeTrainingMutationGate';

/** Keep in sync with backend `KNOWLEDGE_TABLE_MAX_ROWS` */
const MAX_DATA_ROWS = 2000;
const MAX_CELL = 2000;
/** Default editor: fixed viewport slice for the table card. Full screen uses flex-1 instead (see `PlaygroundLayout` widget hidden). */
const DATASHEET_DATA_HEIGHT = 'h-[calc(100vh-370px)]';

const PRIMARY_CELL = 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]';
const PRIMARY_STICKY_EDGE = 'ring-1 ring-inset ring-white/15';
/** Data column width (header + body). */
const DATASHEET_COL_MAX = 'w-[300px] max-w-[300px] min-w-0';

function tableBlockToPatchBody(block: TableBlock): Record<string, unknown> {
  return {
    title: (block.title || 'Datasheet').trim() || 'Datasheet',
    columns: block.columns.map((c) => String(c ?? '')),
    rows: block.rows.map((r) =>
      Array.isArray(r) ? r.map((c) => String(c ?? '').slice(0, MAX_CELL)) : [],
    ),
    active: block.active !== false,
  };
}

export function DatasheetEditPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const rowSelectId = useId();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isFullscreen = /\/knowledgebase\/datasheets\/[^/]+\/fullscreen\/?$/.test(pathname);
  const { bot, loadState, softReload } = useBotWorkspace();
  const { notifyPlanLimitFromApi, interceptKnowledgeStorageIncrease, knowledgeUsage } = useKnowledgeStorageUx();
  const storageViewOnly = isKnowledgeStorageDatasheetViewOnly(knowledgeUsage);
  const readOnlyMode = storageViewOnly;
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const isNew = indexParam === 'new';
  const numIndex = isNew ? -1 : Number.parseInt(String(indexParam), 10);

  const fromBot = useMemo(() => (bot ? datasheetsFromBot(bot) : []), [bot]);
  const tableStatusSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'table'),
    [knowledgeStatusItems],
  );
  const mergedTables = useMemo(
    () => mergeTableRowsWithKbStatusPoll(fromBot, tableStatusSlice),
    [fromBot, tableStatusSlice],
  );

  const notifyKbDeleted = useNotifyKbItemDeletedOnce(botId, indexParam);

  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleEditingRef = useRef(false);
  const skipTitleBlurCommitRef = useRef(false);
  const [rowModal, setRowModal] = useState<null | { mode: 'add' } | { mode: 'edit'; rowIndex: number }>(null);
  const [rowDraft, setRowDraft] = useState<string[]>([]);
  const [rowModalBusy, setRowModalBusy] = useState(false);
  const [deleteRowIndex, setDeleteRowIndex] = useState<number | null>(null);
  const [removeRowBusy, setRemoveRowBusy] = useState(false);
  const [cellView, setCellView] = useState<{
    rowIndex: number;
    colIndex: number;
    colLabel: string;
    value: string;
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
  const [bulkRowDeleteOpen, setBulkRowDeleteOpen] = useState(false);
  const [patchUseInRepliesBusy, setPatchUseInRepliesBusy] = useState(false);

  useEffect(() => {
    titleEditingRef.current = titleEditing;
  }, [titleEditing]);

  useEffect(() => {
    if (isNew) {
      void navigate(`${base}/datasheets`, { replace: true });
    }
  }, [isNew, base, navigate]);

  useEffect(() => {
    if (!botId || isNew) return;
    void refreshKnowledgeStatus('table');
  }, [botId, isNew, refreshKnowledgeStatus]);

  const table = !isNew && Number.isFinite(numIndex) && numIndex >= 0 && numIndex < fromBot.length ? fromBot[numIndex]! : null;
  const tableForTraining =
    table && Number.isFinite(numIndex) && numIndex >= 0 && numIndex < mergedTables.length
      ? mergedTables[numIndex]!
      : table;
  const datasheetPollItemId = (tableForTraining?.knowledgeItemId ?? '').trim();
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();
  const kbPollForDatasheet = useMemo(
    () =>
      datasheetPollItemId ? findKnowledgeStatusItemById(tableStatusSlice, datasheetPollItemId) ?? null : null,
    [tableStatusSlice, datasheetPollItemId],
  );

  useKbKnowledgeStatusPollInterest(
    Boolean(botId && !isNew && table),
    'table',
    datasheetPollItemId || undefined,
  );

  const columns = table?.columns ?? [];
  const rowIndexList = useMemo(() => (table ? table.rows.map((_, i) => i) : []), [table]);
  const gridUtf8Budget = useMemo(() => (table ? datasheetGridUtf8Bytes(table) : 0), [table]);

  useEffect(() => {
    if (isNew) return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) {
      notifyKbDeleted();
      void navigate(`${base}/datasheets`, { replace: true });
      return;
    }
    setTitle(fromBot[numIndex]!.title || '');
  }, [isNew, numIndex, fromBot, loadState, bot, navigate, base, notifyKbDeleted]);

  useEffect(() => {
    if (!storageViewOnly || isFullscreen) return;
    void navigate('..', { replace: true });
  }, [storageViewOnly, isFullscreen, navigate]);

  useEffect(() => {
    if (!isFullscreen || indexParam == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (titleEditingRef.current) return;
      e.preventDefault();
      void navigate(storageViewOnly ? '..' : '../edit', { relative: 'path' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen, indexParam, navigate, storageViewOnly]);

  useEffect(() => {
    if (!table) return;
    setSelectedRows((prev) => {
      const n = new Set<number>();
      for (const k of prev) {
        if (k >= 0 && k < table.rows.length) n.add(k);
      }
      return n;
    });
  }, [table?.rows.length]);

  const toggleAllRows = useCallback(() => {
    setSelectedRows((prev) => {
      const n = new Set(prev);
      const allOn = rowIndexList.length > 0 && rowIndexList.every((i) => n.has(i));
      if (allOn) rowIndexList.forEach((i) => n.delete(i));
      else rowIndexList.forEach((i) => n.add(i));
      return n;
    });
  }, [rowIndexList]);

  const toggleRowSelected = useCallback((ri: number) => {
    setSelectedRows((prev) => {
      const n = new Set(prev);
      if (n.has(ri)) n.delete(ri);
      else n.add(ri);
      return n;
    });
  }, []);

  const clearRowSelection = useCallback(() => setSelectedRows(new Set()), []);

  useEffect(() => {
    if (!titleEditing) return;
    const el = titleInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [titleEditing]);

  const openTitleEdit = useCallback(() => {
    if (readOnlyMode) return;
    if (!table) return;
    setTitleDraft((title.trim() || 'Datasheet').trim() || 'Datasheet');
    setTitleEditing(true);
  }, [readOnlyMode, table, title]);

  const cancelTitleEdit = useCallback(() => {
    if (saving) return;
    skipTitleBlurCommitRef.current = true;
    setTitleEditing(false);
    queueMicrotask(() => {
      skipTitleBlurCommitRef.current = false;
    });
  }, [saving]);

  const applyPatch = useCallback(
    async (updatedTable: TableBlock, successMessage: string) => {
      if (storageViewOnly) {
        appToast.error('View only', { description: KB_STORAGE_DATASHEET_VIEW_ONLY_MESSAGE });
        return false;
      }
      if (!botId || numIndex < 0) return false;
      if (tableForTraining && blockIfTrainingForItem(kbPollForDatasheet, tableForTraining)) return false;
      const gridBytes = datasheetGridUtf8Bytes(updatedTable);
      if (gridBytes > KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES) {
        appToast.error('Could not save', {
          description: `Stored table content exceeds ${formatKnowledgeBytes(KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES)}. Shorten titles or cells and try again.`,
        });
        return false;
      }
      const prevBytes = table ? datasheetGridUtf8Bytes(table) : 0;
      const delta = gridBytes - prevBytes;
      if (!(await interceptKnowledgeStorageIncrease(delta, KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE))) {
        return false;
      }
      setSaving(true);
      try {
        const res = await patchCustomerKnowledgeDatasheet(botId, numIndex, tableBlockToPatchBody(updatedTable));
        if (tryHandleCustomerResourceGone(navigate, res, `${base}/datasheets`)) {
          return false;
        }
        if (!res.ok) {
          if (notifyPlanLimitFromApi(res)) {
            return false;
          }
          appToast.error('Could not save', { description: res.error });
          return false;
        }
        appToast.success(successMessage);
        await softReload();
        requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
        void refreshKnowledgeStatus('table');
        void refreshTrainingStatus();
        return true;
      } finally {
        setSaving(false);
      }
    },
    [
      botId,
      numIndex,
      softReload,
      navigate,
      base,
      notifyPlanLimitFromApi,
      table,
      interceptKnowledgeStorageIncrease,
      refreshKnowledgeStatus,
      refreshTrainingStatus,
      tableForTraining,
      blockIfTrainingForItem,
      kbPollForDatasheet,
      storageViewOnly,
    ],
  );

  const commitTitleDraft = useCallback(async () => {
    if (!table || !botId || numIndex < 0) return;
    const t = titleDraft.trim() || 'Datasheet';
    const current = (table.title || 'Datasheet').trim() || 'Datasheet';
    if (t === current) {
      setTitleEditing(false);
      return;
    }
    const ok = await applyPatch({ ...table, title: t }, 'Title updated');
    if (ok) {
      setTitle(t);
      setTitleEditing(false);
    }
  }, [table, botId, numIndex, titleDraft, applyPatch]);

  const titleDraftUnchanged = useMemo(() => {
    if (!table) return true;
    const t = titleDraft.trim() || 'Datasheet';
    const current = (table.title || 'Datasheet').trim() || 'Datasheet';
    return t === current;
  }, [table, titleDraft]);

  const handleDatasheetTitleBlur = useCallback(() => {
    if (skipTitleBlurCommitRef.current) return;
    if (saving) return;
    if (titleDraftUnchanged) {
      setTitleEditing(false);
      return;
    }
    void commitTitleDraft();
  }, [saving, titleDraftUnchanged, commitTitleDraft]);

  const openAddRow = useCallback(() => {
    if (!table || columns.length === 0) return;
    if (table.rows.length >= MAX_DATA_ROWS) {
      appToast.error('Row limit reached', {
        description: `At most ${MAX_DATA_ROWS} rows are allowed on each datasheet.`,
      });
      return;
    }
    setRowDraft(columns.map(() => ''));
    setRowModal({ mode: 'add' });
  }, [table, columns.length]);

  const openEditRow = useCallback(
    (rowIndex: number) => {
      if (!table || columns.length === 0) return;
      const r = table.rows[rowIndex];
      if (!r) return;
      const full = r.slice(0, columns.length);
      while (full.length < columns.length) full.push('');
      setRowDraft(full.map((c) => c.slice(0, MAX_CELL)));
      setRowModal({ mode: 'edit', rowIndex });
    },
    [table, columns.length],
  );

  const closeRowModal = useCallback(() => {
    if (rowModalBusy) return;
    setRowModal(null);
    setRowDraft([]);
  }, [rowModalBusy]);

  const saveRowModal = useCallback(async () => {
    if (!table || !botId || numIndex < 0) return;
    if (columns.length === 0) return;
    setRowModalBusy(true);
    try {
      const nextRow = columns.map((_, ci) => (rowDraft[ci] ?? '').slice(0, MAX_CELL));
      let nextTable: TableBlock;
      if (rowModal?.mode === 'add') {
        nextTable = { ...table, rows: [...table.rows, nextRow] };
      } else if (rowModal?.mode === 'edit') {
        const ri = rowModal.rowIndex;
        nextTable = {
          ...table,
          rows: table.rows.map((r, i) => (i === ri ? nextRow : r)),
        };
      } else {
        return;
      }
      const ok = await applyPatch(
        nextTable,
        rowModal.mode === 'add' ? 'Row added' : 'Row updated',
      );
      if (ok) {
        setRowModal(null);
        setRowDraft([]);
      }
    } finally {
      setRowModalBusy(false);
    }
  }, [table, botId, numIndex, columns, rowDraft, rowModal, applyPatch]);

  const openDeleteRow = useCallback((rowIndex: number) => {
    setDeleteRowIndex(rowIndex);
  }, []);

  const confirmDeleteRow = useCallback(async () => {
    if (deleteRowIndex == null || !table || !botId || numIndex < 0) {
      setDeleteRowIndex(null);
      return;
    }
    const ri = deleteRowIndex;
    setRemoveRowBusy(true);
    try {
      const nextTable: TableBlock = { ...table, rows: table.rows.filter((_, i) => i !== ri) };
      const ok = await applyPatch(nextTable, 'Row removed');
      if (ok) {
        setDeleteRowIndex(null);
        setSelectedRows((prev) => {
          const n = new Set<number>();
          for (const k of prev) {
            if (k === ri) continue;
            n.add(k > ri ? k - 1 : k);
          }
          return n;
        });
      }
    } finally {
      setRemoveRowBusy(false);
    }
  }, [deleteRowIndex, table, botId, numIndex, applyPatch]);

  const openBulkRowDeleteModal = useCallback(() => {
    if (selectedRows.size === 0) return;
    setBulkRowDeleteOpen(true);
  }, [selectedRows]);

  const confirmBulkDeleteRows = useCallback(async () => {
    if (selectedRows.size === 0 || !table || !botId || numIndex < 0) {
      setBulkRowDeleteOpen(false);
      return;
    }
    const toRemove = new Set(selectedRows);
    const n = toRemove.size;
    setRemoveRowBusy(true);
    try {
      const nextTable: TableBlock = { ...table, rows: table.rows.filter((_, i) => !toRemove.has(i)) };
      const ok = await applyPatch(nextTable, n === 1 ? 'Row removed' : `${n} rows removed`);
      if (ok) {
        setSelectedRows(new Set());
        setBulkRowDeleteOpen(false);
      }
    } finally {
      setRemoveRowBusy(false);
    }
  }, [selectedRows, table, botId, numIndex, applyPatch]);

  const toggleUseInReplies = useCallback(
    async (next: boolean) => {
      if (storageViewOnly) return;
      if (!botId || numIndex < 0 || isNew) return;
      const t = fromBot[numIndex];
      if (!t) return;
      const knowledgeItemId = t.knowledgeItemId?.trim() ?? '';
      if (!knowledgeItemId) return;
      if (tableForTraining && blockIfTrainingForItem(kbPollForDatasheet, tableForTraining)) return;
      setPatchUseInRepliesBusy(true);
      try {
        const res = await patchCustomerKnowledgeItemUseInReplies(botId, knowledgeItemId, { useInReplies: next });
        if (!res.ok) {
          if (notifyPlanLimitFromApi(res)) return;
          toastKnowledgeUseInRepliesSaveFailed(res.error);
          return;
        }
        toastKnowledgeUseInRepliesSaved(next);
        await softReload();
        requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
        void refreshKnowledgeStatus('table');
        void refreshTrainingStatus();
      } finally {
        setPatchUseInRepliesBusy(false);
      }
    },
    [
      botId,
      numIndex,
      isNew,
      fromBot,
      softReload,
      notifyPlanLimitFromApi,
      refreshKnowledgeStatus,
      refreshTrainingStatus,
      tableForTraining,
      blockIfTrainingForItem,
      kbPollForDatasheet,
      storageViewOnly,
    ],
  );

  const datasheetEditorShellBusy =
    Boolean(botId) && !isNew && (loadState !== 'ok' || !bot || !table);

  useKnowledgeItemBreadcrumbsHiddenWhile(datasheetEditorShellBusy);

  useSyncKnowledgeLiveCrumb((title.trim() || 'Datasheet').trim() || 'Datasheet');

  if (!botId) return null;
  if (isNew) return null;
  if (loadState !== 'ok' || !bot) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center p-6" data-knowledge-datasheet-editor>
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }
  if (!table) return null;

  const displayTitle = (title.trim() || 'Datasheet').trim() || 'Datasheet';
  const colSpanFull = columns.length + (readOnlyMode ? 1 : 3);
  const rowSelectLocked = saving || removeRowBusy || readOnlyMode;

  const rowBulkToolbar =
    !readOnlyMode && table && table.rows.length > 0 && columns.length > 0 ? (
      <div
        className={cn(
          'shrink-0 border-b border-slate-200',
          isFullscreen ? 'px-3 sm:px-4' : 'px-4 sm:px-5',
        )}
      >
        <div className={cn(styles.knowledgeSourcesListControlsStack, 'py-2 !mb-0')}>
          <KnowledgeSourcesPageSelectAll
            id={rowSelectId}
            pageIndices={rowIndexList}
            selected={selectedRows}
            onToggleAllOnPage={toggleAllRows}
          />
          <KnowledgeSourcesBulkBar
            count={selectedRows.size}
            noun="row"
            busy={removeRowBusy}
            onRequestDelete={openBulkRowDeleteModal}
            onClear={clearRowSelection}
          />
        </div>
      </div>
    ) : null;

  const knowledgeItemId = table.knowledgeItemId?.trim() ?? '';

  const tTrain = tableForTraining ?? table;
  const datasheetPlanLimit = knowledgeRowIndicatesPlanLimitTotal({ trainingError: tTrain.trainingError });

  /** Training · Table Size · Use in replies — one row (matches list/detail wording). */
  const datasheetEditorMetaRow = (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-slate-600 sm:text-sm',
        isFullscreen && 'border-t border-slate-200/90 pt-3',
      )}
      aria-label="Datasheet training status, size, and use in replies"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {datasheetPlanLimit ? (
          <KbTrainingStatusTag className="font-normal" label="Storage limit reached" statusForBadge="failed" />
        ) : (
          <KbTrainingStatusTagWithSchedule
            label={kbMergedTableTrainingChip(tTrain)}
            statusForBadge={kbMergedTableTrainingDotCanon(tTrain)}
            row={{ runAfter: tTrain.runAfter ?? null }}
            dotCanon={kbMergedTableTrainingDotCanon(tTrain)}
            sublineLayout="inline-pipe"
          />
        )}
      </span>
      <span className="text-slate-300" aria-hidden>
        |
      </span>
      <span className="min-w-0 tabular-nums">
        <span className="text-slate-500">Table Size </span>
        <span
          className={cn(
            'font-medium text-slate-800',
            gridUtf8Budget > KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES && 'text-amber-900',
          )}
        >
          {formatKnowledgeBytes(gridUtf8Budget)}
        </span>
        <span className="font-medium text-slate-600">
          {' '}
          / {formatKnowledgeBytes(KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES)}
        </span>
      </span>
      {knowledgeItemId ? (
        <>
          <span className="text-slate-300" aria-hidden>
            |
          </span>
          <KnowledgeDetailUseInRepliesSwitchRow
            checked={table.active !== false}
            disabled={readOnlyMode || patchUseInRepliesBusy || saving}
            onCheckedChange={(next) => void toggleUseInReplies(next)}
          />
        </>
      ) : null}
    </div>
  );

  const datasheetTitleEditorFields = (
    <div className="flex w-full min-w-0 max-w-full flex-col items-stretch gap-1.5 pb-1">
      <Input
        ref={titleInputRef}
        id="ds-title-inline"
        inputSize="sm"
        wrapperClassName={KNOWLEDGE_INLINE_TITLE_INPUT_WRAPPER_CLASS}
        className="!h-7 min-h-0 py-0 text-base font-medium leading-tight tracking-tight text-slate-900 !px-0 sm:text-lg"
        value={titleDraft}
        onChange={(e) =>
          setTitleDraft(clampStrUtf8Bytes(e.target.value, KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES))
        }
        autoComplete="off"
        placeholder="e.g. Product catalog, FAQs grid"
        disabled={saving}
        onBlur={handleDatasheetTitleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelTitleEdit();
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!saving && !titleDraftUnchanged) {
              void commitTitleDraft();
            }
          }
        }}
      />
      <div className="flex w-full min-w-0 flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
        <KnowledgeUtf8Meter
          value={titleDraft}
          maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES}
          className="shrink-0"
        />
        <span className="min-w-0 text-xs leading-snug text-slate-500">{DATASHEET_LOCKED_COLUMNS_TITLE_HINT}</span>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-1 flex-col overflow-hidden',
        isFullscreen
          ? 'h-[calc(100dvh-var(--nav-height))] min-h-0 gap-2 px-2 pb-2 sm:px-4'
          : 'h-full min-h-0 gap-4 px-0 pb-4',
      )}
      data-knowledge-datasheet-editor
      data-datasheet-fullscreen={isFullscreen || undefined}
    >
      {isFullscreen ? (
        <header className="shrink-0 space-y-2 border-b border-slate-200/90 pb-2">
          {readOnlyMode ? (
            <p
              className="m-0 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-sm leading-snug text-amber-950 sm:px-4"
              role="status"
            >
              {KB_STORAGE_DATASHEET_VIEW_ONLY_MESSAGE}
            </p>
          ) : null}
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {titleEditing ? (
              <div className="w-full min-w-0 max-w-[min(100vw-3rem,42rem)]">{datasheetTitleEditorFields}</div>
            ) : (
              <div className="flex min-w-0 max-w-full flex-col items-start gap-1 pb-1 sm:max-w-2xl">
                <div className="flex max-w-full min-w-0 items-end gap-2">
                  <h1
                    className={cn(
                      styles.workspaceEditorH1,
                      'm-0 inline-block min-w-0 max-w-[calc(100%-1.75rem)] truncate !leading-tight !tracking-tight',
                      readOnlyMode && 'max-w-full',
                    )}
                    title={displayTitle}
                  >
                    {displayTitle}
                  </h1>
                  {readOnlyMode ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="inline-flex h-5 w-5 shrink-0 items-end justify-center p-0 pb-px text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      onClick={openTitleEdit}
                      disabled={saving}
                      title="Edit datasheet name"
                      aria-label="Edit datasheet name"
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    </Button>
                  )}
                </div>
                <KnowledgeUtf8Meter value={displayTitle} maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES} />
              </div>
            )}
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0">
              {indexParam != null ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={styles.knowledgeFormActionSecondary}
                  disabled={saving}
                  onClick={() => void navigate('..', { relative: 'path' })}
                >
                  {readOnlyMode ? 'Back' : 'Cancel'}
                </Button>
              ) : null}
              {readOnlyMode ? null : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={openAddRow}
                  disabled={saving}
                  className={styles.knowledgeFormActionPrimary}
                >
                  <Plus size={16} aria-hidden />
                  Add row
                </Button>
              )}
            </div>
          </div>
          {datasheetEditorMetaRow}
        </header>
      ) : (
        <header className={cn('mb-6 flex w-full min-w-0 flex-col gap-4 shrink-0 !mb-0')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div
              className={cn(
                styles.workspaceEditorTitleBlock,
                'w-full min-w-0 max-w-[min(100%,42rem)] pb-1 sm:max-w-2xl',
              )}
            >
              <div className="space-y-1.5">
                {titleEditing ? (
                  datasheetTitleEditorFields
                ) : (
                  <div className="flex w-full min-w-0 max-w-full flex-col items-start gap-1">
                    <div className="flex max-w-full min-w-0 items-end gap-2">
                      <h1
                        className={cn(
                          styles.workspaceEditorH1,
                          'm-0 inline-block min-w-0 max-w-[calc(100%-1.75rem)] truncate !leading-tight !tracking-tight',
                        )}
                        title={displayTitle}
                      >
                        {displayTitle}
                      </h1>
                      {readOnlyMode ? null : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="inline-flex h-5 w-5 shrink-0 items-end justify-center p-0 pb-px text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          onClick={openTitleEdit}
                          disabled={saving}
                          title="Edit datasheet name"
                          aria-label="Edit datasheet name"
                        >
                          <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        </Button>
                      )}
                    </div>
                    <KnowledgeUtf8Meter value={displayTitle} maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">
              {indexParam != null ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={styles.knowledgeFormActionSecondary}
                    disabled={saving}
                    onClick={() => void navigate('..', { relative: 'path' })}
                  >
                    {readOnlyMode ? 'Back' : 'Cancel'}
                  </Button>
                  {readOnlyMode ? null : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className={cn(
                        styles.knowledgeFormActionSecondary,
                        'border border-orange-500 bg-orange-500 text-white shadow-sm',
                        'hover:enabled:border-orange-600 hover:enabled:bg-orange-600',
                        'focus-visible:ring-orange-500/40',
                        '[&_svg]:text-white',
                      )}
                      disabled={saving || columns.length === 0}
                      onClick={() => void navigate('../fullscreen', { relative: 'path' })}
                      title={columns.length === 0 ? 'No columns in this datasheet' : 'Open full screen editor (more space)'}
                      aria-label="Open full screen editor"
                    >
                      <Maximize2 size={16} className="shrink-0" aria-hidden />
                      Full screen
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          </div>
          <div className="w-full min-w-0">
            <p className={cn(styles.workspaceEditorLeadFull, 'mb-0')}>{DATASHEET_LOCKED_COLUMNS_LEAD}</p>
            <div className="mt-2">{datasheetEditorMetaRow}</div>
          </div>
        </header>
      )}

      <div
        className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden"
      >
        {columns.length > 0 ? (
          <div
            className={cn(
              'flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white',
              isFullscreen
                ? 'min-h-0 flex-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                : cn('shrink-0', DATASHEET_DATA_HEIGHT, 'shadow-[0_1px_2px_rgba(15,23,42,0.04)]'),
            )}
          >
            {isFullscreen ? (
              <div className="flex min-w-0 shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-slate-200 px-4 py-2 sm:px-5">
                <p className="m-0 text-sm text-slate-600">
                  <span className="tabular-nums font-semibold text-slate-900">
                    {table.rows.length.toLocaleString()}
                  </span>
                  <span className="font-medium"> rows </span>
                  <span className="text-slate-400" aria-hidden>
                    ·{' '}
                  </span>
                  <span className="tabular-nums font-semibold text-slate-900">
                    {columns.length.toLocaleString()}
                  </span>
                  <span className="font-medium">
                    {' '}
                    {columns.length === 1 ? 'column' : 'columns'}
                  </span>
                </p>
                <span className="min-w-0 text-xs text-slate-400 md:text-sm">More columns off-screen — scroll sideways. Click a cell for full text.</span>
              </div>
            ) : (
              <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
                <div className="min-w-0 space-y-2.5">
                  <h2 className={styles.workspaceEditorSectionTitle}>Datasheet</h2>
                  {table.rows.length === 0 ? (
                    <p className={styles.workspaceEditorSectionDescription}>
                      No rows yet. Add a row to store values the assistant can look up from this datasheet.
                    </p>
                  ) : (
                    <ul className="m-0 max-w-2xl list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-500 marker:text-slate-300">
                      <li>
                        Row # and the action buttons stay fixed on the left and right so they remain visible when you
                        scroll horizontally.
                      </li>
                      <li>Click any cell to open and read the full cell content.</li>
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {table.rows.length > 0 ? (
                    <p className="m-0 text-right text-sm text-slate-600 sm:text-base">
                      <span className="tabular-nums font-semibold text-slate-900">
                        {table.rows.length.toLocaleString()}
                      </span>
                      <span className="font-medium"> rows </span>
                      <span className="text-slate-400" aria-hidden>
                        ·{' '}
                      </span>
                      <span className="tabular-nums font-semibold text-slate-900">
                        {columns.length.toLocaleString()}
                      </span>
                      <span className="font-medium">
                        {' '}
                        {columns.length === 1 ? 'column' : 'columns'}
                      </span>
                    </p>
                  ) : null}
                  {readOnlyMode ? null : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={openAddRow}
                      disabled={saving}
                      className={cn(styles.knowledgeFormActionPrimary, 'shrink-0')}
                    >
                      <Plus size={16} aria-hidden />
                      Add row
                    </Button>
                  )}
                </div>
              </div>
            )}
            {rowBulkToolbar}
            <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto p-0 sm:px-0">
              <table className="w-full min-w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th
                      className={cn(
                        'sticky left-0 top-0 z-40 w-11 min-w-[2.75rem] border-b border-r border-white/20',
                        'px-1 py-2.5 text-center align-middle text-xs font-semibold tabular-nums',
                        PRIMARY_CELL,
                        PRIMARY_STICKY_EDGE,
                        'shadow-[4px_0_12px_-4px_rgba(15,23,42,0.1)]',
                      )}
                      scope="col"
                    >
                      #
                    </th>
                    {readOnlyMode ? null : (
                      <th
                        className="sticky left-11 top-0 z-30 w-10 min-w-10 border-b border-r border-slate-200 bg-slate-50 p-0 text-center align-middle shadow-[4px_0_12px_-4px_rgba(15,23,42,0.06)]"
                        scope="col"
                      >
                        <span className="sr-only">Select row</span>
                      </th>
                    )}
                    {columns.map((c, ci) => {
                      const headLabel = c.trim() || `Column ${ci + 1}`;
                      return (
                        <th
                          key={`h-${ci}`}
                          className={cn(
                            'sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-2 text-left align-top text-xs font-medium text-slate-800',
                            DATASHEET_COL_MAX,
                          )}
                          title="From import (read-only)"
                          scope="col"
                        >
                          <span className="line-clamp-2 min-w-0 break-words leading-snug">{headLabel}</span>
                        </th>
                      );
                    })}
                    {readOnlyMode ? null : (
                      <th
                        className={cn(
                          'sticky right-0 top-0 z-40 w-20 min-w-20 border-b border-l border-slate-200',
                          'bg-slate-100 px-0 py-2 text-center align-middle text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500',
                          'shadow-[-4px_0_12px_-4px_rgba(15,23,42,0.1)]',
                        )}
                        scope="col"
                      >
                        <span className="sm:sr-only">Act.</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.length === 0 ? (
                    <tr>
                      <td colSpan={colSpanFull} className="border-b-0 p-0">
                        <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center sm:py-16">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                            <Table2 className="h-6 w-6" strokeWidth={1.5} aria-hidden />
                          </div>
                          <div className="max-w-sm space-y-1">
                            <p className="m-0 text-sm font-medium text-slate-800">No rows in this datasheet yet</p>
                            <p className="m-0 text-sm leading-relaxed text-slate-500">
                              {readOnlyMode
                                ? 'Free storage or upgrade your plan to add rows.'
                                : 'Rows are what the assistant matches against. Add your first row to start building this datasheet.'}
                            </p>
                          </div>
                          {readOnlyMode ? null : (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={openAddRow}
                              disabled={saving}
                              className="mt-1"
                            >
                              <Plus size={16} className="mr-1" aria-hidden />
                              Add first row
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    table.rows.map((row, ri) => {
                      const actionBg = ri % 2 === 1 ? 'bg-slate-50' : 'bg-white';
                      return (
                        <tr
                          key={`r-${ri}`}
                          className={cn(
                            'group border-b border-slate-100 bg-white',
                            'even:bg-slate-50 hover:bg-slate-100',
                          )}
                        >
                          <td
                            className={cn(
                              'sticky left-0 z-20 w-11 min-w-[2.75rem] border-r border-white/20 p-0 align-middle shadow-[4px_0_10px_-4px_rgba(15,23,42,0.08)]',
                              PRIMARY_CELL,
                              PRIMARY_STICKY_EDGE,
                              'text-center text-xs font-medium tabular-nums',
                              'group-hover:brightness-95',
                            )}
                            aria-label={`Row ${ri + 1}`}
                          >
                            <span className="flex h-full min-h-10 w-full items-center justify-center">
                              {ri + 1}
                            </span>
                          </td>
                          {readOnlyMode ? null : (
                            <td
                              className={cn(
                                'sticky left-11 z-20 w-10 min-w-10 border-r border-slate-200 p-0 align-middle',
                                'bg-inherit shadow-[4px_0_10px_-4px_rgba(15,23,42,0.06)]',
                              )}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <div className="flex h-full min-h-10 w-full items-center justify-center">
                                <Checkbox
                                  checked={selectedRows.has(ri)}
                                  onChange={() => toggleRowSelected(ri)}
                                  disabled={rowSelectLocked}
                                  aria-label={`Select row ${ri + 1}`}
                                />
                              </div>
                            </td>
                          )}
                          {columns.map((c, ci) => {
                            const colLabel = c.trim() || `Column ${ci + 1}`;
                            const v = row[ci] ?? '';
                            return (
                              <td
                                key={`c-${ri}-${ci}`}
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  DATASHEET_COL_MAX,
                                  'cursor-pointer align-middle px-2 py-2.5 text-slate-800',
                                  'bg-inherit outline-none',
                                  'hover:!bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300',
                                )}
                                title="View full cell content"
                                aria-label={`${colLabel}, row ${ri + 1}. View full cell content.`}
                                onClick={() =>
                                  setCellView({ rowIndex: ri, colIndex: ci, colLabel, value: v })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setCellView({ rowIndex: ri, colIndex: ci, colLabel, value: v });
                                  }
                                }}
                              >
                                <span className="line-clamp-2 min-w-0 break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                                  {v}
                                </span>
                              </td>
                            );
                          })}
                          {readOnlyMode ? null : (
                            <td
                              className={cn(
                                'sticky right-0 z-20 w-20 min-w-20 border-l border-slate-200 p-0 align-middle shadow-[-4px_0_10px_-4px_rgba(15,23,42,0.08)]',
                                'max-sm:opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-within:opacity-100',
                                'group-hover:!bg-slate-100/95',
                                actionBg,
                              )}
                            >
                              <div className="flex h-full min-h-9 w-full flex-row items-center justify-center gap-0.5 px-1 py-1.5">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 w-7 shrink-0 border border-slate-200/90 bg-white p-0 text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditRow(ri);
                                  }}
                                  disabled={rowSelectLocked}
                                  title={`Edit row ${ri + 1}`}
                                  aria-label={`Edit row ${ri + 1}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 w-7 shrink-0 border border-red-200/80 bg-rose-50/90 p-0 text-red-600 shadow-sm hover:border-red-300 hover:bg-red-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteRow(ri);
                                  }}
                                  disabled={rowSelectLocked}
                                  title={`Delete row ${ri + 1}`}
                                  aria-label={`Delete row ${ri + 1}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={cellView !== null}
        onClose={() => setCellView(null)}
        size="lg"
        title={cellView ? `Row ${cellView.rowIndex + 1} — ${cellView.colLabel}` : 'Cell value'}
        description="View full cell content. Line breaks are preserved."
        footer={
          <Button
            type="button"
            variant="primary"
            size="sm"
            className={styles.knowledgeModalActionPrimary}
            onClick={() => setCellView(null)}
          >
            Close
          </Button>
        }
      >
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          data-datasheet-cell-readonly
        >
          <pre
            className={cn(
              'm-0 min-h-8 font-sans text-sm leading-relaxed [white-space:pre-wrap] [word-break:break-word]',
              !cellView?.value ? 'text-slate-400' : 'text-slate-800',
            )}
          >
            {cellView?.value || '(empty)'}
          </pre>
        </div>
      </Modal>

      <Modal
        open={rowModal !== null}
        onClose={closeRowModal}
        allowDismiss={!rowModalBusy}
        size="lg"
        title={rowModal?.mode === 'add' ? 'Add row' : 'Edit row'}
        description="Values are limited to 2000 characters per cell. Changes apply when you confirm below."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.knowledgeFormActionSecondary}
              onClick={closeRowModal}
              disabled={rowModalBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className={styles.knowledgeModalActionPrimary}
              disabled={rowModalBusy}
              aria-busy={rowModalBusy}
              onClick={() => void saveRowModal()}
            >
              {rowModalBusy
                ? 'Updating…'
                : rowModal?.mode === 'add'
                  ? 'Add row'
                  : 'Update row'}
            </Button>
          </>
        }
      >
        <div className="flex min-w-0 flex-col gap-3" data-datasheet-row-form>
          {columns.map((col, ci) => {
            const label = col.trim() || `Column ${ci + 1}`;
            return (
              <FieldRow key={`rf-${ci}`} label={label} htmlFor={`row-field-${ci}`}>
                <Textarea
                  id={`row-field-${ci}`}
                  quiet
                  rows={2}
                  className="min-h-[2.75rem] w-full"
                  value={rowDraft[ci] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRowDraft((prev) => {
                      const n = columns.map((_, j) => prev[j] ?? '');
                      n[ci] = v;
                      return n;
                    });
                  }}
                  maxLength={MAX_CELL}
                />
              </FieldRow>
            );
          })}
        </div>
      </Modal>

      <KnowledgeDeleteConfirmModal
        open={deleteRowIndex != null}
        onClose={() => {
          if (removeRowBusy) return;
          setDeleteRowIndex(null);
        }}
        onConfirm={() => void confirmDeleteRow()}
        title="Delete this row?"
        description="The row is removed from this datasheet. You can add another row with “Add row” if you change your mind."
        busy={removeRowBusy}
        confirmLabel="Delete row"
      />

      <KnowledgeDeleteConfirmModal
        open={bulkRowDeleteOpen}
        onClose={() => {
          if (removeRowBusy) return;
          setBulkRowDeleteOpen(false);
        }}
        onConfirm={() => void confirmBulkDeleteRows()}
        title={
          selectedRows.size > 1
            ? `Delete ${selectedRows.size} rows?`
            : 'Delete this row?'
        }
        description={
          selectedRows.size > 1
            ? 'These rows are removed from this datasheet. This cannot be undone from here without re-adding the data.'
            : 'The row is removed from this datasheet. You can add another row with “Add row” if you change your mind.'
        }
        busy={removeRowBusy}
        confirmLabel="Delete"
      />

      {trainingGateModal}
    </div>
  );
}
