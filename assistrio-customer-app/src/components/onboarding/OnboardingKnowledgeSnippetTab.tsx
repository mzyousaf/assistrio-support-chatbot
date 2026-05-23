import { useMemo, useRef, useState } from 'react';
import { AlignLeft, Download, Loader2, Plus, StickyNote, Upload } from 'lucide-react';
import type { WorkspaceOnboardingDraftSnippet } from '@/api/types';
import { Button, FieldRow, Input, Modal, Textarea } from '@/components/ui';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import {
  clampStrUtf8Bytes,
  KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES,
  KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES,
} from '@/lib/knowledgeContentUtf8Limits';
import { ONBOARDING_KNOWLEDGE_SNIPPETS_MAX } from '@/lib/onboardingKnowledgeLimits';
import { downloadSnippetSampleSpreadsheet } from '@/lib/snippetSpreadsheetSampleDownload';
import { snippetPreview } from '@/onboarding/onboardingKnowledge';
import { KnowledgeDeleteConfirmModal } from '@/pages/bot-workspace/knowledge/knowledgeSourcesListUi';
import {
  OnboardingKnowledgeEmptyState,
  OnboardingKnowledgeLimitAction,
  OnboardingKnowledgeListCard,
  OnboardingKnowledgePanel,
} from './OnboardingKnowledgeShared';
import { OnboardingKnowledgePaginatedList } from './OnboardingKnowledgePaginatedList';
import { useOnboardingKnowledgeSelection } from './onboardingKnowledgeSelection';

type SnippetForm = { title: string; description: string };

type DeleteMode =
  | { type: 'single'; item: WorkspaceOnboardingDraftSnippet }
  | { type: 'bulk'; count: number }
  | null;

type ImportErrorRow = { row: number; column: string; message: string };

