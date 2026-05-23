import { useMemo, useRef, useState } from 'react';
import { Download, Loader2, MessagesSquare, Plus, Trash2, Upload } from 'lucide-react';
import type { WorkspaceOnboardingDraftQa } from '@/api/types';
import { Button, FieldRow, Input, Modal, Textarea } from '@/components/ui';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import {
  clampFaqQuestionLineInCombinedBudget,
  clampStrUtf8Bytes,
  faqQuestionsCombinedUtf8Bytes,
  KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES,
} from '@/lib/knowledgeContentUtf8Limits';
import {
  ONBOARDING_KNOWLEDGE_QA_MAX,
  ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX,
} from '@/lib/onboardingKnowledgeLimits';
import { downloadQaSampleSpreadsheet } from '@/lib/qaSpreadsheetSampleDownload';
import { qaAnswerPreview } from '@/onboarding/onboardingKnowledge';
import { KnowledgeDeleteConfirmModal } from '@/pages/bot-workspace/knowledge/knowledgeSourcesListUi';
import {
  OnboardingKnowledgeEmptyState,
  OnboardingKnowledgeLimitAction,
  OnboardingKnowledgeListCard,
  OnboardingKnowledgePanel,
} from './OnboardingKnowledgeShared';
import { OnboardingKnowledgePaginatedList } from './OnboardingKnowledgePaginatedList';
import { useOnboardingKnowledgeSelection } from './onboardingKnowledgeSelection';

type QaForm = { title: string; questions: string[]; answer: string };

type DeleteMode =
  | { type: 'single'; item: WorkspaceOnboardingDraftQa }
  | { type: 'bulk'; count: number }
  | null;

type ImportErrorRow = { row: number; column: string; message: string };

type Props = {
  qas: WorkspaceOnboardingDraftQa[];
  disabled?: boolean;
  busy?: boolean;
  onCreate: (body: QaForm) => Promise<{ ok: boolean; error?: string }>;
  onUpdate: (id: string, body: QaForm) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onBulkDelete?: (ids: string[]) => Promise<{ ok: boolean; error?: string; deletedCount?: number }>;
  onImport: (file: File) => Promise<{
    ok: boolean;
    error?: string;
    imported?: number;
    skippedCount?: number;
    skippedReason?: string;
    details?: ImportErrorRow[];
  }>;
};

const MAX_QUESTIONS = ONBOARDING_KNOWLEDGE_QA_QUESTIONS_MAX;

