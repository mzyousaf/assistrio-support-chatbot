import type {
  CustomerBotDetail,
  CustomerWorkspaceDocument,
  WorkspaceOnboardingDraftQa,
  WorkspaceOnboardingDraftSnippet,
  WorkspaceOnboardingDraftSnapshot,
  WorkspaceOnboardingStagedKnowledge,
  WorkspaceOnboardingStagedKnowledgeItem,
} from '../api/types';
import { sortOnboardingKbItemsLatestFirst } from '../lib/sortOnboardingKbItems';

export function documentRowId(doc: CustomerWorkspaceDocument): string {
  if (doc.id) return String(doc.id);
  if (doc._id == null) return '';
  return typeof doc._id === 'string' ? doc._id : doc._id.toString();
}

export function documentDisplayName(doc: CustomerWorkspaceDocument): string {
  return (
    String(doc.displayLabel ?? doc.displayName ?? doc.title ?? doc.fileName ?? doc.originalName ?? 'Document').trim() ||
    'Document'
  );
}

export function isUserUploadedKnowledgeDocument(doc: CustomerWorkspaceDocument): boolean {
  if (doc.active === false) return false;
  return String(doc.sourceType ?? '').toLowerCase() === 'upload';
}

export function countUserUploadedDocuments(docs: CustomerWorkspaceDocument[]): number {
  return docs.filter(isUserUploadedKnowledgeDocument).length;
}

export function hasValidSnippet(snippet: WorkspaceOnboardingDraftSnippet): boolean {
  return Boolean(String(snippet.title ?? '').trim() && String(snippet.description ?? '').trim());
}

export function hasValidQa(qa: WorkspaceOnboardingDraftQa): boolean {
  const questions = (qa.questions ?? []).map((q) => String(q ?? '').trim()).filter(Boolean);
  return Boolean(String(qa.title ?? '').trim() && String(qa.answer ?? '').trim() && questions.length > 0);
}

/** At least one onboarding knowledge source from draft text, staged files, or datasheets. */
export function hasOnboardingKnowledgeFromDraft(
  draft: WorkspaceOnboardingDraftSnapshot | null | undefined,
  stagedKnowledge?: WorkspaceOnboardingStagedKnowledge | null,
): boolean {
  if (stagedKnowledge) {
    if ((stagedKnowledge.documents?.length ?? 0) > 0) return true;
    if ((stagedKnowledge.datasheets?.length ?? 0) > 0) return true;
  }
  if (!draft?.knowledge) return false;
  if ((draft.knowledge.snippets ?? []).some(hasValidSnippet)) return true;
  if ((draft.knowledge.qas ?? []).some(hasValidQa)) return true;
  if (String(draft.knowledge.knowledgeDescription ?? '').trim().length > 0) return true;
  return (draft.knowledge.faqs ?? []).some(
    (f) => String(f.question ?? '').trim() && String(f.answer ?? '').trim(),
  );
}

export function stagedDocumentToWorkspaceDocument(
  item: WorkspaceOnboardingStagedKnowledgeItem,
): CustomerWorkspaceDocument {
  return {
    id: item.id,
    _id: item.id,
    displayName: item.originalName,
    displayLabel: item.originalName,
    fileName: item.originalName,
    originalName: item.originalName,
    sourceType: 'upload',
    active: true,
    status: item.status,
    statusLabel: 'Staged',
    fileSize: item.sizeBytes,
    createdAt: item.createdAt ?? undefined,
  };
}

export function sortedStagedDocumentItemsFromOnboarding(
  stagedKnowledge?: WorkspaceOnboardingStagedKnowledge | null,
): WorkspaceOnboardingStagedKnowledgeItem[] {
  return sortOnboardingKbItemsLatestFirst(stagedKnowledge?.documents ?? []);
}

export function stagedDocumentsFromOnboarding(
  stagedKnowledge?: WorkspaceOnboardingStagedKnowledge | null,
): CustomerWorkspaceDocument[] {
  return sortOnboardingKbItemsLatestFirst(stagedKnowledge?.documents ?? []).map(
    stagedDocumentToWorkspaceDocument,
  );
}

export function stagedDatasheetsFromOnboarding(
  stagedKnowledge?: WorkspaceOnboardingStagedKnowledge | null,
): WorkspaceOnboardingStagedKnowledgeItem[] {
  return sortOnboardingKbItemsLatestFirst(stagedKnowledge?.datasheets ?? []);
}

export function onboardingKbItemsSortFingerprint(
  items:
    | ReadonlyArray<{
        id: string;
        createdAt?: string | null;
        updatedAt?: string | null;
        sequence?: number;
        updateSequence?: number;
      }>
    | undefined
    | null,
): string {
  return (items ?? [])
    .map(
      (item) =>
        `${item.id}:${item.updateSequence ?? ''}:${item.updatedAt ?? ''}:${item.sequence ?? ''}:${item.createdAt ?? ''}`,
    )
    .join('|');
}

export function sortedOnboardingSnippets(
  snippets: WorkspaceOnboardingDraftSnippet[] | undefined | null,
): WorkspaceOnboardingDraftSnippet[] {
  return sortOnboardingKbItemsLatestFirst(snippets ?? []);
}

export function sortedOnboardingQas(
  qas: WorkspaceOnboardingDraftQa[] | undefined | null,
): WorkspaceOnboardingDraftQa[] {
  return sortOnboardingKbItemsLatestFirst(qas ?? []);
}

export function stagedDatasheetDisplayName(item: WorkspaceOnboardingStagedKnowledgeItem): string {
  const sheetName = item.metadata?.sheetName;
  if (typeof sheetName === 'string' && sheetName.trim()) return sheetName.trim();
  return item.originalName;
}

export function snippetPreview(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export function qaAnswerPreview(text: string, max = 100): string {
  return snippetPreview(text, max);
}

/** Legacy helpers — bot workspace only. */
export function hasKnowledgeSnippet(bot: CustomerBotDetail | null): boolean {
  return String(bot?.knowledgeDescription ?? '').trim().length > 0;
}

export function hasKnowledgeFaq(bot: CustomerBotDetail | null): boolean {
  const faqs = Array.isArray(bot?.faqs) ? bot!.faqs! : [];
  return faqs.some((f) => String(f.question ?? '').trim() && String(f.answer ?? '').trim());
}

export function hasOnboardingKnowledgeSource(
  bot: CustomerBotDetail | null,
  documents?: CustomerWorkspaceDocument[] | null,
): boolean {
  if (hasKnowledgeSnippet(bot) || hasKnowledgeFaq(bot)) return true;
  return countUserUploadedDocuments(documents ?? []) > 0;
}
