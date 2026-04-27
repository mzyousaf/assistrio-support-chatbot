import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Loader2, Lightbulb, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { appToast } from '@/lib/app-toast';
import { patchCustomerBot } from '../../../api/customerApi';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { EXAMPLE_QUESTIONS_MAX, EXAMPLE_QUESTION_CONTEXT_MAX, EXAMPLE_QUESTION_MAX_CHARS } from '../behaviorConstants';
import {
  exampleQuestionsToPatchPayload,
  hydrateExampleQuestionsFromBot,
  type ExampleQuestionItem,
} from '../exampleQuestionHelpers';
import { ws as styles } from '../workspace';
import { Button, Checkbox, FieldRow, Input, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
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

function suggestionSearchBlob(s: ExampleQuestionItem): string {
  return [s.label, s.context].join(' ').toLowerCase();
}

export function KnowledgeSuggestionsPage() {
  const { id: botId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const sourcesSearchId = useId();
  const pageSelectId = useId();
  const { bot, loadState, softReload } = useBotWorkspace();

  const fromBot = useMemo(() => hydrateExampleQuestionsFromBot(bot), [bot]);

  const [listSearch, setListSearch] = useState('');
  const [listSort, setListSort] = useState<KnowledgeListSort>('order');
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
    () => sortSourceIndices(filteredIndices, listSort, titleKey),
    [filteredIndices, listSort, titleKey],
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

  async function persistExampleQuestions(next: ExampleQuestionItem[], successToast: string): Promise<boolean> {
    if (!botId) return false;
    const res = await patchCustomerBot(botId, { exampleQuestions: exampleQuestionsToPatchPayload(next) });
    if (!res.ok) {
      appToast.error('Could not save', { description: res.error });
      return false;
    }
    appToast.success(successToast);
    await softReload();
    return true;
  }

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
    const label = addLabel.trim().slice(0, EXAMPLE_QUESTION_MAX_CHARS);
    const context = addContext.trim().slice(0, EXAMPLE_QUESTION_CONTEXT_MAX);
    if (!label) {
      setAddSaveConfirmOpen(false);
      setAddAttempted(true);
      return;
    }
    if (fromBot.length >= EXAMPLE_QUESTIONS_MAX) {
      setAddSaveConfirmOpen(false);
      return;
    }
    setAddSaving(true);
    try {
      const newIndex = fromBot.length;
      const next: ExampleQuestionItem[] = [...fromBot, { label, context: context || '' }];
      const ok = await persistExampleQuestions(next, 'Suggestion added');
      if (ok) {
        setAddSaveConfirmOpen(false);
        setAddLabel('');
        setAddContext('');
        setAddAttempted(false);
        void navigate(`${base}/suggestions/${newIndex}`);
      }
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
      const next = fromBot.filter((_, i) => !indicesToRemove.has(i));
      const res = await patchCustomerBot(botId, { exampleQuestions: exampleQuestionsToPatchPayload(next) });
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
      if (mode === 'row') setDeleting(false);
      else setBulkDeleting(false);
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
      ? 'These suggestions will be removed. This cannot be undone.'
      : 'This suggestion will be removed. This cannot be undone.';

  const addLabelInvalid = addAttempted && !addLabel.trim();
  const hasListData = fromBot.length > 0;
  const listingFillsColumn = !hasListData;
  const atCapacity = fromBot.length >= EXAMPLE_QUESTIONS_MAX;

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-6 px-0"
      data-knowledge-suggestions-list
    >
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <h1 className={styles.workspaceEditorH1}>Suggestions</h1>
            <p className={styles.workspaceEditorLead}>
              Add chip text and optional scoped information below, or open a suggestion from the list to view and edit. When
              scoped text is set, the first reply after that chip uses only that information—not the full knowledge base.
            </p>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'shrink-0 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        )}
      >
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Add suggestion</p>
        <div className="mt-4 w-full min-w-0 space-y-5">
          <FieldRow
            label="Chip text"
            htmlFor="suggestion-add-label"
            required
            helperText="Short text on the chip; sent as the visitor’s first message when tapped."
            error={addLabelInvalid ? 'Chip text is required.' : undefined}
            labelAddon={
              <RecommendedCharLabelAddon length={addLabel.length} max={EXAMPLE_QUESTION_MAX_CHARS} />
            }
            labelRowClassName="w-full min-w-0"
          >
            <Input
              id="suggestion-add-label"
              quiet
              className="w-full min-w-0"
              value={addLabel}
              invalid={addLabelInvalid}
              maxLength={EXAMPLE_QUESTION_MAX_CHARS}
              onChange={(e) => setAddLabel(e.target.value.slice(0, EXAMPLE_QUESTION_MAX_CHARS))}
              autoComplete="off"
              placeholder="What services do you offer?"
            />
          </FieldRow>
          <FieldRow
            label="Scoped information (optional)"
            htmlFor="suggestion-add-context"
            helperText="If set, the first reply uses only this text. Leave empty for normal knowledge search."
            labelAddon={
              <RecommendedCharLabelAddon length={addContext.length} max={EXAMPLE_QUESTION_CONTEXT_MAX} />
            }
            labelRowClassName="w-full min-w-0"
          >
            <Textarea
              id="suggestion-add-context"
              quiet
              rows={4}
              value={addContext}
              maxLength={EXAMPLE_QUESTION_CONTEXT_MAX}
              onChange={(e) => setAddContext(e.target.value.slice(0, EXAMPLE_QUESTION_CONTEXT_MAX))}
              placeholder="e.g. pricing: Starter $9/mo, Pro $29/mo…"
              className={cn(styles.workspaceEditorControlInput, 'min-h-[6.5rem] w-full resize-y py-2.5')}
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
          {atCapacity ? (
            <p className={cn(styles.workspaceEditorHelperText, 'm-0 text-amber-800')}>
              Maximum {EXAMPLE_QUESTIONS_MAX} suggestions reached. Remove one to add another.
            </p>
          ) : null}
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
              <Lightbulb size={20} strokeWidth={1.75} className="text-teal-600" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">No suggestions yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">Use the form above to add your first suggestion.</p>
          </div>
        ) : (
          <div className="flex w-full min-w-0 flex-col">
            <KnowledgeSourcesToolbar
              title="Suggestion sources"
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
                noun="suggestion"
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
                <ul className="m-0 flex w-full list-none flex-col gap-3 p-0 pb-2" aria-label="Suggestions list">
                  {pagedIndices.map((i) => {
                    const s = fromBot[i]!;
                    const head = s.label.trim() || `Suggestion ${i + 1}`;
                    const hasScope = Boolean(s.context.trim());
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
                              aria-label={`Select suggestion: ${head}`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void navigate(`${base}/suggestions/${i}`)}
                            className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-0 py-0 text-left leading-snug"
                          >
                            <p className="m-0 text-sm font-semibold leading-tight text-slate-900">{head}</p>
                            <p className="m-0 mt-1.5 line-clamp-2 text-xs text-slate-500">
                              {hasScope ? (
                                <>
                                  <span className="font-medium text-slate-600">Scoped: </span>
                                  {s.context.trim()}
                                </>
                              ) : (
                                <span className="text-slate-400">Full knowledge base on first reply</span>
                              )}
                            </p>
                          </button>
                          <div className="shrink-0 self-start pt-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0 text-[var(--color-danger-text-emphasis)]"
                              disabled={deleting || bulkDeleting}
                              onClick={() => openRowDeleteModal(i)}
                              aria-label={`Delete suggestion: ${head}`}
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
        onConfirm={() => void confirmAddSuggestion()}
        title="Add this suggestion?"
        description="It will be saved to this assistant and shown as a chip in the chat."
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
    </div>
  );
}
