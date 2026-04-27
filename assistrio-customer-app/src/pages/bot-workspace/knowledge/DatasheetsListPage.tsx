import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Table2, Trash2, Upload } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import { MAX_DATASHEET_IMPORT_FILE_BYTES } from '@/lib/botFieldLimits';
import { getCustomerBot, patchCustomerBot, postCustomerBotDatasheetImport, postCustomerBotDatasheetPreview } from '../../../api/customerApi';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { Button, Checkbox, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import {
  datasheetsFromBot,
  formatKbItemLastTrainedRelative,
  kbItemTrainingStatusDotClassName,
  kbItemTrainingStatusLabel,
  tableBlockWithColumnsRemoved,
  type TableBlock,
} from './knowledgeViewTypes';
import {
  KNOWLEDGE_SOURCES_PAGE_SIZE,
  type KnowledgeListSort,
  KnowledgeDeleteConfirmModal,
  KnowledgeSortFilterCapsule,
  KnowledgeSourcesBulkBar,
  KnowledgeSourcesPageSelectAll,
  KnowledgeSourcesPagination,
  KnowledgeSourcesToolbar,
  sortSourceIndices,
} from './knowledgeSourcesListUi';

const PREVIEW_MAX_ROWS = 10;

type ImportPreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
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
  const sourcesSearchId = useId();
  const pageSelectId = useId();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { bot, softReload } = useBotWorkspace();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const rows = useMemo(() => (bot ? datasheetsFromBot(bot) : []), [bot]);
  const [importingSheet, setImportingSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [listSort, setListSort] = useState<KnowledgeListSort>('order');
  const [listPage, setListPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<null | { kind: 'row'; i: number } | 'bulk'>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewState>({ kind: 'idle' });
  /** Original column indices removed in import preview (applied after import via PATCH). */
  const [previewColumnsRemoved, setPreviewColumnsRemoved] = useState<Set<number>>(() => new Set());
  const importPreviewCancelRef = useRef(false);

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
    () => sortSourceIndices(filteredIndices, listSort, dsTitleKey),
    [filteredIndices, listSort, dsTitleKey],
  );

  const listPageCount = Math.max(1, Math.ceil(sortedFilteredIndices.length / KNOWLEDGE_SOURCES_PAGE_SIZE) || 1);
  const safeListPage = Math.min(listPage, listPageCount);

  useEffect(() => {
    setListPage(1);
  }, [listSearch]);

  useEffect(() => {
    if (listPage > listPageCount) setListPage(listPageCount);
  }, [listPage, listPageCount]);

  const pagedIndices = useMemo(() => {
    const start = (safeListPage - 1) * KNOWLEDGE_SOURCES_PAGE_SIZE;
    return sortedFilteredIndices.slice(start, start + KNOWLEDGE_SOURCES_PAGE_SIZE);
  }, [sortedFilteredIndices, safeListPage]);

  useEffect(() => {
    setSelected((prev) => {
      const n = new Set<number>();
      for (const k of prev) {
        if (k >= 0 && k < rows.length) n.add(k);
      }
      return n;
    });
  }, [rows.length]);

  const togglePageSelection = useCallback(() => {
    setSelected((prev) => {
      const n = new Set(prev);
      const allOn = pagedIndices.length > 0 && pagedIndices.every((i) => n.has(i));
      if (allOn) pagedIndices.forEach((i) => n.delete(i));
      else pagedIndices.forEach((i) => n.add(i));
      return n;
    });
  }, [pagedIndices]);

  const toggleOneSelected = useCallback((i: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  if (!botId) return null;

  const importSheetBusy = importPreview.kind === 'loading' || importingSheet;

  function closeImportModal() {
    if (importingSheet) return;
    importPreviewCancelRef.current = true;
    setImportModalOpen(false);
    setPendingImportFile(null);
    setImportPreview({ kind: 'idle' });
    setPreviewColumnsRemoved(new Set());
  }

  function requestImportFile(f: File | undefined) {
    if (!f || !botId) return;
    if (f.size > MAX_DATASHEET_IMPORT_FILE_BYTES) {
      appToast.error('File too large', { description: 'Each file must be 10 MB or less.' });
      return;
    }
    importPreviewCancelRef.current = false;
    setPendingImportFile(f);
    setImportModalOpen(true);
    setPreviewColumnsRemoved(new Set());
    setImportPreview({ kind: 'loading' });
    const fd = new FormData();
    fd.append('file', f);
    const id = botId;
    void (async () => {
      const res = await postCustomerBotDatasheetPreview(id, fd);
      if (importPreviewCancelRef.current) return;
      if (!res.ok) {
        setImportPreview({ kind: 'error', message: res.error });
        return;
      }
      setImportPreview({
        kind: 'ready',
        fileName: res.data.fileName,
        columns: res.data.columns,
        previewRows: res.data.previewRows,
        totalDataRows: res.data.totalDataRows,
      });
    })();
  }

  async function runImportFromPending() {
    if (!pendingImportFile || !botId) return;
    if (importPreview.kind !== 'ready') return;
    setImportingSheet(true);
    const removals = new Set(previewColumnsRemoved);
    try {
      const fd = new FormData();
      fd.append('file', pendingImportFile);
      const res = await postCustomerBotDatasheetImport(botId, fd);
      if (!res.ok) {
        appToast.error('Import failed', { description: res.error });
        return;
      }
      const idx = res.data.sheetIndex;
      const fresh = await getCustomerBot(botId);
      if (fresh.ok && removals.size > 0) {
        const list = datasheetsFromBot(fresh.data.bot);
        const t = list[idx];
        if (t && t.columns.length > 0) {
          const nextT = tableBlockWithColumnsRemoved(t, removals);
          if (nextT.columns.length > 0) {
            const next = list.map((b, j) => (j === idx ? nextT : b));
            const patchRes = await patchCustomerBot(botId, { knowledgeDatasheets: next });
            if (!patchRes.ok) {
              appToast.error('Imported, but column removals were not saved', { description: patchRes.error });
            }
          }
        }
      }
      await softReload();
      appToast.success('Datasheet imported');
      importPreviewCancelRef.current = true;
      setImportModalOpen(false);
      setPendingImportFile(null);
      setImportPreview({ kind: 'idle' });
      setPreviewColumnsRemoved(new Set());
      void navigate(`${base}/datasheets/${idx}`);
    } finally {
      setImportingSheet(false);
    }
  }

  async function deleteDatasheetsByIndices(toRemove: Set<number>, message: string): Promise<boolean> {
    if (!botId) return false;
    setDeleting(true);
    try {
      const next = rows.filter((_, i) => !toRemove.has(i));
      const res = await patchCustomerBot(botId, { knowledgeDatasheets: next });
      if (!res.ok) {
        appToast.error('Could not delete', { description: res.error });
        return false;
      }
      appToast.success(message);
      setSelected((prev) => {
        const n = new Set(prev);
        toRemove.forEach((i) => n.delete(i));
        return n;
      });
      await softReload();
      return true;
    } finally {
      setDeleting(false);
    }
  }

  function openRowDeleteModal(i: number) {
    if (!botId) return;
    setDeleteModal({ kind: 'row', i });
  }

  function openBulkDeleteModal() {
    if (!botId || selected.size === 0) return;
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
    const n = selected.size;
    setBulkDeleting(true);
    try {
      const next = rows.filter((_, i) => !selected.has(i));
      const res = await patchCustomerBot(botId, { knowledgeDatasheets: next });
      if (!res.ok) {
        appToast.error('Could not delete', { description: res.error });
        return false;
      }
      appToast.success(n === 1 ? 'Datasheet removed' : `${n} datasheets removed`);
      setSelected(new Set());
      await softReload();
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
      ? 'These datasheets will be removed from the assistant’s knowledge base. This cannot be undone.'
      : 'This datasheet will be removed from the assistant’s knowledge base. This cannot be undone.';

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 px-0 pb-6"
      data-knowledge-datasheets-list
    >
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
          {rows.length > 0 ? (
            <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                className={cn(styles.knowledgeFormActionPrimary, 'w-full sm:w-auto')}
                disabled={importSheetBusy}
                onClick={() => fileRef.current?.click()}
                aria-busy={importSheetBusy || undefined}
              >
                <Upload size={15} strokeWidth={2} aria-hidden />
                Import CSV / Excel
              </Button>
            </div>
          ) : null}
        </div>
        <p className={cn(styles.workspaceEditorLeadFull, 'mt-2')}>
          Import <span className="font-medium">CSV or Excel</span> to add tabular knowledge the assistant can search and
          cite. Use <span className="font-medium">product and catalog data</span> (SKUs, names, prices, features),{' '}
          <span className="font-medium">inventory or parts</span> lists, or{' '}
          <span className="font-medium">customer and support matrices</span>—alongside{' '}
          <span className="font-medium">database and warehouse exports</span> and any other spreadsheet your business
          already runs.
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
              disabled={importSheetBusy}
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
              title="DataSheet Sources"
              search={listSearch}
              onSearch={setListSearch}
              inputId={sourcesSearchId}
            />
            <div className="mb-3 flex w-full min-w-0 shrink-0 flex-col gap-2">
              {sortedFilteredIndices.length > 0 ? (
                <KnowledgeSourcesPageSelectAll
                  id={pageSelectId}
                  pageIndices={pagedIndices}
                  selected={selected}
                  onToggleAllOnPage={togglePageSelection}
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
              <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
                <ul className="m-0 flex w-full list-none flex-col gap-3 p-0" aria-label="Datasheets list">
                  {pagedIndices.map((i) => {
                    const t = rows[i]!;
                    const head = t.title || `Datasheet ${i + 1}`;
                    const nCol = t.columns.length;
                    const nRow = t.rows.length;
                    return (
                      <li key={i} className="min-w-0">
                        <div
                          className={cn(
                            'flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 ring-1 ring-slate-900/[0.02] transition-colors sm:px-4 sm:py-3',
                            'hover:border-slate-300/90 hover:bg-slate-50/80',
                          )}
                        >
                          <div
                            className="shrink-0 self-start pt-0.5 leading-none"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selected.has(i)}
                              onChange={() => toggleOneSelected(i)}
                              disabled={importSheetBusy || deleting || bulkDeleting}
                              aria-label={`Select datasheet: ${head}`}
                            />
                          </div>
                          <Link
                            to={`${base}/datasheets/${i}`}
                            className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-0 py-0 no-underline"
                          >
                            <p className="m-0 text-sm font-semibold leading-tight text-slate-900">{head}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 shrink-0 rounded-full',
                                    kbItemTrainingStatusDotClassName(t.trainingStatus),
                                  )}
                                  aria-hidden
                                />
                                <span>{kbItemTrainingStatusLabel(t.trainingStatus)}</span>
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span className="tabular-nums">{formatKbItemLastTrainedRelative(t.lastTrainedAt)}</span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span className="tabular-nums">
                                {nCol} {nCol === 1 ? 'column' : 'columns'}
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span className="tabular-nums">
                                {nRow} {nRow === 1 ? 'row' : 'rows'}
                              </span>
                            </div>
                          </Link>
                          <div className="shrink-0 self-start pt-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0 text-[var(--color-danger-text-emphasis)]"
                              disabled={importSheetBusy || deleting || bulkDeleting}
                              onClick={() => openRowDeleteModal(i)}
                              aria-label={`Delete datasheet: ${head}`}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <KnowledgeSourcesPagination
                  page={safeListPage}
                  pageCount={listPageCount}
                  totalFiltered={sortedFilteredIndices.length}
                  onPageChange={setListPage}
                />
              </div>
            )}
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
      <Modal
        open={importModalOpen}
        onClose={closeImportModal}
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
              onClick={closeImportModal}
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
              <table className="w-full min-w-full border-collapse text-left text-sm">
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
                            className="sticky top-0 z-[1] max-w-[14rem] border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-xs font-semibold text-slate-600"
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
                                className="max-w-[20rem] border-b border-slate-100 px-2 py-1.5 text-slate-800"
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
  );
}