type Props = {
  snippets: WorkspaceOnboardingDraftSnippet[];
  disabled?: boolean;
  busy?: boolean;
  onCreate: (body: SnippetForm) => Promise<{ ok: boolean; error?: string }>;
  onUpdate: (id: string, body: SnippetForm) => Promise<{ ok: boolean; error?: string }>;
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

export function OnboardingKnowledgeSnippetTab({
  snippets,
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
  const [editing, setEditing] = useState<WorkspaceOnboardingDraftSnippet | null>(null);
  const [form, setForm] = useState<SnippetForm>({ title: '', description: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ImportErrorRow[]>([]);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const itemIds = useMemo(() => snippets.map((snippet) => snippet.id), [snippets]);
  const { selectedIds, selectedCount, toggle, togglePage, clear } = useOnboardingKnowledgeSelection(itemIds);

  function openCreate() {
    setEditing(null);
    setForm({ title: '', description: '' });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(snippet: WorkspaceOnboardingDraftSnippet) {
    setEditing(snippet);
    setForm({ title: snippet.title, description: snippet.description });
    setFormError(null);
    setModalOpen(true);
  }

  async function saveSnippet() {
    setFormError(null);
    const title = form.title.trim();
    const description = form.description.trim();
    if (!title || !description) {
      setFormError('Title and description are required.');
      return;
    }
    setSaving(true);
    const res = editing
      ? await onUpdate(editing.id, { title, description })
      : await onCreate({ title, description });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not save snippet.');
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
        setActionError(res.error ?? 'Could not delete snippet.');
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
      setActionError(res.error ?? 'Could not delete snippets.');
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

  function isSpreadsheetFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return (
      name.endsWith('.csv') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      file.type === 'text/csv' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }

  async function handleImport(file: File) {
    if (!isSpreadsheetFile(file)) {
      setImportError('Choose a CSV or Excel file (.csv, .xlsx).');
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
  const atLimit = snippets.length >= ONBOARDING_KNOWLEDGE_SNIPPETS_MAX;
  const limitMessage = `Maximum of ${ONBOARDING_KNOWLEDGE_SNIPPETS_MAX} snippets reached.`;

  const deleteTitle =
    deleteMode?.type === 'bulk'
      ? deleteMode.count === 1
        ? 'Delete this item?'
        : `Delete ${deleteMode.count} selected items?`
      : 'Delete this snippet?';

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
        <span className="ml-1.5">Import snippets</span>
      </Button>
      <OnboardingKnowledgeLimitAction atLimit={atLimit} message={limitMessage}>
        <Button type="button" variant="primary" size="sm" disabled={locked || atLimit} onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          <span className="ml-1.5">Add snippet</span>
        </Button>
      </OnboardingKnowledgeLimitAction>
    </div>
  );

  const emptyActions = (
    <div className="flex flex-wrap justify-center gap-2">
      <OnboardingKnowledgeLimitAction atLimit={atLimit} message={limitMessage}>
        <Button type="button" variant="outlinePrimary" size="sm" disabled={locked || atLimit} onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          <span className="ml-1.5">Add snippet</span>
        </Button>
      </OnboardingKnowledgeLimitAction>
      <Button type="button" variant="outlinePrimary" size="sm" disabled={locked} onClick={openImport}>
        <Upload className="size-4" aria-hidden />
        <span className="ml-1.5">Import snippets</span>
      </Button>
    </div>
  );

  const headerAddButton = headerActions;
  const emptyAddButton = emptyActions;

  return (
    <OnboardingKnowledgePanel
      title="Snippets"
      icon={StickyNote}
      count={{ current: snippets.length, max: ONBOARDING_KNOWLEDGE_SNIPPETS_MAX }}
      limitMessage={limitMessage}
      helper="Add titled notes your agent can reference."
      action={snippets.length > 0 ? headerAddButton : undefined}
    >
      {actionError ? (
        <p className="m-0 text-[0.75rem] text-[var(--color-danger-text-emphasis)]" role="alert">
          {actionError}
        </p>
      ) : null}

      {snippets.length === 0 ? (
        <OnboardingKnowledgeEmptyState
          icon={AlignLeft}
          title="No snippets yet"
          description="Add short notes with a title and description your agent can reference."
          action={emptyAddButton}
        />
      ) : (
        <OnboardingKnowledgePaginatedList
          items={snippets}
          maxItems={ONBOARDING_KNOWLEDGE_SNIPPETS_MAX}
          getKey={(snippet) => snippet.id}
          selection={{
            selectedIds,
            onToggle: toggle,
            onTogglePage: togglePage,
            onClear: clear,
            onBulkDelete: () => setDeleteMode({ type: 'bulk', count: selectedCount }),
            disabled: rowDisabled,
            deleting,
          }}
          renderItem={(snippet, selection) => (
            <OnboardingKnowledgeListCard
              title={snippet.title}
              preview={snippetPreview(snippet.description)}
              selectable
              selected={selection.selected}
              onSelectChange={selection.onToggle}
              disabled={rowDisabled}
              onEdit={() => openEdit(snippet)}
              onDelete={() => setDeleteMode({ type: 'single', item: snippet })}
            />
          )}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        allowDismiss={!saving}
        title={editing ? 'Edit snippet' : 'Add snippet'}
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void saveSnippet()}>
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
            labelAddon={
              <KnowledgeUtf8Meter value={form.title} maxBytes={KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES} />
            }
          >
            <Input
              quiet
              value={form.title}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  title: clampStrUtf8Bytes(e.target.value, KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES),
                }))
              }
              placeholder="e.g. Return policy"
            />
          </FieldRow>
          <FieldRow
            label="Description"
            labelAddon={
              <KnowledgeUtf8Meter value={form.description} maxBytes={KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES} />
            }
          >
            <Textarea
              quiet
              rows={6}
              className="min-h-[9rem] resize-none"
              value={form.description}
              disabled={saving}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  description: clampStrUtf8Bytes(e.target.value, KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES),
                }))
              }
              placeholder="What should your agent know?"
            />
          </FieldRow>
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

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleImport(f);
        }}
      />

      <Modal
        open={importOpen}
        onClose={closeImport}
        allowDismiss={!importing}
        title="Import snippets from spreadsheet"
        description={`Columns: title, description, content. Up to ${ONBOARDING_KNOWLEDGE_SNIPPETS_MAX} snippets total.`}
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
              <span className="ml-1.5">{importing ? 'Importing…' : 'Choose file'}</span>
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
            <p className="m-0 text-xs leading-relaxed text-slate-600">
              Download the template below—one snippet per row. Leave the header row as-is.
            </p>
            <Button
              type="button"
              variant="outlinePrimary"
              size="sm"
              disabled={importing}
              onClick={() => downloadSnippetSampleSpreadsheet()}
            >
              <Download className="size-4" aria-hidden />
              <span className="ml-1.5">Download sample sheet</span>
            </Button>
          </div>
          {importError ? (
            <p className="m-0 text-[0.75rem] text-[var(--color-danger-text-emphasis)]" role="alert">
              {importError}
            </p>
          ) : null}
          {importErrors.length > 0 ? (
            <ul className="m-0 max-h-40 list-none space-y-1 overflow-y-auto p-0 text-[0.75rem] text-[var(--color-danger-text-emphasis)]">
              {importErrors.slice(0, 50).map((row) => (
                <li key={`${row.row}-${row.column}`}>
                  Row {row.row}, {row.column}: {row.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Modal>
    </OnboardingKnowledgePanel>
  );
}
