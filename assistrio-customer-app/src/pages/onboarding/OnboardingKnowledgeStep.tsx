import { useEffect, useMemo, useState } from 'react';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import { useOnboardingStepUi } from '../../onboarding/OnboardingStepUiContext';
import { useRegisterOnboardingStepActions } from '../../onboarding/OnboardingStepActionsContext';
import {
  hasOnboardingKnowledgeFromDraft,
  hasValidQa,
  hasValidSnippet,
  stagedDocumentsFromOnboarding,
  sortedStagedDocumentItemsFromOnboarding,
  stagedDatasheetsFromOnboarding,
  sortedOnboardingSnippets,
  sortedOnboardingQas,
  onboardingKbItemsSortFingerprint,
} from '../../onboarding/onboardingKnowledge';

import { styles } from './onboardingStep';
import { OnboardingStepPanel } from '@/components/onboarding/OnboardingStepPanel';
import {
  OnboardingKnowledgeTabs,
  type OnboardingKnowledgeTabCounts,
  type OnboardingKnowledgeTabId,
} from '@/components/onboarding/OnboardingKnowledgeTabs';
import {
  OnboardingKnowledgeFileTab,
  validateKnowledgeUploadFiles,
} from '@/components/onboarding/OnboardingKnowledgeFileTab';
import {
  OnboardingKnowledgeDatasheetTab,
  validateDatasheetUploadFile,
  isOnboardingDatasheetHeaderOnlyError,
} from '@/components/onboarding/OnboardingKnowledgeDatasheetTab';
import { OnboardingKnowledgeSnippetTab } from '@/components/onboarding/OnboardingKnowledgeSnippetTab';
import { OnboardingKnowledgeQaTab } from '@/components/onboarding/OnboardingKnowledgeQaTab';
import { OnboardingKnowledgeRequirementBanner } from '@/components/onboarding/OnboardingKnowledgeShared';
import {
  toastOnboardingDatasheetUploaded,
  toastOnboardingDatasheetUploadFailed,
  toastOnboardingDocumentsUploaded,
  toastOnboardingDocumentsUploadFailed,
  toastOnboardingKnowledgeDeleteFailed,
  toastOnboardingKnowledgeBulkDeletePartial,
  toastOnboardingKnowledgeItemDeleted,
  toastOnboardingKnowledgeItemSaveFailed,
  toastOnboardingKnowledgeItemSaved,
  toastOnboardingQaImportFailed,
  toastOnboardingQaImportSkipped,
  toastOnboardingQaImported,
  toastOnboardingSnippetImportFailed,
  toastOnboardingSnippetImportSkipped,
  toastOnboardingSnippetImported,
} from '@/lib/onboardingActionToasts';
import { appToast } from '@/lib/app-toast';

const STEP = 'knowledge-base';

function tabPanelLabel(tab: OnboardingKnowledgeTabId): string {
  switch (tab) {
    case 'file':
      return 'Documents';
    case 'snippet':
      return 'Snippets';
    case 'qa':
      return 'Q&A';
    case 'datasheet':
      return 'Datasheets';
  }
}