export function OnboardingKnowledgeQaTab({
  qas,
  disabled,
  busy,
  onCreate,
  onUpdate,
  onDelete,
  onBulkDelete,
  onImport,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceOnboardingDraftQa | null>(null);
  const [form, setForm] = useState<QaForm>({ title: '', questions: [''], answer: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ImportErrorRow[]>([]);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const itemIds = useMemo(() => qas.map((qa) => qa.id), [qas]);
  const { selectedIds, selectedCount, toggle, togglePage, clear } = useOnboardingKnowledgeSelection(itemIds);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', questions: [''], answer: '' });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(qa: WorkspaceOnboardingDraftQa) {
    setEditing(qa);
    setForm({
      title: qa.title,
      questions: qa.questions.length ? [...qa.questions] : [''],
      answer: qa.answer,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function saveQa() {
    setFormError(null);
    const title = form.title.trim();
    const answer = form.answer.trim();
    const questions = form.questions.map((q) => q.trim()).filter(Boolean);
    if (!title || !answer || questions.length === 0) {
      setFormError('Title, at least one question, and an answer are required.');
      return;
    }
    setSaving(true);
    const body = { title, questions, answer };
    const res = editing ? await onUpdate(editing.id, body) : await onCreate(body);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not save Q&A.');
      return;
    }
    setModalOpen(false);
  }

  async function confirmDelete() {
    if (!deleteMode) return;
    setDeleting(true);
    setActionError(null);

    if (deleteMode.type === 'single') {
      const res = await onDelete(deleteMode.item.id);
      setDeleting(false);
      if (!res.ok) {
        setActionError(res.error ?? 'Could not delete Q&A.');
        return;
      }
      setDeleteMode(null);
      return;
    }

    const ids = [...selectedIds];
    const res =
      onBulkDelete != null
        ? await onBulkDelete(ids)
        : await (async () => {
            for (const id of ids) {
              const single = await onDelete(id);
              if (!single.ok) return single;
            }
            return { ok: true as const };
          })();
    if (!res.ok) {
      setDeleting(false);
      setActionError(res.error ?? 'Could not delete Q&A items.');
      return;
    }
    setDeleting(false);
    clear();
    setDeleteMode(null);
  }

  function openImport() {
    setImportError(null);
    setImportErrors([]);
    setImportOpen(true);
  }

  function resetImportModal() {
    setImportOpen(false);
    setImportError(null);
    setImportErrors([]);
  }

  function closeImport() {
    if (importing) return;
    resetImportModal();
  }

  function isCsvFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
  }

  async function handleImport(file: File) {
    if (!isCsvFile(file)) {
      setImportError('Choose a CSV file (.csv).');
      setImportErrors([]);
      return;
    }
    setImportError(null);
    setImportErrors([]);
    setImporting(true);
    const res = await onImport(file);
    setImporting(false);
    if (!res.ok) {
      setImportError(res.error ?? 'Import failed.');
      if (res.details?.length) setImportErrors(res.details);
      return;
    }
    resetImportModal();
  }

  const locked = disabled || busy || saving || deleting || importing;
  const rowDisabled = locked;
  const atLimit = qas.length >= ONBOARDING_KNOWLEDGE_QA_MAX;
  const limitMessage = `Maximum of ${ONBOARDING_KNOWLEDGE_QA_MAX} Q&A items reached.`;
  const questionCount = form.questions.length;
  const atQuestionLimit = questionCount >= MAX_QUESTIONS;

  const deleteTitle =
    deleteMode?.type === 'bulk'
      ? deleteMode.count === 1
        ? 'Delete this item?'
        : `Delete ${deleteMode.count} selected items?`
      : 'Delete this Q&A?';

  const deleteDescription =
    deleteMode?.type === 'bulk'
      ? 'This action cannot be undone.'
      : deleteMode?.type === 'single'
        ? `"${deleteMode.item.title}" will be removed from agent knowledge.`
        : undefined;

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="primary" size="sm" disabled={locked} onClick={openImport}>
        <Upload className="size-4" aria-hidden />
        <span className="ml-1.5">Import CSV</span>
      </Button>
      <OnboardingKnowledgeLimitAction atLimit={atLimit} message={limitMessage}>
        <Button type="button" variant="primary" size="sm" disabled={locked || atLimit} onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          <span className="ml-1.5">Add Q&A</span>
        </Button>
      </OnboardingKnowledgeLimitAction>
    </div>
  );

  const emptyActions = (
    <div className="flex flex-wrap justify-center gap-2">
      <OnboardingKnowledgeLimitAction atLimit={atLimit} message={limitMessage}>
        <Button type="button" variant="outlinePrimary" size="sm" disabled={locked || atLimit} onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          <span className="ml-1.5">Add Q&A</span>
        </Button>
      </OnboardingKnowledgeLimitAction>
      <Button type="button" variant="outlinePrimary" size="sm" disabled={locked} onClick={openImport}>
        <Upload className="size-4" aria-hidden />
        <span className="ml-1.5">Import CSV</span>
      </Button>
    </div>
  );

  return (
    <OnboardingKnowledgePanel
      title="Q&A"
      icon={MessagesSquare}
      count={{ current: qas.length, max: ONBOARDING_KNOWLEDGE_QA_MAX }}
      limitMessage={limitMessage}
      helper="Group related questions under a title with one shared answer."
      action={qas.length > 0 ? headerActions : undefined}
    >
      {actionError ? (
        <p className="m-0 text-[0.75rem] text-[var(--color-danger-text-emphasis)]" role="alert">
          {actionError}
        </p>
      ) : null}

      {qas.length === 0 ? (
        <OnboardingKnowledgeEmptyState
          icon={MessagesSquare}
          title="No Q&A yet"
          description="Add question-and-answer pairs manually, or import them from a spreadsheet."
          action={emptyActions}
        />
      ) : (
        <OnboardingKnowledgePaginatedList
          items={qas}
          maxItems={ONBOARDING_KNOWLEDGE_QA_MAX}
          getKey={(qa) => qa.id}
          selection={{
            selectedIds,
            onToggle: toggle,
            onTogglePage: togglePage,
            onClear: clear,
            onBulkDelete: () => setDeleteMode({ type: 'bulk', count: selectedCount }),
            disabled: rowDisabled,
            deleting,
          }}
          renderItem={(qa, selection) => (
            <OnboardingKnowledgeListCard
              title={qa.title}
              meta={`${qa.questions.length} question${qa.questions.length === 1 ? '' : 's'}`}
              preview={qaAnswerPreview(qa.answer)}
              selectable
              selected={selection.selected}
              onSelectChange={selection.onToggle}
              disabled={rowDisabled}
              onEdit={() => openEdit(qa)}
              onDelete={() => setDeleteMode({ type: 'single', item: qa })}
            />
          )}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        allowDismiss={!saving}
        title={editing ? 'Edit Q&A' : 'Add Q&A'}
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void saveQa()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {formError ? (
            <p className="m-0 text-[0.75rem] text-[var(--color-danger-text-emphasis)]" role="alert">
              {formError}
            </p>
          ) : null}
          <FieldRow
            label="Title"
            labelAddon={<KnowledgeUtf8Meter value={form.title} maxBytes={KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES} />}
          >
            <Input
              quiet
              value={form.title}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  title: clampStrUtf8Bytes(e.target.value, KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES),
                }))
              }
              placeholder="e.g. Shipping and returns"
            />
          </FieldRow>
          <FieldRow
            label="Questions"
            labelRowClassName="gap-2"
            labelTrailing={
              <span
                className="knowledge-source-panel-count-tag"
                aria-label={`${questionCount} of ${MAX_QUESTIONS} questions`}
              >
                {questionCount}/{MAX_QUESTIONS}
              </span>
            }
            labelAddon={
              <KnowledgeUtf8Meter
                value=""
                displayUsedBytes={faqQuestionsCombinedUtf8Bytes(form.questions)}
                maxBytes={KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES}
              />
            }
          >
            <div className="flex flex-col gap-2">
              {form.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    quiet
                    className="flex-1"
                    value={q}
                    disabled={saving}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        questions: clampFaqQuestionLineInCombinedBudget(
                          f.questions,
                          i,
                          e.target.value,
                          KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES,
                        ),
                      }))
                    }
                    placeholder={`Question ${i + 1}`}
                  />
                  {form.questions.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2"
                      disabled={saving}
                      aria-label={`Remove question ${i + 1}`}
                      onClick={() =>
                        setForm((f) => ({ ...f, questions: f.questions.filter((_, j) => j !== i) }))
                      }
                    >
                      <Trash2 className="size-4 text-slate-500" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
              {!atQuestionLimit ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="self-start"
                  disabled={saving}
                  onClick={() => setForm((f) => ({ ...f, questions: [...f.questions, ''] }))}
                >
                  Add question
                </Button>
              ) : null}
            </div>
          </FieldRow>
          <FieldRow
            label="Answer"
            labelAddon={<KnowledgeUtf8Meter value={form.answer} maxBytes={KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES} />}
          >
            <Textarea
              quiet
              rows={4}
              className="min-h-[6rem] resize-none"
              value={form.answer}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  answer: clampStrUtf8Bytes(e.target.value, KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES),
                }))
              }
              placeholder="The answer your agent should use."
            />
          </FieldRow>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={closeImport}
        allowDismiss={!importing}
        title="Import Q&A from CSV"
        description={`Columns: title, questions, answer. Separate question variants with |. Up to ${ONBOARDING_KNOWLEDGE_QA_MAX} items.`}
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" disabled={importing} onClick={closeImport}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              <span className="ml-1.5">{importing ? 'Importing…' : 'Choose CSV'}</span>
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
            <p className="m-0 text-xs leading-relaxed text-slate-600">
              Download the template below—one Q&amp;A topic per row. Leave the header row as-is.
            </p>
            <Button
              type="button"
              variant="outlinePrimary"
              size="sm"
              disabled={importing}
              onClick={() => downloadQaSampleSpreadsheet()}
            >
              <Download className="size-3.5" aria-hidden />
              <span className="ml-1.5">Download Sample CSV</span>
            </Button>
          </div>

          {importError ? (
            <p className="m-0 whitespace-pre-wrap text-[0.75rem] text-[var(--color-danger-text-emphasis)]" role="alert">
              {importError}
            </p>
          ) : null}
          {importErrors.length > 0 ? (
            <div className="max-h-40 overflow-auto rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
              <p className="m-0 mb-2 text-xs font-medium text-rose-700">Fix these rows and try again:</p>
              <ul className="m-0 list-disc pl-5 text-xs text-rose-700">
                {importErrors.slice(0, 50).map((e, i) => (
                  <li key={`${e.row}-${e.column}-${i}`}>
                    Row {e.row} ({e.column}): {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleImport(file);
            }}
          />
        </div>
      </Modal>

      <KnowledgeDeleteConfirmModal
        open={deleteMode != null}
        onClose={() => !deleting && setDeleteMode(null)}
        onConfirm={() => void confirmDelete()}
        title={deleteTitle}
        description={deleteDescription}
        busy={deleting}
      />
    </OnboardingKnowledgePanel>
  );
}
