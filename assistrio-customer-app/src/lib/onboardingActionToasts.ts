import { appToast } from '@/lib/app-toast';
import { ONBOARDING_QA_IMPORT_SKIPPED_REASON } from '@/lib/onboardingKnowledgeLimits';
import {
  KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX,
} from '@/lib/botFieldLimits';
import { ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX } from '@/lib/onboardingKnowledgeLimits';

export type OnboardingStepId = 'agent-profile' | 'describe-profile' | 'knowledge-base' | 'go-live';

const STEP_SAVE_SUCCESS: Record<OnboardingStepId, { title: string; description: string }> = {
  'agent-profile': {
    title: 'Profile saved',
    description: 'Your agent name, tagline, category, and appearance are updated.',
  },
  'describe-profile': {
    title: 'Instructions saved',
    description: 'Your agent instructions are updated.',
  },
  'knowledge-base': {
    title: 'Knowledge saved',
    description: 'Your knowledge changes are saved.',
  },
  'go-live': {
    title: 'Agent published',
    description: 'Your agent is live. Install it on your website when you are ready.',
  },
};

function stepLabel(step: OnboardingStepId): string {
  return STEP_SAVE_SUCCESS[step].title.replace(/ saved$| published$/, '');
}

export function toastOnboardingStepSaved(step: OnboardingStepId): void {
  const copy = STEP_SAVE_SUCCESS[step];
  appToast.success(copy.title, { description: copy.description });
}

export function toastOnboardingStepSaveFailed(step: OnboardingStepId, apiDetail?: string): void {
  const detail = apiDetail?.trim();
  appToast.error(`${stepLabel(step)} could not be saved`, {
    description: detail || 'Check your connection and try again.',
  });
}

export function toastOnboardingAvatarUploaded(): void {
  appToast.success('Avatar uploaded', {
    description: 'Your agent avatar is updated.',
  });
}

export function toastOnboardingAvatarUploadFailed(apiDetail?: string): void {
  appToast.error('Avatar could not be uploaded', {
    description: apiDetail?.trim() || 'Try a PNG, JPG, or WEBP under 5 MB.',
  });
}

export function toastOnboardingDocumentsUploaded(count: number): void {
  appToast.success(count === 1 ? 'Document uploaded' : `${count} documents uploaded`, {
    description: 'Files are saved and will be processed after you go live.',
  });
}

export function toastOnboardingDocumentsUploadFailed(apiDetail?: string): void {
  appToast.error('Documents could not be uploaded', {
    description: apiDetail?.trim() || 'Check file type and size (20 MB max each).',
  });
}

/** User selected more files than we can upload in one action (batch or workspace limit). */
export function toastOnboardingDocumentsPartialSkipped(opts: {
  selected: number;
  uploading: number;
  skipped: number;
}): void {
  const { selected, uploading, skipped } = opts;
  if (skipped <= 0) return;
  appToast.warning(
    uploading === 1 ? `Uploading 1 of ${selected} files` : `Uploading ${uploading} of ${selected} files`,
    {
      description: `${skipped} file${skipped === 1 ? ' was' : 's were'} not added. Max ${KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX} per upload and ${ONBOARDING_KNOWLEDGE_DOCUMENTS_MAX} documents total.`,
    },
  );
}

export function toastOnboardingDatasheetUploaded(fileName?: string): void {
  const name = fileName?.trim();
  appToast.success('Datasheet uploaded', {
    description: name ? `${name} was added to agent knowledge.` : 'Your datasheet was added to agent knowledge.',
  });
}

export function toastOnboardingDatasheetUploadFailed(apiDetail?: string): void {
  appToast.error('Datasheet could not be uploaded', {
    description: apiDetail?.trim() || 'Use CSV or Excel with headers in the first row (20 MB max).',
  });
}

export function toastOnboardingKnowledgeItemSaved(
  kind: 'snippet' | 'Q&A',
  mode: 'create' | 'update' = 'update',
): void {
  if (kind === 'snippet') {
    appToast.success(mode === 'create' ? 'Snippet added' : 'Snippet updated', {
      description:
        mode === 'create'
          ? 'Saved to agent knowledge and available after you go live.'
          : 'Your snippet changes are saved.',
    });
    return;
  }
  appToast.success(mode === 'create' ? 'Q&A added' : 'Q&A updated', {
    description:
      mode === 'create'
        ? 'Saved to agent knowledge and available after you go live.'
        : 'Your Q&A changes are saved.',
  });
}

