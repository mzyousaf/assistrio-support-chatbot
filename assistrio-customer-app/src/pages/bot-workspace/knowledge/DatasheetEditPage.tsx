import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Maximize2, Pencil, Plus, Table2, Trash2 } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import { patchCustomerBot } from '../../../api/customerApi';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { Button, Checkbox, FieldRow, Input, Textarea, Modal } from '@/components/ui';
import {
  KnowledgeBackBreadcrumbRow,
  KnowledgeDeleteConfirmModal,
  KnowledgeSourcesBulkBar,
  KnowledgeSourcesPageSelectAll,
} from './knowledgeSourcesListUi';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import type { TableBlock } from './knowledgeViewTypes';
import {
  datasheetsFromBot,
  formatKbFileSizeDisplay,
  formatKbItemLastTrainedDateTime,
  kbItemTrainingStatusDotClassName,
  kbItemTrainingStatusLabel,
  tableBlockWithColumnsRemoved,
} from './knowledgeViewTypes';

/** Keep in sync with backend `KNOWLEDGE_TABLE_MAX_ROWS` */
const MAX_DATA_ROWS = 2000;
const MAX_CELL = 2000;
/** Default editor: fixed viewport slice for the table card. Full screen uses flex-1 instead (see `PlaygroundLayout` widget hidden). */
const DATASHEET_DATA_HEIGHT = 'h-[calc(100vh-370px)]';

const PRIMARY_CELL = 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]';
const PRIMARY_STICKY_EDGE = 'ring-1 ring-inset ring-white/15';
/** Data column width (header + body). */
const DATASHEET_COL_MAX = 'w-[300px] max-w-[300px] min-w-0';

