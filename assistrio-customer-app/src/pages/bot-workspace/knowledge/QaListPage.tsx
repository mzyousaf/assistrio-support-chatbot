import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Download,
  Loader2,
  MessageCircleQuestion,
  MessageSquareReply,
  MoreVertical,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import {
  toastKnowledgeUseInRepliesSaveFailed,
  toastKnowledgeUseInRepliesSaved,
} from '@/lib/knowledgeItemActionToasts';
import {
  getCustomerKnowledgeFaqImportCsvSample,
  patchCustomerKnowledgeItemUseInReplies,
  postCustomerKnowledgeFaq,
  postCustomerKnowledgeFaqImportCsv,
} from '../../../api/customerApi';
import {
  bulkDeleteCustomerKnowledgeItems,
  KB_DELETE_REQUIRES_SYNC_MESSAGE,
  reportCustomerKnowledgeItemDeleteRejected,
} from '@/lib/customerKnowledgeItemDelete';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { useKnowledgeStorageUx, useDismissKnowledgeCompanionModalsOnStorageClose } from '@/context/KnowledgeStorageUxContext';
import { Button, Checkbox, FieldRow, Input, Modal, Textarea } from '@/components/ui';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import type { QaRow } from './knowledgeViewTypes';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import {
  KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES,
  clampFaqQuestionLineInCombinedBudget,
  clampStrUtf8Bytes,
  faqQuestionsCombinedUtf8Bytes,
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
  QA_FORM_IDENTITY_BACKEND_MESSAGE,
  faqsFromBot,
  faqsToPatchPayload,
  kbMergedTrainingStatusChipLabel,
  kbMergedTrainingStatusDotCanon,
  mergeQaRowsWithKbStatusPoll,
  qaFormPassesBackendNormalize,
  qaKnowledgeItemStoredUtf8Bytes,
  workspaceQaPrimaryLabel,
} from './knowledgeViewTypes';
import {
  KNOWLEDGE_LIST_ADD_TEXTAREA_FIXED_CLASS,
  KnowledgeUseInRepliesTag,
  KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS,
} from './knowledgeItemDetailShared';
import {
  QaFieldInfoIcon,
  QA_FIELD_ANSWER_HINT,
  QA_FIELD_QUESTIONS_HINT,
  QA_FIELD_TITLE_HINT,
} from './knowledgeQaPageCopy';
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
import { useKbTrainingStartedStatusRefetch } from './useKbTrainingStartedStatusRefetch';

function faqSearchBlob(f: { title: string; questions: string[]; answer: string }): string {
  return [f.title, ...f.questions, f.answer].join(' ').toLowerCase();
}

