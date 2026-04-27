import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, MessageCircleQuestion, Plus, Trash2 } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import { patchCustomerBot } from '../../../api/customerApi';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { Button, Checkbox, FieldRow, Input, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import type { QaRow } from './knowledgeViewTypes';
import {
  faqsFromBot,
  faqsToPatchPayload,
  formatKbItemLastTrainedRelative,
  kbItemTrainingStatusDotClassName,
  kbItemTrainingStatusLabel,
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

function faqSearchBlob(f: { title: string; questions: string[]; answer: string }): string {
  return [f.title, ...f.questions, f.answer].join(' ').toLowerCase();
}

export function QaListPage() {
  const { id: botId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const sourcesSearchId = useId();
  const pageSelectId = useId();
  const { bot, loadState, softReload } = useBotWorkspace();
  const fromBot = useMemo(() => (bot ? faqsFromBot(bot) : []), [bot]);
  const [listSearch, setListSearch] = useState('');
  const [listSort, setListSort] = useState<KnowledgeListSort>('order');
  const [listPage, setListPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<null | { kind: 'row'; i: number } | 'bulk'>(null);

  const [addTitle, setAddTitle] = useState('');
  const [addQuestionInputs, setAddQuestionInputs] = useState<string[]>(['']);
  const [addAnswer, setAddAnswer] = useState('');
  const [addAttempted, setAddAttempted] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addSaveConfirmOpen, setAddSaveConfirmOpen] = useState(false);

  const filteredIndices = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return fromBot.map((_, i) => i);
    return fromBot
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => faqSearchBlob(f).includes(q))
      .map(({ i }) => i);
  }, [fromBot, listSearch]);

  const faqTitleKey = useCallback((i: number) => {
    const f = fromBot[i];
    if (!f) return `Q&A ${i + 1}`;
    return (f.title || f.questions[0] || 'Untitled').trim() || 'Untitled';
  }, [fromBot]);

  const sortedFilteredIndices = useMemo(
    () => sortSourceIndices(filteredIndices, listSort, faqTitleKey),
    [filteredIndices, listSort, faqTitleKey],
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

  async function persistFaqsForAdd(nextFaqs: QaRow[], successToast: string): Promise<boolean> {
    if (!botId) return false;
    setAddSaving(true);
    try {
      const res = await patchCustomerBot(botId, { faqs: faqsToPatchPayload(nextFaqs) });
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

  function requestAddQa() {
    setAddAttempted(true);
    const t = addTitle.trim();
    const a = addAnswer.trim();
    const qClean = addQuestionInputs.map((q) => q.trim()).filter(Boolean);
    if (!t || qClean.length === 0 || !a) return;
    setAddSaveConfirmOpen(true);
  }

  async function confirmAddQa() {
    if (!botId) return;
    const t = addTitle.trim();
    const a = addAnswer.trim();
    const mergedQs = addQuestionInputs.map((q) => q.trim()).filter(Boolean);
    if (!t || mergedQs.length === 0 || !a) {
      setAddSaveConfirmOpen(false);
      setAddAttempted(true);
      return;
    }
    const nextRow: QaRow = { title: t, questions: mergedQs, answer: a, active: true };
    const nextFaqs = [...fromBot, nextRow];
    const ok = await persistFaqsForAdd(nextFaqs, 'Q&A added');
    if (ok) {
      setAddSaveConfirmOpen(false);
      setAddTitle('');
      setAddQuestionInputs(['']);
      setAddAnswer('');
      setAddAttempted(false);
    }
  }

  async function deleteFaqsByIndices(indicesToRemove: Set<number>, message: string): Promise<boolean> {
    if (!botId) return false;
    setDeleting(true);
    try {
      const nextFaqs = fromBot.filter((_, i) => !indicesToRemove.has(i));
      const res = await patchCustomerBot(botId, { faqs: faqsToPatchPayload(nextFaqs) });
      if (!res.ok) {
        appToast.error('Could not delete', { description: res.error });
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
      const ok = await deleteFaqsByIndices(new Set([i]), 'Q&A removed');
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
      const nextFaqs = fromBot.filter((_, i) => !selected.has(i));
      const res = await patchCustomerBot(botId, { faqs: faqsToPatchPayload(nextFaqs) });
      if (!res.ok) {
        appToast.error('Could not delete', { description: res.error });
        return false;
      }
      appToast.success(n === 1 ? 'Q&A removed' : `${n} Q&A entries removed`);
      setSelected(new Set());
      await softReload();
      return true;
    } finally {
      setBulkDeleting(false);
    }
  }

  const titleInvalid = addAttempted && !addTitle.trim();
  const questionsInvalid = addAttempted && !addQuestionInputs.some((x) => x.trim());
  const answerInvalid = addAttempted && !addAnswer.trim();

  if (!botId) return null;

  const listBusy = loadState === 'loading' && !bot;
  const selectedCount = selected.size;
  const deleteConfirmTitle =
    deleteModal === 'bulk'
      ? selectedCount > 1
        ? `Delete ${selectedCount} Q&A entries?`
        : 'Delete this Q&A?'
      : 'Delete this Q&A?';
  const deleteConfirmDescription =
    deleteModal === 'bulk' && selectedCount > 1
      ? 'These entries will be removed from the assistant’s knowledge base. This cannot be undone.'
      : 'This Q&A will be removed from the assistant’s knowledge base. This cannot be undone.';

  const hasListData = fromBot.length > 0;
  const listingFillsColumn = !hasListData;

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-6 px-0"
      data-knowledge-qa-list
    >
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <h1 className={styles.workspaceEditorH1}>Q&amp;A</h1>
            <p className={styles.workspaceEditorLead}>
              Add a new group below, or open an existing one from the list to edit.
            </p>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'shrink-0 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        )}
      >
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Add Q&amp;A</p>
        <form
          className="mt-4 w-full min-w-0 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            requestAddQa();
          }}
        >
          <FieldRow
            label="Title"
            htmlFor="qa-add-title"
            required
            helperText="Shown in your library and for this Q&A group."
            error={titleInvalid ? 'Title is required.' : undefined}
          >
            <Input
              id="qa-add-title"
              quiet
              className="w-full min-w-0"
              value={addTitle}
              invalid={titleInvalid}
              onChange={(e) => setAddTitle(e.target.value)}
              autoComplete="off"
              placeholder="Shipping and returns"
            />
          </FieldRow>
          <FieldRow
            label="Questions"
            htmlFor="qa-add-q-0"
            required
            helperText="Add a row for each phrasing. Order is preserved."
            error={questionsInvalid ? 'Enter at least one question.' : undefined}
          >
            <div className="space-y-2">
              {addQuestionInputs.map((q, qi) => (
                <div key={qi} className="flex gap-2">
                  <Input
                    id={qi === 0 ? 'qa-add-q-0' : undefined}
                    quiet
                    className="min-w-0 flex-1"
                    value={q}
                    invalid={questionsInvalid}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAddQuestionInputs((prev) => prev.map((line, i) => (i === qi ? v : line)));
                    }}
                    placeholder={qi === 0 ? 'When do you ship?' : 'Another phrasing…'}
                    autoComplete="off"
                  />
                  {addQuestionInputs.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2"
                      onClick={() =>
                        setAddQuestionInputs((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== qi) : prev))
                      }
                      aria-label={`Remove question ${qi + 1}`}
                    >
                      <Trash2 size={16} className="text-slate-500" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.knowledgeFormActionSecondary}
                onClick={() => setAddQuestionInputs((prev) => [...prev, ''])}
              >
                <Plus size={16} strokeWidth={2} aria-hidden />
                Add question
              </Button>
            </div>
          </FieldRow>
          <FieldRow
            label="Answer"
            htmlFor="qa-add-answer"
            required
            helperText="Aim for one short paragraph."
            error={answerInvalid ? 'Answer is required.' : undefined}
          >
            <Textarea
              id="qa-add-answer"
              quiet
              rows={4}
              value={addAnswer}
              invalid={answerInvalid}
              onChange={(e) => setAddAnswer(e.target.value)}
              className={cn(styles.workspaceEditorControlInput, 'min-h-[6.5rem] w-full resize-y py-2.5')}
            />
          </FieldRow>
          <div className={styles.knowledgeFormActionsRow}>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={addSaving || listBusy}
              className={styles.knowledgeFormActionPrimary}
            >
              {addSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {addSaving ? 'Saving…' : 'Add Q&A'}
            </Button>
          </div>
        </form>
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
              <MessageCircleQuestion size={20} strokeWidth={1.75} className="text-teal-600" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">No Q&amp;A yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
              Use the form above to add common questions and answers the assistant can reuse.
            </p>
          </div>
        ) : (
          <div className="flex w-full min-w-0 flex-col">
            <KnowledgeSourcesToolbar
              title="Q&A Sources"
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
                noun="Q and A"
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
                <ul className="m-0 flex w-full list-none flex-col gap-3 p-0 pb-2" aria-label="Q and A list">
                  {pagedIndices.map((i) => {
                    const faq = fromBot[i]!;
                    const head = (faq.title || faq.questions[0] || 'Untitled').trim();
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
                              aria-label={`Select Q&A: ${head}`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void navigate(`${base}/faqs/${i}`)}
                            className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-0 py-0 text-left leading-snug"
                          >
                            <p className="m-0 text-sm font-semibold leading-tight text-slate-900">{head}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 shrink-0 rounded-full',
                                    kbItemTrainingStatusDotClassName(faq.trainingStatus),
                                  )}
                                  aria-hidden
                                />
                                <span>{kbItemTrainingStatusLabel(faq.trainingStatus)}</span>
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span className="tabular-nums">
                                {formatKbItemLastTrainedRelative(faq.lastTrainedAt)}
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span>
                                {faq.questions.length}{' '}
                                {faq.questions.length === 1 ? 'Question' : 'Questions'}
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
                              aria-label={`Delete Q&A: ${head}`}
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
        onConfirm={() => void confirmAddQa()}
        title="Add this Q&A?"
        description="It will be saved to this assistant’s knowledge base."
        confirmLabel="Add Q&A"
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
