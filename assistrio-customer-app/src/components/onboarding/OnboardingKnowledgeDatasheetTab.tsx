import { useId, useMemo, useRef, useState } from 'react';

import { Upload, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui';

import {
  CUSTOMER_BOT_DOCUMENT_UPLOAD_MAX_BYTES,
  CUSTOMER_DOCUMENT_UPLOAD_SIZE_MESSAGE,
} from '@/lib/botFieldLimits';

import {
  ONBOARDING_KNOWLEDGE_DATASHEETS_MAX,
  ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES,
} from '@/lib/onboardingKnowledgeLimits';

import type { WorkspaceOnboardingStagedKnowledgeItem } from '@/api/types';

import { stagedDatasheetDisplayName } from '@/onboarding/onboardingKnowledge';

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
  '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const DATASHEETS_HELPER = `Upload CSV or Excel with headers in the first row. Max ${ONBOARDING_KNOWLEDGE_DATASHEETS_MAX} files · 20 MB each.`;

const DATASHEETS_EMPTY_DESCRIPTION = 'Upload your first datasheet using the button below.';

const DATASHEETS_LIMIT_MESSAGE = `Maximum of ${ONBOARDING_KNOWLEDGE_DATASHEETS_MAX} datasheets reached.`;

/** Backend rejects header-only sheets; upload failure is surfaced via toast only. */
export function isOnboardingDatasheetHeaderOnlyError(message: string | null | undefined): boolean {
  const normalized = message?.trim().toLowerCase() ?? '';
  return normalized.includes('header-only') || normalized.includes('no data rows found');
}

type DeleteMode =
  | { type: 'single'; item: WorkspaceOnboardingStagedKnowledgeItem }
  | { type: 'bulk'; count: number }
  | null;

type Props = {
  datasheets: WorkspaceOnboardingStagedKnowledgeItem[];
  uploading: boolean;
  uploadError: string | null;
  disabled?: boolean;
  deleting?: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onDelete?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onBulkDelete?: (ids: string[]) => Promise<{ ok: boolean; error?: string; deletedCount?: number }>;
};

export function OnboardingKnowledgeDatasheetTab({
  datasheets,
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

  const itemIds = useMemo(() => datasheets.map((item) => item.id), [datasheets]);
  const { selectedIds, selectedCount, toggle, togglePage, clear } = useOnboardingKnowledgeSelection(itemIds);

  const atLimit = datasheets.length >= ONBOARDING_KNOWLEDGE_DATASHEETS_MAX;

  function pickFile(list: FileList | null) {
    if (!list?.length || disabled || uploading || atLimit) return;
    const file = list[0];
    if (!file || file.size <= 0) return;
    void onUpload(file);
  }

  const locked = disabled || uploading || deleting || atLimit;
  const rowDisabled = disabled || uploading || deleting;

  async function confirmDelete() {
    if (!deleteMode || !onDelete) return;
    setDeleteError(null);

    if (deleteMode.type === 'single') {
      const res = await onDelete(deleteMode.item.id);
      if (!res.ok) {
        setDeleteError(res.error ?? 'Could not delete datasheet.');
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
      setDeleteError(res.error ?? 'Could not delete datasheets.');
      return;
    }
    clear();
    setDeleteMode(null);
  }

  const triggerUpload = () => fileInputRef.current?.click();

  const headerUploadButton = (
    <OnboardingKnowledgeLimitAction atLimit={atLimit} message={DATASHEETS_LIMIT_MESSAGE}>
      <Button type="button" variant="primary" size="sm" disabled={locked} onClick={triggerUpload}>
        <Upload className="size-4" aria-hidden />
        <span className="ml-1.5">{uploading ? 'Uploading…' : 'Upload Datasheets'}</span>
      </Button>
    </OnboardingKnowledgeLimitAction>
  );

  const emptyUploadButton = (
    <OnboardingKnowledgeLimitAction atLimit={atLimit} message={DATASHEETS_LIMIT_MESSAGE}>
      <Button type="button" variant="outlinePrimary" size="sm" disabled={locked} onClick={triggerUpload}>
        <Upload className="size-4" aria-hidden />
        <span className="ml-1.5">{uploading ? 'Uploading…' : 'Upload Datasheets'}</span>
      </Button>
    </OnboardingKnowledgeLimitAction>
  );

  const deleteTitle =
    deleteMode?.type === 'bulk'
      ? deleteMode.count === 1
        ? 'Delete this item?'
        : `Delete ${deleteMode.count} selected items?`
      : 'Delete this datasheet?';

  const deleteDescription =
    deleteMode?.type === 'bulk'
      ? 'This action cannot be undone.'
      : deleteMode?.type === 'single'
        ? `"${stagedDatasheetDisplayName(deleteMode.item)}" will be removed from agent knowledge.`
        : undefined;

  return (
    <OnboardingKnowledgePanel
      title="Datasheets"
      icon={FileSpreadsheet}
      count={{ current: datasheets.length, max: ONBOARDING_KNOWLEDGE_DATASHEETS_MAX }}
      limitMessage={DATASHEETS_LIMIT_MESSAGE}
      helper={DATASHEETS_HELPER}
      action={datasheets.length > 0 ? headerUploadButton : undefined}
    >
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={locked}
        onChange={(e) => {
          pickFile(e.target.files);
          e.target.value = '';
        }}
      />

      {datasheets.length === 0 ? (
        <OnboardingKnowledgeEmptyState
          icon={FileSpreadsheet}
          title="No datasheets yet"
          description={DATASHEETS_EMPTY_DESCRIPTION}
          action={emptyUploadButton}
        />
      ) : (
        <OnboardingKnowledgePaginatedList
          items={datasheets}
          maxItems={ONBOARDING_KNOWLEDGE_DATASHEETS_MAX}
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
              variant="datasheet"
              selectable
              selected={selection.selected}
              onSelectChange={selection.onToggle}
              disabled={rowDisabled}
              onDelete={() => setDeleteMode({ type: 'single', item })}
            />
          )}
        />
      )}

      {deleteError || (uploadError && !isOnboardingDatasheetHeaderOnlyError(uploadError)) ? (
        <p className="m-0 text-[0.75rem] leading-snug text-[var(--color-danger-text-emphasis)]" role="alert">
          {deleteError ?? uploadError}
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

export function validateDatasheetUploadFile(file: File): { ok: true; file: File } | { ok: false; error: string } {
  if (file.size <= 0) return { ok: false, error: 'No file selected.' };

  if (file.size > CUSTOMER_BOT_DOCUMENT_UPLOAD_MAX_BYTES || file.size > ONBOARDING_KNOWLEDGE_FILE_MAX_BYTES) {
    return { ok: false, error: `${CUSTOMER_DOCUMENT_UPLOAD_SIZE_MESSAGE} ${file.name} is too large.` };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    return { ok: false, error: 'Use a .csv, .xlsx, or .xls file.' };
  }

  return { ok: true, file };
}