export function DatasheetEditPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const rowSelectId = useId();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isFullscreen = /\/knowledgebase\/datasheets\/[^/]+\/fullscreen\/?$/.test(pathname);
  const { bot, loadState, softReload } = useBotWorkspace();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const isNew = indexParam === 'new';
  const numIndex = isNew ? -1 : Number.parseInt(String(indexParam), 10);

  const fromBot = useMemo(() => (bot ? datasheetsFromBot(bot) : []), [bot]);

  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [titleEditOpen, setTitleEditOpen] = useState(false);
  const [titleModalDraft, setTitleModalDraft] = useState('');
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
  const [columnDeleteIndex, setColumnDeleteIndex] = useState<number | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
  const [bulkRowDeleteOpen, setBulkRowDeleteOpen] = useState(false);

  useEffect(() => {
    if (isNew) {
      void navigate(`${base}/datasheets`, { replace: true });
    }
  }, [isNew, base, navigate]);

  const table = !isNew && Number.isFinite(numIndex) && numIndex >= 0 && numIndex < fromBot.length ? fromBot[numIndex]! : null;
  const columns = table?.columns ?? [];
  const rowIndexList = useMemo(() => (table ? table.rows.map((_, i) => i) : []), [table]);

  useEffect(() => {
    if (isNew) return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) {
      void navigate(`${base}/datasheets`, { replace: true });
      return;
    }
    setTitle(fromBot[numIndex]!.title || '');
  }, [isNew, numIndex, fromBot, loadState, bot, navigate, base]);

  useEffect(() => {
    if (!isFullscreen || indexParam == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void navigate(`${base}/datasheets/${indexParam}/edit`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen, indexParam, base, navigate]);

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

  const openTitleEdit = useCallback(() => {
    if (!table) return;
    setTitleModalDraft((title.trim() || 'Datasheet').trim() || 'Datasheet');
    setTitleEditOpen(true);
  }, [table, title]);

  const applyPatch = useCallback(
    async (next: TableBlock[], successMessage: string) => {
      if (!botId) return false;
      setSaving(true);
      try {
        const res = await patchCustomerBot(botId, { knowledgeDatasheets: next });
        if (!res.ok) {
          appToast.error('Could not save', { description: res.error });
          return false;
        }
        appToast.success(successMessage);
        await softReload();
        return true;
      } finally {
        setSaving(false);
      }
    },
    [botId, softReload],
  );

  const confirmRemoveColumn = useCallback(async () => {
    if (columnDeleteIndex == null || !table || !botId || numIndex < 0) {
      setColumnDeleteIndex(null);
      return;
    }
    if (columns.length <= 1) {
      appToast.error('Cannot remove column', { description: 'At least one column is required.' });
      setColumnDeleteIndex(null);
      return;
    }
    const nextT = tableBlockWithColumnsRemoved(table, new Set([columnDeleteIndex]));
    const next = fromBot.map((b, i) => (i === numIndex ? nextT : b));
    const ok = await applyPatch(next, 'Column removed');
    if (ok) setColumnDeleteIndex(null);
  }, [columnDeleteIndex, table, botId, numIndex, columns.length, fromBot, applyPatch]);

  const saveTitleFromModal = useCallback(async () => {
    if (!table || !botId || numIndex < 0) return;
    const t = titleModalDraft.trim() || 'Datasheet';
    const current = (table.title || 'Datasheet').trim() || 'Datasheet';
    if (t === current) {
      setTitleEditOpen(false);
      return;
    }
    const next: TableBlock[] = fromBot.map((block, i) => (i === numIndex ? { ...block, title: t } : block));
    const ok = await applyPatch(next, 'Title updated');
    if (ok) {
      setTitle(t);
      setTitleEditOpen(false);
    }
  }, [table, botId, numIndex, fromBot, titleModalDraft, applyPatch]);

  const titleModalUnchanged = useMemo(() => {
    if (!table) return true;
    const t = titleModalDraft.trim() || 'Datasheet';
    const current = (table.title || 'Datasheet').trim() || 'Datasheet';
    return t === current;
  }, [table, titleModalDraft]);

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
      const next: TableBlock[] = fromBot.map((b, i) => (i === numIndex ? nextTable : b));
      const ok = await applyPatch(
        next,
        rowModal.mode === 'add' ? 'Row added' : 'Row updated',
      );
      if (ok) {
        setRowModal(null);
        setRowDraft([]);
      }
    } finally {
      setRowModalBusy(false);
    }
  }, [table, botId, numIndex, columns, rowDraft, rowModal, fromBot, applyPatch]);

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
      const next: TableBlock[] = fromBot.map((b, i) => (i === numIndex ? nextTable : b));
      const res = await patchCustomerBot(botId, { knowledgeDatasheets: next });
      if (!res.ok) {
        appToast.error('Could not delete row', { description: res.error });
        return;
      }
      appToast.success('Row removed');
      setDeleteRowIndex(null);
      setSelectedRows((prev) => {
        const n = new Set<number>();
        for (const k of prev) {
          if (k === ri) continue;
          n.add(k > ri ? k - 1 : k);
        }
        return n;
      });
      await softReload();
    } finally {
      setRemoveRowBusy(false);
    }
  }, [deleteRowIndex, table, botId, numIndex, fromBot, softReload]);

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
      const next: TableBlock[] = fromBot.map((b, i) => (i === numIndex ? nextTable : b));
      const res = await patchCustomerBot(botId, { knowledgeDatasheets: next });
      if (!res.ok) {
        appToast.error('Could not delete rows', { description: res.error });
        return;
      }
      appToast.success(n === 1 ? 'Row removed' : `${n} rows removed`);
      setSelectedRows(new Set());
      setBulkRowDeleteOpen(false);
      await softReload();
    } finally {
      setRemoveRowBusy(false);
    }
  }, [selectedRows, table, botId, numIndex, fromBot, softReload]);

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
  const colSpanFull = columns.length + 3;
  const rowSelectLocked = saving || removeRowBusy;

  const rowBulkToolbar =
    table && table.rows.length > 0 && columns.length > 0 ? (
      <div
        className={cn(
          'shrink-0 space-y-2 border-b border-slate-200',
          isFullscreen ? 'px-3 py-2 sm:px-4' : 'px-4 py-2 sm:px-5',
        )}
      >
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
    ) : null;

  const trainingMetaRow =
    table ? (
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-600 sm:text-sm',
          !isFullscreen && 'border-t border-slate-200/90 pt-3',
        )}
        aria-label="Datasheet training and source file"
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              kbItemTrainingStatusDotClassName(table.trainingStatus),
            )}
            aria-hidden
          />
          <span className="text-slate-500">Training</span>
          <span className="font-medium text-slate-800">
            {kbItemTrainingStatusLabel(table.trainingStatus ?? null)}
          </span>
        </span>
        <span className="text-slate-300" aria-hidden>
          |
        </span>
        <span className="min-w-0">
          <span className="text-slate-500">Source file </span>
          <span
            className="font-medium text-slate-800 tabular-nums"
            title={table.importFileName ?? undefined}
          >
            {formatKbFileSizeDisplay(table.importFileSize ?? undefined)}
          </span>
        </span>
        <span className="text-slate-300" aria-hidden>
          |
        </span>
        <span>
          <span className="text-slate-500">Last trained </span>
          <time
            className="font-medium text-slate-800"
            dateTime={table.lastTrainedAt && table.lastTrainedAt.trim() ? table.lastTrainedAt : undefined}
          >
            {formatKbItemLastTrainedDateTime(table.lastTrainedAt)}
          </time>
        </span>
      </div>
    ) : null;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-1 flex-col overflow-hidden',
        isFullscreen
          ? 'h-[calc(100dvh-var(--nav-height))] min-h-0 gap-2 px-2 pb-2 sm:px-4'
          : 'h-full min-h-0 gap-6 px-0 pb-10',
      )}
      data-knowledge-datasheet-editor
      data-datasheet-fullscreen={isFullscreen || undefined}
    >
      <div className="shrink-0">
        <KnowledgeBackBreadcrumbRow
          backLabel={isFullscreen ? 'Exit full screen' : 'Back'}
          onBack={() =>
            void navigate(
              isFullscreen ? `${base}/datasheets/${indexParam}/edit` : `${base}/datasheets/${indexParam}`,
            )
          }
          sectionLabel="Datasheets"
          lastCrumb={displayTitle}
          tailLabel={isFullscreen ? 'Full screen' : 'Edit'}
        />
      </div>

      {isFullscreen ? (
        <header className="shrink-0 space-y-2 border-b border-slate-200/90 pb-2">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-1.5 sm:max-w-2xl">
              <h1
                className={cn(
                  styles.workspaceEditorH1,
                  'm-0 min-w-0 flex-1 truncate !leading-tight !tracking-tight',
                )}
                title={displayTitle}
              >
                {displayTitle}
              </h1>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-m-0.5 h-7 w-7 shrink-0 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                onClick={openTitleEdit}
                disabled={saving}
                title="Edit datasheet name"
                aria-label="Edit datasheet name"
              >
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0">
              {indexParam != null ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={styles.knowledgeFormActionSecondary}
                  disabled={saving}
                  onClick={() => void navigate(`${base}/datasheets/${indexParam}`)}
                >
                  Cancel
                </Button>
              ) : null}
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
            </div>
          </div>
          {trainingMetaRow}
        </header>
      ) : (
        <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0 !mb-0')}>
          <div className={cn(styles.workspaceEditorTitleBlock, 'max-w-xl sm:max-w-2xl')}>
            <div className="space-y-1.5">
              <div className="inline-flex w-full min-w-0 max-w-full items-center gap-1.5 sm:gap-1">
                <h1
                  className={cn(
                    styles.workspaceEditorH1,
                    'm-0 inline-block min-w-0 max-w-[calc(100%-1.75rem)] align-middle !leading-tight !tracking-tight truncate',
                  )}
                  title={displayTitle}
                >
                  {displayTitle}
                </h1>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-m-0.5 h-7 w-7 shrink-0 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={openTitleEdit}
                  disabled={saving}
                  title="Edit datasheet name"
                  aria-label="Edit datasheet name"
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </div>
              <p className={cn(styles.workspaceEditorLeadFull, 'mb-3')}>
                <span className="font-medium text-slate-600">Column headers</span> match your import and stay read-only on
                this page. <span className="font-medium text-slate-600">Add or edit rows</span> in the table below. When
                you update, this assistant’s knowledge base is updated.
              </p>
              {trainingMetaRow}
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
                  onClick={() => void navigate(`${base}/datasheets/${indexParam}`)}
                >
                  Cancel
                </Button>
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
                  onClick={() => void navigate(`${base}/datasheets/${indexParam}/fullscreen`)}
                  title={columns.length === 0 ? 'No columns in this datasheet' : 'Open full screen editor (more space)'}
                  aria-label="Open full screen editor"
                >
                  <Maximize2 size={16} className="shrink-0" aria-hidden />
                  Full screen
                </Button>
              </>
            ) : null}
          </div>
        </header>
      )}

      <div
        className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden"
      >
        {columns.length > 0 ? (
          <div
            className={cn(
              'flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white',
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
                    <th
                      className="sticky left-11 top-0 z-30 w-10 min-w-10 border-b border-r border-slate-200 bg-slate-50 p-0 text-center align-middle shadow-[4px_0_12px_-4px_rgba(15,23,42,0.06)]"
                      scope="col"
                    >
                      <span className="sr-only">Select row</span>
                    </th>
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
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="line-clamp-2 min-w-0 flex-1 break-words leading-snug">{headLabel}</span>
                            {columns.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 shrink-0 p-0 text-slate-400 hover:text-red-600"
                                disabled={saving}
                                title={`Remove column “${headLabel}” from every row`}
                                aria-label={`Remove column ${headLabel}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setColumnDeleteIndex(ci);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                              </Button>
                            ) : null}
                          </div>
                        </th>
                      );
                    })}
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
                              Rows are what the assistant matches against. Add your first row to start building this datasheet.
                            </p>
                          </div>
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
        open={titleEditOpen}
        onClose={() => {
          if (saving) return;
          setTitleEditOpen(false);
        }}
        allowDismiss={!saving}
        title="Datasheet name"
        description="Shown in your knowledge library and in retrieval. Column names are not edited here."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.knowledgeFormActionSecondary}
              onClick={() => setTitleEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className={styles.knowledgeModalActionPrimary}
              disabled={saving || titleModalUnchanged}
              aria-busy={saving}
              onClick={() => void saveTitleFromModal()}
            >
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {saving ? 'Updating…' : 'Update'}
            </Button>
          </>
        }
      >
        <FieldRow
          label="Title"
          htmlFor="ds-title-modal"
          helperText="Use a short, recognizable name for this datasheet."
        >
          <Input
            id="ds-title-modal"
            quiet
            className="w-full min-w-0"
            value={titleModalDraft}
            onChange={(e) => setTitleModalDraft(e.target.value)}
            autoComplete="off"
            placeholder="e.g. Product catalog, FAQs grid"
            maxLength={200}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!saving && !titleModalUnchanged) {
                  void saveTitleFromModal();
                }
              }
            }}
          />
        </FieldRow>
      </Modal>

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

      <KnowledgeDeleteConfirmModal
        open={columnDeleteIndex !== null}
        onClose={() => {
          if (saving) return;
          setColumnDeleteIndex(null);
        }}
        onConfirm={() => void confirmRemoveColumn()}
        title="Remove this column?"
        description={
          columnDeleteIndex != null
            ? `“${(columns[columnDeleteIndex] ?? '').trim() || `Column ${columnDeleteIndex + 1}`}” is removed for every row. You can re-import the file if you need that column back.`
            : ''
        }
        busy={saving}
        confirmLabel="Remove column"
      />
    </div>
  );
}
