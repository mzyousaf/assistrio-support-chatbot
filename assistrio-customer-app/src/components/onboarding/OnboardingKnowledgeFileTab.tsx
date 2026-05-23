import { useId, useMemo, useRef, useState } from 'react';

import { Upload, FileText } from 'lucide-react';

import { Button } from '@/components/ui';

import {
  CUSTOMER_BOT_DOCUMENT_UPLOAD_MAX_BYTES,
  CUSTOMER_DOCUMENT_UPLOAD_SIZE_MESSAGE,
  KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX,
} from '@/lib/botFieldLimits';

import {
  ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX,
  ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES,
} from '@/lib/onboardingKnowledgeLimits';

import { toastOnboardingDocumentsPartialSkipped } from '@/lib/onboardingActionToasts';

import type { CustomerWorkspaceDocument, WorkspaceOnboardingStagedKnowledgeItem } from '@/api/types';

import {
  documentDisplayName,
  documentRowId,
  isUserUploadedKnowledgeDocument,
} from '@/onboarding/onboardingKnowledge';

import { KnowledgeDeleteConfirmModal } from '@/pages/bot-workspace/knowledge/knowledgeSourcesListUi';

import { KnowledgeStagedFileListItem } from './KnowledgeStagedFileListItem';
import { OnboardingKnowledgePaginatedList } from './OnboardingKnowledgePaginatedList';
import { useOnboardingKnowledgeSelection } from './onboardingKnowledgeSelection';
import {
  OnboardingKnowledgeEmptyState,
  OnboardingKnowledgeLimitAction,
  OnboardingKnowledgePanel,
} from './OnboardingKnowledgeShared';

const ACCEPT =
  '.pdf,.doc,.docx,.txt,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

const DOCUMENTS_HELPER = `Upload PDF, Word, or text files your agent can learn from. Max ${ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX} files · 20 MB each.`;

const DOCUMENTS_EMPTY_DESCRIPTION = 'Upload your first document using the button below.';

const DOCUMENTS_LIMIT_MESSAGE = `Maximum of ${ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX} documents reached.`;

type DeleteMode =
  | { type: 'single'; item: WorkspaceOnboardingStagedKnowledgeItem }
  | { type: 'bulk'; count: number }
  | null;

type Props = {
  documents: CustomerWorkspaceDocument[];
  stagedDocuments?: WorkspaceOnboardingStagedKnowledgeItem[];
  uploading: boolean;
  uploadError: string | null;
  disabled?: boolean;
  deleting?: boolean;
  onUpload: (files: File[]) => void | Promise<void>;
  onDelete?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onBulkDelete?: (ids: string[]) => Promise<{ ok: boolean; error?: string; deletedCount?: number }>;
};