export function toastOnboardingKnowledgeItemSaveFailed(kind: 'snippet' | 'Q&A', apiDetail?: string): void {
  appToast.error(`${kind} could not be saved`, {
    description: apiDetail?.trim() || 'Check required fields and try again.',
  });
}

export function toastOnboardingKnowledgeItemDeleted(kind: 'document' | 'datasheet' | 'snippet' | 'Q&A', count = 1): void {
  const removedFromKnowledge = 'Removed from agent knowledge.';
  const copy =
    kind === 'document'
      ? count === 1
        ? { title: 'Document removed', description: removedFromKnowledge }
        : { title: `${count} documents removed`, description: `${count} documents were removed from agent knowledge.` }
      : kind === 'datasheet'
        ? { title: 'Datasheet removed', description: removedFromKnowledge }
        : kind === 'snippet'
          ? count === 1
            ? { title: 'Snippet removed', description: removedFromKnowledge }
            : {
                title: `${count} snippets removed`,
                description: `${count} snippets were removed from agent knowledge.`,
              }
          : count === 1
            ? { title: 'Q&A removed', description: removedFromKnowledge }
            : {
                title: `${count} Q&A items removed`,
                description: `${count} Q&A items were removed from agent knowledge.`,
              };
  appToast.success(copy.title, { description: copy.description });
}

export function toastOnboardingKnowledgeDeleteFailed(kind: 'document' | 'datasheet' | 'snippet' | 'Q&A', apiDetail?: string): void {
  appToast.error(`Could not remove ${kind === 'Q&A' ? 'Q&A' : kind}`, {
    description: apiDetail?.trim() || 'Try again in a moment.',
  });
}

export function toastOnboardingKnowledgeBulkDeletePartial(removed: number, selected: number): void {
  if (removed <= 0 || selected <= removed) return;
  appToast.warning(`Removed ${removed} of ${selected} items`, {
    description: `${selected - removed} item${selected - removed === 1 ? '' : 's'} could not be removed.`,
  });
}

export function toastOnboardingQaImported(imported: number): void {
  if (imported <= 0) return;
  appToast.success(`Imported ${imported} Q&A item${imported === 1 ? '' : 's'}`, {
    description:
      imported === 1
        ? 'The row was added to agent knowledge.'
        : 'Valid rows were added to agent knowledge.',
  });
}

export function toastOnboardingQaImportSkipped(skippedCount: number, skippedReason?: string): void {
  if (skippedCount <= 0) return;
  appToast.warning(`${skippedCount} Q&A row${skippedCount === 1 ? '' : 's'} skipped`, {
    description: skippedReason?.trim() || ONBOARDING_QA_IMPORT_SKIPPED_REASON,
  });
}

export function toastOnboardingQaImportFailed(apiDetail?: string): void {
  appToast.error('Q&A import failed', {
    description: apiDetail?.trim() || 'Check your spreadsheet format and try again.',
  });
}

export function toastOnboardingSnippetImported(imported: number): void {
  if (imported <= 0) return;
  appToast.success(`Imported ${imported} snippet${imported === 1 ? '' : 's'}`, {
    description:
      imported === 1
        ? 'The row was added to agent knowledge.'
        : 'Valid rows were added to agent knowledge.',
  });
}

export function toastOnboardingSnippetImportSkipped(skippedCount: number, skippedReason?: string): void {
  if (skippedCount <= 0) return;
  appToast.warning(`${skippedCount} snippet row${skippedCount === 1 ? '' : 's'} skipped`, {
    description:
      skippedReason?.trim() ||
      'Only the first 5 snippets are imported during onboarding.',
  });
}

export function toastOnboardingSnippetImportFailed(apiDetail?: string): void {
  appToast.error('Snippet import failed', {
    description: apiDetail?.trim() || 'Check your spreadsheet format and try again.',
  });
}

export function toastOnboardingGoLiveFailed(apiDetail?: string): void {
  appToast.error('Could not publish agent', {
    description: apiDetail?.trim() || 'Check your website URL and try again.',
  });
}

export function toastOnboardingGoLiveRecoverable(message: string): void {
  appToast.warning('Agent created — knowledge still preparing', {
    description: message,
  });
}
