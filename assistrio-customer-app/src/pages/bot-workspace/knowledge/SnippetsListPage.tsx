import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, StickyNote, Trash2 } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import { patchCustomerBot } from '../../../api/customerApi';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { Button, Checkbox, FieldRow, Input, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import type { SnippetRow } from './knowledgeViewTypes';
import {
  formatKbItemLastTrainedRelative,
  kbItemTrainingStatusDotClassName,
  kbItemTrainingStatusLabel,
  snippetsFromBot,
} from './knowledgeViewTypes';
import {
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
} from './knowledgeSourcesListUi';

export function SnippetsListPage() {
  const { id: botId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const sourcesSearchId = useId();
  const pageSelectId = useId();
  const { bot, loadState, softReload } = useBotWorkspace();
  const fromBot = useMemo(() => snippetsFromBot(bot), [bot]);
  const [listSearch, setListSearch] = useState('');
  const [listSort, setListSort] = useState<KnowledgeListSort>('order');
  const [listPage, setListPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<null | { kind: 'row'; i: number } | 'bulk'>(null);

  const [addTitle, setAddTitle] = useState('');
  const [addBody, setAddBody] = useState('');
  const [addAttempted, setAddAttempted] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addSaveConfirmOpen, setAddSaveConfirmOpen] = useState(false);

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
      sortSourceIndices(filteredIndices, listSort, (i) => fromBot[i]?.title || `Snippet ${i + 1}`),
    [filteredIndices, listSort, fromBot],
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
        if (k >= 0 && k < fromBot.length) n.add(k);
      }
      return n;
    });
  }, [fromBot.length]);

  const togglePageSelection = useCallback(() => {
    setSelected((prev) => {
      const n = new Set(prev);
      const allOn = pagedIndices.length > 0 && pagedIndices.every((i) => n.has(i));
      if (allOn) {
        pagedIndices.forEach((i) => n.delete(i));
      } else {
        pagedIndices.forEach((i) => n.add(i));
      }
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

  async function persistSnippets(next: SnippetRow[], successToast: string): Promise<boolean> {
    if (!botId) return false;
    setAddSaving(true);
    try {
      const res = await patchCustomerBot(botId, {
        knowledgeSnippets: next
          .map((s) => ({
            title: s.title.trim() || 'Snippet',
            snippet: s.snippet.trim(),
            active: s.active !== false,
          }))
          .filter((s) => s.snippet),
      });
      if (!res.ok) {
        appToast.error('Could not save', { description: res.error });
        return false;
      }
      appToast.success(successToast);
      await softReload();
      return true;
    } finally {
      setAddSaving(false);
    }
  }

  function requestAddSnippet() {
    setAddAttempted(true);
    const t = addTitle.trim();
    const snippet = addBody.trim();
    if (!t || !snippet) return;
    setAddSaveConfirmOpen(true);
  }

  async function confirmAddSnippet() {
    if (!botId) return;
    const t = addTitle.trim();
    const snippet = addBody.trim();
    if (!t || !snippet) {
      setAddSaveConfirmOpen(false);
      setAddAttempted(true);
      return;
    }
    const next = [...fromBot, { title: t, snippet, active: true }];
    const ok = await persistSnippets(next, 'Snippet added');
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
      const next = fromBot
        .filter((_, i) => !indicesToRemove.has(i))
        .map((s) => ({
          title: s.title.trim() || 'Snippet',
          snippet: s.snippet.trim(),
          active: true,
        }))
        .filter((s) => s.snippet);
      const res = await patchCustomerBot(botId, { knowledgeSnippets: next });
      if (!res.ok) {
        appToast.error('Could not remove', { description: res.error });
        return false;
      }
      appToast.success(message);
      setSelected((prev) => {
        const n = new Set(prev);
        indicesToRemove.forEach((i) => n.delete(i));
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
      const next = fromBot
        .filter((_, i) => !selected.has(i))
        .map((s) => ({
          title: s.title.trim() || 'Snippet',
          snippet: s.snippet.trim(),
          active: true,
        }))
        .filter((s) => s.snippet);
      const res = await patchCustomerBot(botId, { knowledgeSnippets: next });
      if (!res.ok) {
        appToast.error('Could not remove', { description: res.error });
        return false;
      }
      appToast.success(n === 1 ? 'Snippet removed' : `${n} snippets removed`);
      setSelected(new Set());
      await softReload();
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
      ? 'These snippets will be removed from the assistant’s knowledge base. This cannot be undone.'
      : 'This snippet will be removed from the assistant’s knowledge base. This cannot be undone.';

  const addTitleInvalid = addAttempted && !addTitle.trim();
  const addDescInvalid = addAttempted && !addBody.trim();

  const hasListData = fromBot.length > 0;
  const listingFillsColumn = !hasListData;

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-6 px-0"
      data-knowledge-snippets-list
    >
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <h1 className={styles.workspaceEditorH1}>Snippets</h1>
            <p className={styles.workspaceEditorLead}>
              Add a snippet below, or open an existing one from the list to edit.
            </p>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'shrink-0 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        )}
      >
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Add snippet</p>
        <div className="mt-4 w-full min-w-0 space-y-5">
          <FieldRow
            label="Title"
            htmlFor="snippet-add-title"
            required
            helperText="Short label in your library."
            error={addTitleInvalid ? 'Title is required.' : undefined}
          >
            <Input
              id="snippet-add-title"
              quiet
              className="w-full min-w-0"
              value={addTitle}
              invalid={addTitleInvalid}
              onChange={(e) => setAddTitle(e.target.value)}
              autoComplete="off"
              placeholder="e.g. Return policy"
            />
          </FieldRow>
          <FieldRow
            label="Description"
            htmlFor="snippet-add-body"
            required
            helperText="One or more paragraphs. Be concise and factual."
            error={addDescInvalid ? 'Description is required.' : undefined}
          >
            <Textarea
              id="snippet-add-body"
              quiet
              rows={4}
              value={addBody}
              invalid={addDescInvalid}
              onChange={(e) => setAddBody(e.target.value)}
              placeholder="Factual text the model may quote or paraphrase."
              className={cn(styles.workspaceEditorControlInput, 'min-h-[6.5rem] w-full resize-y py-2.5')}
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
          'flex w-full min-w-0 flex-col rounded-xl border border-dashed border-slate-200/90 bg-white p-5 sm:p-6',
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
              <div className="flex w-full min-w-0 flex-col">
                <ul className="m-0 flex w-full list-none flex-col gap-3 p-0 pb-2" aria-label="Snippets list">
                  {pagedIndices.map((i) => {
                    const s = fromBot[i]!;
                    const head = s.title || `Snippet ${i + 1}`;
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
                              disabled={deleting || bulkDeleting}
                              aria-label={`Select snippet: ${head}`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void navigate(`${base}/snippets/${i}`)}
                            className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-0 py-0 text-left leading-snug"
                          >
                            <p className="m-0 text-sm font-semibold leading-tight text-slate-900">{head}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 shrink-0 rounded-full',
                                    kbItemTrainingStatusDotClassName(s.trainingStatus),
                                  )}
                                  aria-hidden
                                />
                                <span>{kbItemTrainingStatusLabel(s.trainingStatus)}</span>
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span className="tabular-nums">
                                {formatKbItemLastTrainedRelative(s.lastTrainedAt)}
                              </span>
                            </div>
                          </button>
                          <div className="shrink-0 self-start pt-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0 text-[var(--color-danger-text-emphasis)]"
                              disabled={deleting || bulkDeleting}
                              onClick={() => openRowDeleteModal(i)}
                              aria-label={`Delete snippet: ${head}`}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="shrink-0 pt-4">
                  <KnowledgeSourcesPagination
                    page={safeListPage}
                    pageCount={listPageCount}
                    totalFiltered={sortedFilteredIndices.length}
                    onPageChange={setListPage}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <KnowledgeSaveConfirmModal
        open={addSaveConfirmOpen}
        onClose={() => setAddSaveConfirmOpen(false)}
        onConfirm={() => void confirmAddSnippet()}
        title="Add this snippet?"
        description="It will be saved to this assistant’s knowledge base."
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
    </div>
  );
}