export function QaListPage() {
  const { id: botId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const sourcesSearchId = useId();
  const pageSelectId = useId();
  const perPageSelectId = useId();
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const { bot, loadState, softReload } = useBotWorkspace();
  const { notifyPlanLimitFromApi, interceptKnowledgeStorageIncrease } = useKnowledgeStorageUx();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const fromBot = useMemo(() => (bot ? faqsFromBot(bot) : []), [bot]);
  const faqStatusSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'faq'),
    [knowledgeStatusItems],
  );

  const displayFaqs = useMemo(
    () => mergeQaRowsWithKbStatusPoll(fromBot, faqStatusSlice),
    [fromBot, faqStatusSlice],
  );
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();

  useKbTrainingStartedStatusRefetch(botId, 'faq');

  /** Workspace bot payload omits per-FAQ training fields — hydrate once from lightweight status. */
  useEffect(() => {
    if (!botId) return;
    void refreshKnowledgeStatus('faq');
  }, [botId, refreshKnowledgeStatus]);

  useKbKnowledgeStatusPollInterest(Boolean(botId), 'faq');
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
  const [addQuestionInputs, setAddQuestionInputs] = useState<string[]>(['']);
  const [addAnswer, setAddAnswer] = useState('');
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

  async function downloadFaqSampleCsv() {
    if (!botId) return;
    const res = await getCustomerKnowledgeFaqImportCsvSample(botId);
    if (!res.ok) {
      appToast.error('Could not download sample', { description: res.error });
      return;
    }
    const blob = new Blob([res.data.content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.data.fileName || 'qa-import-sample.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importFaqCsv(file: File | undefined) {
    if (!file || !botId) return;
    setImportingCsv(true);
    setImportErrors([]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await postCustomerKnowledgeFaqImportCsv(botId, fd);
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
          ? `Imported ${res.data.imported} Q&A entries (${res.data.skippedDueToCapacity} skipped: capacity reached)`
          : `Imported ${res.data.imported} Q&A entries`,
      );
      setImportOpen(false);
      await softReload();
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('faq');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
    } finally {
      setImportingCsv(false);
    }
  }

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
    return workspaceQaPrimaryLabel(f, 'Untitled');
  }, [fromBot]);

  const sortedFilteredIndices = useMemo(
    () =>
      sortSourceIndices(filteredIndices, listSort, faqTitleKey, (i) => {
        const f = fromBot[i];
        return typeof f?.faqIndex === 'number' && Number.isFinite(f.faqIndex) ? f.faqIndex : i;
      }),
    [filteredIndices, listSort, faqTitleKey, fromBot],
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
      const row = displayFaqs[i];
      if (!row) return false;
      return isKnowledgeRowDeleteBlocked(faqStatusSlice, row.knowledgeItemId, row);
    },
    [displayFaqs, faqStatusSlice],
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
          const row = displayFaqs[i];
          if (row && isKnowledgeRowDeleteBlocked(faqStatusSlice, row.knowledgeItemId, row)) return prev;
          n.add(i);
        }
        return n;
      });
    },
    [displayFaqs, faqStatusSlice],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  async function persistFaqForAdd(nextRow: QaRow, successToast: string): Promise<boolean> {
    if (!botId) return false;
    setAddSaving(true);
    try {
      const one = faqsToPatchPayload([nextRow]);
      const appendPayload = one[0];
      if (!appendPayload) {
        appToast.error('Could not save', {
          description:
            'Check that the answer and at least one question or title are filled in.',
        });
        return false;
      }
      const res = await postCustomerKnowledgeFaq(botId, appendPayload as Record<string, unknown>);
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
      requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
      return true;
    } finally {
      setAddSaving(false);
    }
  }

  function requestAddQa() {
    setAddAttempted(true);
    if (!qaFormPassesBackendNormalize(addTitle, addQuestionInputs, addAnswer)) return;
    setAddSaveConfirmOpen(true);
  }

  async function confirmAddQa() {
    if (!botId) return;
    if (!qaFormPassesBackendNormalize(addTitle, addQuestionInputs, addAnswer)) {
      setAddSaveConfirmOpen(false);
      setAddAttempted(true);
      return;
    }
    const t = addTitle.trim();
    const a = addAnswer.trim();
    const mergedQs = addQuestionInputs.map((q) => q.trim()).filter(Boolean);
    const nextRow: QaRow = { title: t, questions: mergedQs, answer: a, active: true };
    const delta = qaKnowledgeItemStoredUtf8Bytes(nextRow);
    if (!(await interceptKnowledgeStorageIncrease(delta, KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE))) {
      setAddSaveConfirmOpen(false);
      return;
    }
    const ok = await persistFaqForAdd(nextRow, 'Q&A added');
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
      const idsOrdered = [...indicesToRemove].map((i) => displayFaqs[i]?.knowledgeItemId?.trim() ?? '');
      const useDeleteApi = idsOrdered.length === indicesToRemove.size && idsOrdered.every((id) => id.length > 0);

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
      appToast.success(message);
      setSelected((prev) => {
        const n = new Set(prev);
        indicesToRemove.forEach((i) => n.delete(i));
        return n;
      });
      await softReload();
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('faq');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
      return true;
    } finally {
      setDeleting(false);
    }
  }

  const toggleFaqUseInReplies = useCallback(
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
        requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
        void refreshKnowledgeStatus('faq', id);
      } finally {
        setUseInRepliesBusyId(null);
      }
    },
    [botId, softReload, refreshKnowledgeStatus],
  );

  function openRowDeleteModal(i: number) {
    if (!botId) return;
    const row = displayFaqs[i];
    if (
      row &&
      blockIfTrainingForItem(
        findKnowledgeStatusItemById(faqStatusSlice, row.knowledgeItemId?.trim() ?? ''),
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
      const row = displayFaqs[i];
      if (
        row &&
        blockIfTrainingForItem(
          findKnowledgeStatusItemById(faqStatusSlice, row.knowledgeItemId?.trim() ?? ''),
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
      const idsOrdered = [...selected].map((i) => displayFaqs[i]?.knowledgeItemId?.trim() ?? '');
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
      appToast.success(n === 1 ? 'Q&A removed' : `${n} Q&A entries removed`);
      setSelected(new Set());
      await softReload();
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('faq');
      requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
      return true;
    } finally {
      setBulkDeleting(false);
    }
  }

  const answerInvalid = addAttempted && !addAnswer.trim();
  /** Title/questions messaging whenever the bundle fails backend normalize (includes missing answer). */
  const faqIdentityInvalid =
    addAttempted && !qaFormPassesBackendNormalize(addTitle, addQuestionInputs, addAnswer);

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
      ? 'These entries will stop being used for answers right away.'
      : 'This Q&A will stop being used for answers right away.';

  const hasListData = fromBot.length > 0;
  const listingFillsColumn = !hasListData;

  return (
    <div className={styles.knowledgeSourcesPageRoot} data-knowledge-qa-list>
      <div className={styles.knowledgeSourcesPageBody}>
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <h1 className={styles.workspaceEditorH1}>Q&amp;A</h1>
            <p className={styles.workspaceEditorLead}>
              Preset answers for important topics. Your Agent checks Q&amp;A before the rest of your knowledge.
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
          void importFaqCsv(f);
        }}
      />

      <div className={styles.knowledgeSourcesAddCard}>
        <p className={styles.knowledgeSourcesAddCardOverline}>Add Q&amp;A</p>
        <form
          className={styles.knowledgeSourcesAddCardFieldStack}
          onSubmit={(e) => {
            e.preventDefault();
            requestAddQa();
          }}
        >
          <FieldRow
            label="Title"
            htmlFor="qa-add-title"
            labelTrailing={<QaFieldInfoIcon content={QA_FIELD_TITLE_HINT} ariaLabel="About Title" />}
            labelAddon={<KnowledgeUtf8Meter value={addTitle} maxBytes={KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES} />}
            error={faqIdentityInvalid ? QA_FORM_IDENTITY_BACKEND_MESSAGE : undefined}
          >
            <Input
              id="qa-add-title"
              quiet
              className="w-full min-w-0"
              value={addTitle}
              invalid={faqIdentityInvalid}
              onChange={(e) => setAddTitle(clampStrUtf8Bytes(e.target.value, KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES))}
              autoComplete="off"
              placeholder="Shipping and returns"
            />
          </FieldRow>
          <FieldRow
            label="Questions"
            htmlFor="qa-add-q-0"
            labelTrailing={<QaFieldInfoIcon content={QA_FIELD_QUESTIONS_HINT} ariaLabel="About Questions" />}
            labelAddon={
              <KnowledgeUtf8Meter
                value=""
                displayUsedBytes={faqQuestionsCombinedUtf8Bytes(addQuestionInputs)}
                maxBytes={KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES}
              />
            }
            error={faqIdentityInvalid ? QA_FORM_IDENTITY_BACKEND_MESSAGE : undefined}
          >
            <div className="space-y-2">
              {addQuestionInputs.map((q, qi) => (
                <div key={qi} className="flex gap-2">
                  <Input
                    id={qi === 0 ? 'qa-add-q-0' : undefined}
                    quiet
                    className="min-w-0 flex-1"
                    value={q}
                    invalid={faqIdentityInvalid}
                    onChange={(e) =>
                      setAddQuestionInputs((prev) =>
                        clampFaqQuestionLineInCombinedBudget(
                          prev,
                          qi,
                          e.target.value,
                          KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES,
                        ),
                      )
                    }
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
                variant="outlinePrimary"
                size="md"
                className="gap-1 font-normal shadow-none"
                onClick={() => setAddQuestionInputs((prev) => [...prev, ''])}
              >
                <Plus size={15} strokeWidth={2} aria-hidden />
                Add question
              </Button>
            </div>
          </FieldRow>
          <FieldRow
            label="Answer"
            htmlFor="qa-add-answer"
            required
            labelTrailing={<QaFieldInfoIcon content={QA_FIELD_ANSWER_HINT} ariaLabel="About Answer" />}
            labelAddon={<KnowledgeUtf8Meter value={addAnswer} maxBytes={KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES} />}
            error={answerInvalid ? 'Answer is required.' : undefined}
          >
            <Textarea
              id="qa-add-answer"
              quiet
              rows={5}
              value={addAnswer}
              invalid={answerInvalid}
              onChange={(e) => setAddAnswer(clampStrUtf8Bytes(e.target.value, KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES))}
              className={cn(
                styles.workspaceEditorControlInput,
                KNOWLEDGE_LIST_ADD_TEXTAREA_FIXED_CLASS,
                'py-2.5',
              )}
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
          styles.knowledgeSourcesListShell,
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
              <ul
                ref={rowDetailsMenuListRef}
                className={styles.knowledgeSourcesListRowGap}
                aria-label="Q and A list"
              >
                {pagedIndices.map((i) => {
                  const faq = displayFaqs[i]!;
                  const head = workspaceQaPrimaryLabel(faq, 'Untitled');
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
                          (!isKnowledgeRowDeleteBlocked(faqStatusSlice, faq.knowledgeItemId, faq) ||
                            selected.has(i)) ? (
                            <Checkbox
                              checked={selected.has(i)}
                              onChange={() => toggleOneSelected(i)}
                              aria-label={`Select Q&A: ${head}`}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 pr-9 sm:pr-10">
                          <button
                            type="button"
                            onClick={() => {
                              void navigate(`${base}/faqs/${i}`);
                            }}
                            className="w-full rounded-md border-0 bg-transparent px-0 py-0 text-left leading-snug"
                          >
                            <p className="m-0 text-sm font-medium leading-tight text-slate-900">{head}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                              <span
                                className="tabular-nums"
                                title="Approximate stored UTF-8 size for this Q&amp;A"
                              >
                                {formatKnowledgeBytes(qaKnowledgeItemStoredUtf8Bytes(faq))}
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span>
                                {faq.questions.length}{' '}
                                {faq.questions.length === 1 ? 'Question' : 'Questions'}
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <span className="inline-flex max-w-full min-w-0 items-center">
                                <KbTrainingStatusTagWithSchedule
                                  label={kbMergedTrainingStatusChipLabel({ ...faq, sourceType: 'faq' })}
                                  statusForBadge={kbMergedTrainingStatusDotCanon({ ...faq, sourceType: 'faq' })}
                                  row={{ runAfter: faq.runAfter ?? null }}
                                  dotCanon={kbMergedTrainingStatusDotCanon({ ...faq, sourceType: 'faq' })}
                                  showHoverDescription
                                />
                              </span>
                              <span className="text-slate-300" aria-hidden>
                                |
                              </span>
                              <KnowledgeUseInRepliesTag active={faq.active !== false} showHoverDescription />
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
                              {faq.knowledgeItemId?.trim() ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={
                                    deleting || bulkDeleting || useInRepliesBusyId === faq.knowledgeItemId.trim()
                                  }
                                  title={
                                    faq.active !== false
                                      ? KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.active
                                      : KNOWLEDGE_USE_IN_REPLIES_TAG_TOOLTIPS.excluded
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute(
                                      'open',
                                    );
                                    void toggleFaqUseInReplies(faq.knowledgeItemId!, faq.active !== false);
                                  }}
                                >
                                  <MessageSquareReply className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                  <span className="min-w-0">
                                    {faq.active !== false ? 'Turn off in replies' : 'Turn on in replies'}
                                  </span>
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-[var(--color-danger-text-emphasis)] hover:bg-slate-50"
                                title="Delete this Q&A"
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
        onConfirm={() => void confirmAddQa()}
        title="Add this Q&A?"
        description="It will be saved to this assistant’s knowledge base."
        bodyNote={
          <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
            You can edit or remove this topic anytime from your Q&A library.
          </p>
        }
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
            <MessageCircleQuestion size={16} className="text-teal-600" aria-hidden />
            <span>Import Q&amp;A from CSV</span>
          </span>
        }
        description="Required columns: title, questions, answer"
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
                Download the sample, fill it, then upload. Use "|" to separate multiple questions in the
                <span className="font-medium"> questions </span>
                column.
              </p>
            </div>
            <Button
              type="button"
              variant="outlinePrimary"
              size="sm"
              className="shrink-0"
              onClick={() => void downloadFaqSampleCsv()}
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