export function OnboardingKnowledgeFileTab({
  documents,
  stagedDocuments = [],
  uploading,
  uploadError,
  disabled,
  deleting,
  onUpload,
  onDelete,
  onBulkDelete,
}: Props) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const items =
    stagedDocuments.length > 0
      ? stagedDocuments
      : documents.filter(isUserUploadedKnowledgeDocument).map((doc) => ({
          id: documentRowId(doc) ?? documentDisplayName(doc),
          sourceType: 'document' as const,
          originalName: documentDisplayName(doc),
          mimeType: '',
          sizeBytes: 0,
          status: 'uploaded',
          createdAt: null,
        }));

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const { selectedIds, selectedCount, toggle, togglePage, clear } = useOnboardingKnowledgeSelection(itemIds);

  const atLimit = items.length >= ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX;

  function pickFiles(list: FileList | null) {
    if (!list?.length || disabled || uploading || atLimit) return;
    const files = Array.from(list).filter((f) => f.size > 0);
    if (files.length === 0) return;
    const remaining = ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX - items.length;
    const maxUpload = Math.min(KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX, remaining);
    const toUpload = files.slice(0, maxUpload);
    const skipped = files.length - toUpload.length;
    if (skipped > 0) {
      toastOnboardingDocumentsPartialSkipped({
        selected: files.length,
        uploading: toUpload.length,
        skipped,
      });
    }
    if (toUpload.length === 0) return;
    void onUpload(toUpload);
  }

  const locked = disabled || uploading || deleting || atLimit;
  const rowDisabled = disabled || uploading || deleting;

  async function confirmDelete() {
    if (!deleteMode || !onDelete) return;
    setDeleteError(null);

    if (deleteMode.type === 'single') {
      const res = await onDelete(deleteMode.item.id);
      if (!res.ok) {
        setDeleteError(res.error ?? 'Could not delete file.');
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
      setDeleteError(res.error ?? 'Could not delete files.');
      return;
    }
    clear();
    setDeleteMode(null);
  }

  const triggerUpload = () => fileInputRef.current?.click();

  const headerUploadButton = (
    <OnboardingKnowledgeLimitAction atLimit={atLimit} message={DOCUMENTS_LIMIT_MESSAGE}>
      <Button type="button" variant="primary" size="sm" disabled={locked} onClick={triggerUpload}>
        <Upload className="size-4" aria-hidden />
        <span className="ml-1.5">{uploading ? 'Uploading…' : 'Upload Documents'}</span>
      </Button>
    </OnboardingKnowledgeLimitAction>
  );

  const emptyUploadButton = (
    <OnboardingKnowledgeLimitAction atLimit={atLimit} message={DOCUMENTS_LIMIT_MESSAGE}>
      <Button type="button" variant="outlinePrimary" size="sm" disabled={locked} onClick={triggerUpload}>
        <Upload className="size-4" aria-hidden />
        <span className="ml-1.5">{uploading ? 'Uploading…' : 'Upload Documents'}</span>
      </Button>
    </OnboardingKnowledgeLimitAction>
  );

  const deleteTitle =
    deleteMode?.type === 'bulk'
      ? deleteMode.count === 1
        ? 'Delete this item?'
        : `Delete ${deleteMode.count} selected items?`
      : 'Delete this file?';

  const deleteDescription =
    deleteMode?.type === 'bulk'
      ? 'This action cannot be undone.'
      : deleteMode?.type === 'single'
        ? `"${deleteMode.item.originalName}" will be removed from agent knowledge.`
        : undefined;

  return (
    <OnboardingKnowledgePanel
      title="Documents"
      icon={FileText}
      count={{ current: items.length, max: ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX }}
      limitMessage={DOCUMENTS_LIMIT_MESSAGE}
      helper={DOCUMENTS_HELPER}
      action={items.length > 0 ? headerUploadButton : undefined}
    >
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        disabled={locked}
        onChange={(e) => {
          pickFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {items.length === 0 ? (
        <OnboardingKnowledgeEmptyState
          icon={FileText}
          title="No documents yet"
          description={DOCUMENTS_EMPTY_DESCRIPTION}
          action={emptyUploadButton}
        />
      ) : (
        <OnboardingKnowledgePaginatedList
          items={items}
          maxItems={ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX}
          getKey={(item) => item.id}
          selection={{
            selectedIds,
            onToggle: toggle,
            onTogglePage: togglePage,
            onClear: clear,
            onBulkDelete: () => setDeleteMode({ type: 'bulk', count: selectedCount }),
            disabled: rowDisabled,
            deleting,
          }}
          renderItem={(item, selection) => (
            <KnowledgeStagedFileListItem
              item={item}
              variant="document"
              selectable
              selected={selection.selected}
              onSelectChange={selection.onToggle}
              disabled={rowDisabled}
              onDelete={() => setDeleteMode({ type: 'single', item })}
            />
          )}
        />
      )}

      {uploadError || deleteError ? (
        <p className="m-0 text-[0.75rem] leading-snug text-[var(--color-danger-text-emphasis)]" role="alert">
          {uploadError ?? deleteError}
        </p>
      ) : null}

      <KnowledgeDeleteConfirmModal
        open={deleteMode != null}
        onClose={() => !deleting && setDeleteMode(null)}
        onConfirm={() => void confirmDelete()}
        title={deleteTitle}
        description={deleteDescription}
        busy={Boolean(deleting)}
      />
    </OnboardingKnowledgePanel>
  );
}

export function validateKnowledgeUploadFiles(files: File[]): { ok: true; files: File[] } | { ok: false; error: string } {
  const list = files.filter((f) => f.size > 0);
  if (list.length === 0) return { ok: false, error: 'No files selected.' };

  const oversize = list.filter(
    (f) => f.size > CUSTOMER_BOT_DOCUMENT_UPLOAD_MAX_BYTES || f.size > ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES,
  );

  if (oversize.length > 0) {
    return { ok: false, error: `${CUSTOMER_DOCUMENT_UPLOAD_SIZE_MESSAGE} ${oversize[0]!.name} is too large.` };
  }

  return { ok: true, files: list.slice(0, KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX) };
}