export function OnboardingKnowledgeStep() {
  const flow = useOnboardingFlow();
  const { markStepAttemptFailed, clearStepAttempt, attemptedStepIds, setSavingStepId } = useOnboardingStepUi();
  const {
    onboarding,
    markStepDone,
    goToNextAfter,
    uploadOnboardingDocuments,
    uploadOnboardingDatasheet,
    deleteOnboardingDocument,
    deleteOnboardingDocuments,
    deleteOnboardingDatasheet,
    deleteOnboardingDatasheets,
    createOnboardingSnippet,
    updateOnboardingSnippet,
    deleteOnboardingSnippet,
    deleteOnboardingSnippets,
    createOnboardingQa,
    updateOnboardingQa,
    deleteOnboardingQa,
    deleteOnboardingQas,
    importOnboardingQas,
    importOnboardingSnippets,
    reloadOnboarding,
  } = flow;

  useEffect(() => {
    void reloadOnboarding();
  }, [reloadOnboarding]);

  const knowledge = onboarding?.draft.knowledge;
  const stagedKnowledge = onboarding?.stagedKnowledge;
  const [activeTab, setActiveTab] = useState<OnboardingKnowledgeTabId>('file');
  const [error, setError] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docDeleting, setDocDeleting] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const [sheetUploading, setSheetUploading] = useState(false);
  const [sheetDeleting, setSheetDeleting] = useState(false);
  const [sheetUploadError, setSheetUploadError] = useState<string | null>(null);
  const [kbBusy, setKbBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const stagedDocumentItems = useMemo(
    () => sortedStagedDocumentItemsFromOnboarding(stagedKnowledge),
    [stagedKnowledge],
  );
  const stagedDocuments = useMemo(
    () => stagedDocumentsFromOnboarding(stagedKnowledge),
    [stagedKnowledge],
  );
  const stagedDatasheets = useMemo(
    () => stagedDatasheetsFromOnboarding(stagedKnowledge),
    [stagedKnowledge],
  );
  const snippetSortKey = onboardingKbItemsSortFingerprint(knowledge?.snippets);
  const qaSortKey = onboardingKbItemsSortFingerprint(knowledge?.qas);
  const snippets = useMemo(
    () => sortedOnboardingSnippets(knowledge?.snippets),
    [knowledge?.snippets, snippetSortKey],
  );
  const qas = useMemo(
    () => sortedOnboardingQas(knowledge?.qas),
    [knowledge?.qas, qaSortKey],
  );

  const tabCounts: OnboardingKnowledgeTabCounts = {
    file: stagedDocuments.length,
    snippet: snippets.filter(hasValidSnippet).length,
    qa: qas.filter(hasValidQa).length,
    datasheet: stagedDatasheets.length,
  };

  async function onDocumentUpload(files: File[]) {
    setDocUploadError(null);
    const validated = validateKnowledgeUploadFiles(files);
    if (!validated.ok) {
      setDocUploadError(validated.error);
      appToast.warning('Could not upload documents', { description: validated.error });
      return;
    }
    setDocUploading(true);
    const res = await uploadOnboardingDocuments(validated.files);
    setDocUploading(false);
    if (!res.ok) {
      setDocUploadError(res.error);
      toastOnboardingDocumentsUploadFailed(res.error);
      return;
    }
    toastOnboardingDocumentsUploaded(validated.files.length);
    clearStepAttempt(STEP);
  }

  async function onDocumentDelete(id: string) {
    setDocDeleting(true);
    const res = await deleteOnboardingDocument(id);
    setDocDeleting(false);
    if (!res.ok) {
      toastOnboardingKnowledgeDeleteFailed('document', res.error);
      return { ok: false, error: res.error };
    }
    toastOnboardingKnowledgeItemDeleted('document');
    return { ok: true };
  }

  async function onDocumentsBulkDelete(ids: string[]) {
    setDocDeleting(true);
    const res = await deleteOnboardingDocuments(ids);
    setDocDeleting(false);
    if (!res.ok) {
      toastOnboardingKnowledgeDeleteFailed('document', res.error);
      return { ok: false, error: res.error };
    }
    if (res.deletedCount <= 0) {
      toastOnboardingKnowledgeDeleteFailed('document', 'No items were removed.');
      return { ok: false, error: 'No items were removed.' };
    }
    if (res.deletedCount < ids.length) {
      toastOnboardingKnowledgeBulkDeletePartial(res.deletedCount, ids.length);
    } else {
      toastOnboardingKnowledgeItemDeleted('document', res.deletedCount);
    }
    return { ok: true, deletedCount: res.deletedCount };
  }

  async function onDatasheetUpload(file: File) {
    setSheetUploadError(null);
    const validated = validateDatasheetUploadFile(file);
    if (!validated.ok) {
      setSheetUploadError(validated.error);
      appToast.warning('Could not upload datasheet', { description: validated.error });
      return;
    }
    setSheetUploading(true);
    const res = await uploadOnboardingDatasheet(validated.file);
    setSheetUploading(false);
    if (!res.ok) {
      if (!isOnboardingDatasheetHeaderOnlyError(res.error)) {
        setSheetUploadError(res.error);
      }
      toastOnboardingDatasheetUploadFailed(res.error);
      return;
    }
    toastOnboardingDatasheetUploaded(validated.file.name);
    clearStepAttempt(STEP);
  }

  async function onDatasheetDelete(id: string) {
    setSheetDeleting(true);
    const res = await deleteOnboardingDatasheet(id);
    setSheetDeleting(false);
    if (!res.ok) {
      toastOnboardingKnowledgeDeleteFailed('datasheet', res.error);
      return { ok: false, error: res.error };
    }
    toastOnboardingKnowledgeItemDeleted('datasheet');
    return { ok: true };
  }

  async function onDatasheetsBulkDelete(ids: string[]) {
    setSheetDeleting(true);
    const res = await deleteOnboardingDatasheets(ids);
    setSheetDeleting(false);
    if (!res.ok) {
      toastOnboardingKnowledgeDeleteFailed('datasheet', res.error);
      return { ok: false, error: res.error };
    }
    if (res.deletedCount <= 0) {
      toastOnboardingKnowledgeDeleteFailed('datasheet', 'No items were removed.');
      return { ok: false, error: 'No items were removed.' };
    }
    if (res.deletedCount < ids.length) {
      toastOnboardingKnowledgeBulkDeletePartial(res.deletedCount, ids.length);
    } else {
      toastOnboardingKnowledgeItemDeleted('datasheet', res.deletedCount);
    }
    return { ok: true, deletedCount: res.deletedCount };
  }

  async function onSnippetsBulkDelete(ids: string[]) {
    setKbBusy(true);
    const res = await deleteOnboardingSnippets(ids);
    setKbBusy(false);
    if (!res.ok) {
      toastOnboardingKnowledgeDeleteFailed('snippet', res.error);
      return { ok: false, error: res.error };
    }
    if (res.deletedCount <= 0) {
      toastOnboardingKnowledgeDeleteFailed('snippet', 'No items were removed.');
      return { ok: false, error: 'No items were removed.' };
    }
    if (res.deletedCount < ids.length) {
      toastOnboardingKnowledgeBulkDeletePartial(res.deletedCount, ids.length);
    } else {
      toastOnboardingKnowledgeItemDeleted('snippet', res.deletedCount);
    }
    clearStepAttempt(STEP);
    return { ok: true, deletedCount: res.deletedCount };
  }

  async function onQasBulkDelete(ids: string[]) {
    setKbBusy(true);
    const res = await deleteOnboardingQas(ids);
    setKbBusy(false);
    if (!res.ok) {
      toastOnboardingKnowledgeDeleteFailed('Q&A', res.error);
      return { ok: false, error: res.error };
    }
    if (res.deletedCount <= 0) {
      toastOnboardingKnowledgeDeleteFailed('Q&A', 'No items were removed.');
      return { ok: false, error: 'No items were removed.' };
    }
    if (res.deletedCount < ids.length) {
      toastOnboardingKnowledgeBulkDeletePartial(res.deletedCount, ids.length);
    } else {
      toastOnboardingKnowledgeItemDeleted('Q&A', res.deletedCount);
    }
    clearStepAttempt(STEP);
    return { ok: true, deletedCount: res.deletedCount };
  }

  async function wrapKbAction<T extends { ok: boolean; error?: string }>(
    fn: () => Promise<T>,
    toast?: {
      onSuccess?: () => void;
      onError?: (error?: string) => void;
    },
  ): Promise<T> {
    setKbBusy(true);
    const res = await fn();
    setKbBusy(false);
    if (res.ok) {
      toast?.onSuccess?.();
      clearStepAttempt(STEP);
    } else {
      toast?.onError?.(res.error);
    }
    return res;
  }

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasOnboardingKnowledgeFromDraft(onboarding?.draft ?? null, stagedKnowledge)) {
      setError('Add at least one knowledge source — a file, datasheet, snippet, or Q&A.');
      markStepAttemptFailed(STEP);
      return;
    }
    clearStepAttempt(STEP);
    setSaving(true);
    setSavingStepId(STEP);
    try {
      await markStepDone(STEP);
      goToNextAfter(STEP);
    } finally {
      setSaving(false);
      setSavingStepId(null);
    }
  }

  const hasKnowledge = hasOnboardingKnowledgeFromDraft(onboarding?.draft ?? null, stagedKnowledge);
  const busy =
    saving || docUploading || docDeleting || sheetUploading || sheetDeleting || kbBusy;
  const showRequirementBanner = !hasKnowledge;
  const bannerEmphasized = attemptedStepIds.has(STEP) || Boolean(error);

  useRegisterOnboardingStepActions({
    primaryLabel: saving ? 'Saving…' : 'Continue',
    primaryLoading: saving,
    primaryDisabled: busy && !saving,
  });

  return (
    <OnboardingStepPanel
      stepId={STEP}
      headerClassName="onboarding-knowledge-header"
      eyebrow="Knowledge base"
      title="Setup Knowledge for Your AI Agent"
      description="Add documents, snippets, Q&A pairs, or datasheets so your AI Agent can answer with your own content."
      helperLine="You only need one source to continue. Changes save automatically."
      formProps={{ onSubmit: onContinue, className: 'onboarding-knowledge-stack' }}
    >
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}

      {showRequirementBanner ? (
        <OnboardingKnowledgeRequirementBanner emphasized={bannerEmphasized} />
      ) : null}

      <OnboardingKnowledgeTabs
        value={activeTab}
        onChange={setActiveTab}
        counts={tabCounts}
        disabled={busy}
      />

      <div className="knowledge-workspace" role="tabpanel" aria-label={tabPanelLabel(activeTab)}>
        {activeTab === 'file' ? (
            <OnboardingKnowledgeFileTab
              documents={[]}
              stagedDocuments={stagedDocumentItems}
              uploading={docUploading}
              deleting={docDeleting}
              uploadError={docUploadError}
              disabled={busy}
              onUpload={onDocumentUpload}
              onDelete={onDocumentDelete}
              onBulkDelete={onDocumentsBulkDelete}
            />
          ) : null}

          {activeTab === 'snippet' ? (
            <OnboardingKnowledgeSnippetTab
              snippets={snippets}
              disabled={busy}
              busy={kbBusy}
              onCreate={(body) =>
                wrapKbAction(() => createOnboardingSnippet(body), {
                  onSuccess: () => toastOnboardingKnowledgeItemSaved('snippet', 'create'),
                  onError: (err) => toastOnboardingKnowledgeItemSaveFailed('snippet', err),
                })
              }
              onUpdate={(id, body) =>
                wrapKbAction(() => updateOnboardingSnippet(id, body), {
                  onSuccess: () => toastOnboardingKnowledgeItemSaved('snippet', 'update'),
                  onError: (err) => toastOnboardingKnowledgeItemSaveFailed('snippet', err),
                })
              }
              onDelete={(id) =>
                wrapKbAction(() => deleteOnboardingSnippet(id), {
                  onSuccess: () => toastOnboardingKnowledgeItemDeleted('snippet'),
                  onError: (err) => toastOnboardingKnowledgeDeleteFailed('snippet', err),
                })
              }
              onBulkDelete={onSnippetsBulkDelete}
              onImport={async (file) => {
                const res = await wrapKbAction(() => importOnboardingSnippets(file));
                if (res.ok && 'imported' in res) {
                  const imported = res.imported ?? 0;
                  const skipped = res.skippedCount ?? 0;
                  if (imported > 0) toastOnboardingSnippetImported(imported);
                  if (skipped > 0) toastOnboardingSnippetImportSkipped(skipped, res.skippedReason);
                } else if (!res.ok) {
                  toastOnboardingSnippetImportFailed(res.error);
                }
                return res;
              }}
            />
          ) : null}

          {activeTab === 'qa' ? (
            <OnboardingKnowledgeQaTab
              qas={qas}
              disabled={busy}
              busy={kbBusy}
              onCreate={(body) =>
                wrapKbAction(() => createOnboardingQa(body), {
                  onSuccess: () => toastOnboardingKnowledgeItemSaved('Q&A', 'create'),
                  onError: (err) => toastOnboardingKnowledgeItemSaveFailed('Q&A', err),
                })
              }
              onUpdate={(id, body) =>
                wrapKbAction(() => updateOnboardingQa(id, body), {
                  onSuccess: () => toastOnboardingKnowledgeItemSaved('Q&A', 'update'),
                  onError: (err) => toastOnboardingKnowledgeItemSaveFailed('Q&A', err),
                })
              }
              onDelete={(id) =>
                wrapKbAction(() => deleteOnboardingQa(id), {
                  onSuccess: () => toastOnboardingKnowledgeItemDeleted('Q&A'),
                  onError: (err) => toastOnboardingKnowledgeDeleteFailed('Q&A', err),
                })
              }
              onBulkDelete={onQasBulkDelete}
              onImport={async (file) => {
                const res = await wrapKbAction(() => importOnboardingQas(file));
                if (res.ok && 'imported' in res) {
                  const imported = res.imported ?? 0;
                  const skipped = res.skippedCount ?? 0;
                  if (imported > 0) toastOnboardingQaImported(imported);
                  if (skipped > 0) toastOnboardingQaImportSkipped(skipped, res.skippedReason);
                } else if (!res.ok) {
                  toastOnboardingQaImportFailed(res.error);
                }
                return res;
              }}
            />
          ) : null}

          {activeTab === 'datasheet' ? (
            <OnboardingKnowledgeDatasheetTab
              datasheets={stagedDatasheets}
              uploading={sheetUploading}
              deleting={sheetDeleting}
              uploadError={sheetUploadError}
              disabled={busy}
              onUpload={onDatasheetUpload}
              onDelete={onDatasheetDelete}
              onBulkDelete={onDatasheetsBulkDelete}
            />
          ) : null}
      </div>
    </OnboardingStepPanel>
  );
}
