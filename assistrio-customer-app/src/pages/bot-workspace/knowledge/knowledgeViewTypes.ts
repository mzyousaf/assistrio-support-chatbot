import type {
  CustomerBotDetail,
  CustomerKnowledgeStatusItem,
  CustomerWorkspaceDocument,
} from '../../../api/types';
import {
  KNOWLEDGE_TRAINING_STATUSES,
  mergeDocumentRowCanonicalTrainingStatus,
  baselineDocumentRowTrainingStatus,
  clientDocumentUploadingBadgeClassName,
  knowledgeTrainingListScheduleSubline,
  knowledgeTrainingQueuedScheduleSubline,
  knowledgeTrainingStatusBadgeClassName,
  knowledgeTrainingStatusDotClassName as kbItemTrainingStatusDotClassName,
  knowledgeTrainingStatusLabel as kbItemTrainingStatusLabel,
  mergeKbTrainingLifecycleForDisplay,
  normalizeKnowledgeTrainingStatus,
  type KnowledgeTrainingStatus,
  knowledgeTrainingStatusDotClassName,
  knowledgeTrainingStatusLabel,
} from '@/lib/knowledgeTrainingStatus';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import { utf8ByteLength } from '@/lib/knowledgeContentUtf8Limits';
import { knowledgeRowIndicatesPlanLimitTotal } from '@/lib/knowledgeStorageLimits';
import {
  pickBetterKnowledgeStatusItem,
  pollRowEligibleForKbMerge,
} from '@/lib/knowledgeStatusPollUtils';
import {
  getKnowledgeItemDisplayStatus,
  type KnowledgeItemDisplayDotCanon,
  type KnowledgeItemDisplayInput,
  type WorkspaceDocumentDisplayOptions,
  workspaceDocumentToDisplayInput,
} from '@/lib/knowledgeItemDisplayStatus';

/** Prefer poll `trainingStatus` (import phases, storage codes) over raw `status` for list/detail chip parity. */
export function kbStatusPollLifecycleRaw(u: CustomerKnowledgeStatusItem): string {
  const ts = u.trainingStatus != null && String(u.trainingStatus).trim();
  if (ts === 'out_of_storage') return 'out_of_storage';
  if (ts) return String(u.trainingStatus).trim();
  return String(u.status ?? '');
}

/**
 * Merge bot `trainingStatus` with poll `status` for detail/analytics. When the poll primary lifecycle (`status`) is
 * **ready** and nothing is actively training, trust that over a stale bot embed — including when **Use in replies** is
 * off (`active: false`), so lightweight status matches the API. Parallel `trainingStatus` still wins for terminal codes
 * (`out_of_storage`, `failed`). If `status` is not ready, fall back to {@link mergeKbTrainingLifecycleForDisplay}.
 */
export function kbDetailLifecycleRawForDisplay(
  rowTraining: KnowledgeTrainingStatus | string | null | undefined,
  poll: CustomerKnowledgeStatusItem,
): KnowledgeTrainingStatus | string | null | undefined {
  const pNorm = normalizeKnowledgeTrainingStatus(poll.status);
  const pollParallel = poll.trainingStatus != null && String(poll.trainingStatus).trim();
  const parallelNorm = pollParallel ? normalizeKnowledgeTrainingStatus(poll.trainingStatus) : null;

  const trustPrimaryPollReady = pNorm === 'ready' && poll.isTraining !== true;
  if (trustPrimaryPollReady) {
    if (parallelNorm === 'out_of_storage' || parallelNorm === 'failed') {
      return kbStatusPollLifecycleRaw(poll);
    }
    /** Prefer primary `status`; do not let a stale parallel `trainingStatus` (e.g. still `pending`) mask trained. */
    return 'ready';
  }

  return mergeKbTrainingLifecycleForDisplay(rowTraining, poll.status);
}

function mergedIndexedRowTrainingStatusFromPoll(
  rowTrainingStatus: KnowledgeTrainingStatus | string | null | undefined,
  u: CustomerKnowledgeStatusItem,
): KnowledgeTrainingStatus {
  const ts = u.trainingStatus != null && String(u.trainingStatus).trim();
  if (ts === 'out_of_storage') return 'out_of_storage';
  return normalizeKnowledgeTrainingStatus(kbDetailLifecycleRawForDisplay(rowTrainingStatus, u));
}

export type { KnowledgeTrainingStatus };
export type KbItemTrainingStatus = KnowledgeTrainingStatus;

export type QaRow = {
  title: string;
  questions: string[];
  answer: string;
  active?: boolean;
  /** Mirrors persisted `faqs` index — from GET bot / status polling merge */
  faqIndex?: number;
  /** Stable KB row id for GET `/knowledge/status` merge after deletes */
  knowledgeItemId?: string;
  trainingStatus?: KbItemTrainingStatus;
  /** Raw poll `trainingStatus` (parallel API field). */
  kbApiTrainingStatus?: string | null;
  /** Prefer for status chip when KB status polling provides it (`displayLabel`). */
  trainingDisplayLabel?: string;
  /** Customer-facing UX key (`display_status`) merged from KB status polls or bot payload. */
  displayStatus?: string;
  /** Optional server display label alongside `trainingDisplayLabel` */
  displayLabel?: string | null;
  lastTrainedAt?: string | null;
  /** From lightweight GET `/knowledge/status` polling */
  trainingError?: string | null;
  runAfter?: string | null;
};
export type SnippetRow = {
  title: string;
  snippet: string;
  active?: boolean;
  snippetIndex?: number;
  knowledgeItemId?: string;
  trainingStatus?: KbItemTrainingStatus;
  kbApiTrainingStatus?: string | null;
  trainingDisplayLabel?: string;
  displayStatus?: string;
  displayLabel?: string | null;
  lastTrainedAt?: string | null;
  trainingError?: string | null;
  runAfter?: string | null;
};

export {
  KNOWLEDGE_TRAINING_STATUSES,
  knowledgeTrainingStatusBadgeClassName,
  knowledgeTrainingStatusDotClassName,
  knowledgeTrainingStatusLabel,
  kbItemTrainingStatusDotClassName,
  kbItemTrainingStatusLabel,
};

/** Document rows merged with polling may carry KB item `_id` for Retrain / KB status correlation. */
export type DocumentRowWithKbMeta = CustomerWorkspaceDocument & {
  knowledgeItemId?: string;
  lastQueuedAt?: string | null;
  runAfter?: string | null;
  lastTrainingStartedAt?: string | null;
  /** From lightweight status merge (ready). */
  lastTrainedAt?: string | null;
  trainingError?: string | null;
  extractionError?: string | null;
  extractionStatus?: string;
  displayStatus?: string;
  displayMessage?: string | null;
  /** From KB status polling `displayLabel` when richer than inferred training labels */
  trainingDisplayLabel?: string;
};

export function pickKbItemTrainingStatus(raw: unknown): KnowledgeTrainingStatus | null {
  if (raw == null) return null;
  if (typeof raw === 'string' && !raw.trim()) return null;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return normalizeKnowledgeTrainingStatus(raw);
  }
  return null;
}

/** Character count after trim (aligned with backend knowledge text metrics). */
export function characterCountTrimmed(text: string | null | undefined): number {
  return String(text ?? '').trim().length;
}

/** Treat as text-extracted for UI when API omits `isContentExtracted` but counts exist. */
export function documentRowContentExtractedForDisplay(doc: CustomerWorkspaceDocument): boolean {
  if (doc.isContentExtracted === true) return true;
  const c = doc.characterCount;
  return typeof c === 'number' && c > 0;
}

export type DocumentTrainingUiPhase =
  | 'uploading'
  | 'extracting'
  | 'pending'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed';

export function documentTrainingUiPhase(doc: CustomerWorkspaceDocument): DocumentTrainingUiPhase {
  const uploadSt = String((doc as { uploadStatus?: unknown }).uploadStatus ?? '').trim().toLowerCase();
  if (uploadSt === 'uploading') return 'uploading';
  if (uploadSt === 'upload_failed') return 'failed';
  const extracted = documentRowContentExtractedForDisplay(doc);
  if (uploadSt === 'uploaded' && !extracted) return 'extracting';
  const st = baselineDocumentRowTrainingStatus(doc);
  if (!extracted) {
    if (uploadSt === '') {
      if (st === 'processing') return 'processing';
      if (st === 'ready') return 'ready';
      if (st === 'failed') return 'failed';
      if (st === 'queued') return 'queued';
      return 'extracting';
    }
    if (st === 'failed') return 'failed';
    return 'extracting';
  }
  if (st === 'pending') return 'pending';
  if (st === 'queued') return 'queued';
  if (st === 'processing') return 'processing';
  if (st === 'ready') return 'ready';
  if (st === 'failed') return 'failed';
  return 'pending';
}

/** Portal tooltip for document status pills during upload / extraction (same copy as the “What the status labels mean” modal). */
export function documentPipelineStatusPillHoverDescription(doc: CustomerWorkspaceDocument): string | null {
  const phase = documentTrainingUiPhase(doc);
  if (phase === 'uploading') return 'Your file is still uploading.';
  if (phase === 'extracting') return 'We are reading the text from the file so the assistant can learn it.';
  return null;
}

/** Stage codes aligned with backend `deriveDocumentPipelineDisplay` (`DocumentPipelineStage`). */
export const DOCUMENT_PIPELINE_STAGE_CODES = [
  'uploading',
  'upload_failed',
  'pending_extraction',
  'extract_queued',
  'extract_processing',
  'extract_failed',
  'training_required',
  'training_queued',
  'training',
  'passed',
  'training_failed',
] as const;

const DOCUMENT_PIPELINE_STAGE_SET = new Set<string>(DOCUMENT_PIPELINE_STAGE_CODES);

export function coerceDocumentPipelineStage(doc: CustomerWorkspaceDocument): (typeof DOCUMENT_PIPELINE_STAGE_CODES)[number] | null {
  const raw = String(doc.documentStatus ?? doc.status ?? '')
    .trim()
    .toLowerCase();
  if (!raw || !DOCUMENT_PIPELINE_STAGE_SET.has(raw)) return null;
  return raw as (typeof DOCUMENT_PIPELINE_STAGE_CODES)[number];
}

/** Badge colors aligned with enriched list/detail `documentStatus` / `status`. */
export function knowledgeTrainingBadgeClassForPipelineStage(
  stage: (typeof DOCUMENT_PIPELINE_STAGE_CODES)[number],
): string {
  switch (stage) {
    case 'uploading':
      return clientDocumentUploadingBadgeClassName();
    case 'upload_failed':
    case 'extract_failed':
    case 'training_failed':
      return knowledgeTrainingStatusBadgeClassName('failed');
    case 'pending_extraction':
    case 'extract_queued':
      return knowledgeTrainingStatusBadgeClassName('queued');
    case 'extract_processing':
    case 'training':
      return knowledgeTrainingStatusBadgeClassName('processing');
    case 'training_required':
      return knowledgeTrainingStatusBadgeClassName('pending');
    case 'training_queued':
      return knowledgeTrainingStatusBadgeClassName('queued');
    case 'passed':
      return knowledgeTrainingStatusBadgeClassName('ready');
    default:
      return knowledgeTrainingStatusBadgeClassName('pending');
  }
}

/** Extensions commonly shown on uploaded knowledge filenames — stripped from display labels only (not stored title edits). */
const DOCUMENT_FILENAME_EXTENSIONS = new Set([
  'csv',
  'doc',
  'docx',
  'epub',
  'htm',
  'html',
  'json',
  'key',
  'md',
  'markdown',
  'numbers',
  'odp',
  'ods',
  'odt',
  'pages',
  'pdf',
  'ppt',
  'pptx',
  'rtf',
  'tsv',
  'txt',
  'xls',
  'xlsm',
  'xlsx',
  'xml',
  'zip',
]);

/** Removes a trailing known file extension for UI display (e.g. list titles, edit screen initial name). */
export function stripDocumentFilenameExtension(label: string): string {
  const t = label.trim();
  if (!t) return t;
  const dot = t.lastIndexOf('.');
  if (dot <= 0 || dot === t.length - 1) return t;
  const ext = t.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,12}$/.test(ext) || !DOCUMENT_FILENAME_EXTENSIONS.has(ext)) return t;
  const base = t.slice(0, dot).trimEnd();
  return base.length ? base : t;
}

export function workspaceDocumentPrimaryName(doc: CustomerWorkspaceDocument): string {
  const displayName = stripDocumentFilenameExtension(String(doc.displayName ?? '').trim());
  const title = stripDocumentFilenameExtension(String(doc.title ?? '').trim());
  const originalFilename = stripDocumentFilenameExtension(
    String(doc.originalFilename ?? doc.originalName ?? '').trim(),
  );
  const fileName = stripDocumentFilenameExtension(String(doc.fileName ?? '').trim());
  return displayName || title || originalFilename || fileName || 'Untitled document';
}

/** Training column / detail: prefers KB poll `trainingDisplayLabel`, backend `displayMessage` / `statusLabel`, then heuristics. */
export function formatDocumentTrainingStatusDisplayLabel(
  doc: CustomerWorkspaceDocument,
  opts?: WorkspaceDocumentDisplayOptions,
): string {
  const ext = doc as DocumentRowWithKbMeta;
  if (knowledgeRowIndicatesPlanLimitTotal(ext)) return 'Out of storage';
  return getKnowledgeItemDisplayStatus(workspaceDocumentToDisplayInput(doc, opts)).label;
}

export function documentTrainingDisplayBadgeClassName(
  doc: CustomerWorkspaceDocument,
  opts?: WorkspaceDocumentDisplayOptions,
): string {
  const ext = doc as DocumentRowWithKbMeta;
  if (knowledgeRowIndicatesPlanLimitTotal(ext)) return knowledgeTrainingStatusBadgeClassName('out_of_storage');
  return knowledgeTrainingStatusBadgeClassName(
    getKnowledgeItemDisplayStatus(workspaceDocumentToDisplayInput(doc, opts)).dotCanon,
  );
}

/** Status dot color for documents — aligned with merged KB lifecycle / chip label (not stale list `documentStatus`). */
export function documentTrainingDisplayDotClassName(
  doc: CustomerWorkspaceDocument,
  opts?: WorkspaceDocumentDisplayOptions,
): string {
  const ext = doc as DocumentRowWithKbMeta;
  if (knowledgeRowIndicatesPlanLimitTotal(ext)) return knowledgeTrainingStatusDotClassName('out_of_storage');
  return knowledgeTrainingStatusDotClassName(
    getKnowledgeItemDisplayStatus(workspaceDocumentToDisplayInput(doc, opts)).dotCanon,
  );
}

export type KbLifecycleStatusPollBundle = {
  sourceType?: string;
  active?: boolean;
  /** Direct label from enriched API/KB-status (`display_label`) */
  displayLabelProp?: string | null;
  /** Merged shortcut from lightweight polls */
  trainingDisplayLabel?: string | null;
  /** Backend UX key — import/extract phases must dominate training in {@link getKnowledgeItemDisplayStatus}. */
  displayStatus?: string | null;
  /** Canonical `KnowledgeBaseItem.status` (poll `status` or merged row lifecycle). */
  kbLifecycleStatusRaw?: KnowledgeTrainingStatus | string | null;
  /** Raw poll `trainingStatus` string (parallel API field, e.g. storage codes). */
  pollTrainingStatus?: string | null;
  trainingError?: string | null;
  extractionStatus?: string | null;
  extractionError?: string | null;
  uploadStatus?: string | null;
  isContentExtracted?: boolean;
  characterCount?: number | null;
  extractedTextLength?: number | null;
  tableImportPhase?: string | null;
  isImporting?: boolean;
  isExtracting?: boolean;
  isTraining?: boolean;
  extractManualRetrySuggested?: boolean;
  trainingManualRetrySuggested?: boolean;
  /** From Knowledge Overview — document pending-after-extract label depends on auto train. */
  autoTrainEnabled?: boolean | null;
};

function kbLifecycleBundleToInput(b: KbLifecycleStatusPollBundle): KnowledgeItemDisplayInput {
  return {
    sourceType: b.sourceType ?? 'faq',
    active: b.active !== false,
    status: b.kbLifecycleStatusRaw != null ? String(b.kbLifecycleStatusRaw) : null,
    trainingStatus: b.pollTrainingStatus ?? null,
    displayStatus: b.displayStatus ?? null,
    displayLabel: b.displayLabelProp ?? null,
    trainingDisplayLabel: b.trainingDisplayLabel ?? null,
    trainingError: b.trainingError ?? null,
    extractionStatus: b.extractionStatus ?? null,
    extractionError: b.extractionError ?? null,
    uploadStatus: b.uploadStatus ?? null,
    isContentExtracted: b.isContentExtracted,
    characterCount: b.characterCount,
    extractedTextLength: b.extractedTextLength,
    tableImportPhase: b.tableImportPhase ?? null,
    isImporting: b.isImporting,
    isExtracting: b.isExtracting,
    isTraining: b.isTraining,
    extractManualRetrySuggested: b.extractManualRetrySuggested,
    trainingManualRetrySuggested: b.trainingManualRetrySuggested,
    autoTrainEnabled: b.autoTrainEnabled,
  };
}

/** Canonical chip label for KB list/detail rows — delegates to {@link getKnowledgeItemDisplayStatus}. */
export function kbLifecycleStatusChipLabel(bundle: KbLifecycleStatusPollBundle): string {
  return getKnowledgeItemDisplayStatus(kbLifecycleBundleToInput(bundle)).label;
}

export function kbLifecycleStatusDotCanon(bundle: KbLifecycleStatusPollBundle): KnowledgeItemDisplayDotCanon {
  return getKnowledgeItemDisplayStatus(kbLifecycleBundleToInput(bundle)).dotCanon;
}

/**
 * Detail pages: merge bot snapshot row + lightweight poll without letting stale labels override pipeline fields.
 */
export function kbDetailLifecyclePresentationFromPollRow(args: {
  sourceType: string;
  active?: boolean;
  poll: CustomerKnowledgeStatusItem | null | undefined;
  row: {
    trainingStatus?: KnowledgeTrainingStatus | string | null;
    displayLabel?: string | null;
    trainingDisplayLabel?: string | null;
    displayStatus?: string | null;
    trainingError?: string | null;
    kbApiTrainingStatus?: string | null;
  };
  /** Documents only — pending-after-extract label depends on workspace Auto Train. */
  autoTrainEnabled?: boolean | null;
}): { label: string; dotCanon: KnowledgeItemDisplayDotCanon } {
  const p = args.poll;
  const r = args.row;
  const pollActive =
    p != null && typeof (p as { active?: boolean }).active === 'boolean'
      ? (p as { active: boolean }).active
      : undefined;
  const useInReplies = pollActive !== undefined ? pollActive : args.active !== false;
  const bundle: KbLifecycleStatusPollBundle = {
    sourceType: args.sourceType,
    active: useInReplies,
    displayLabelProp: p?.displayLabel ?? r.displayLabel,
    trainingDisplayLabel: p?.displayLabel ?? r.trainingDisplayLabel,
    displayStatus: p?.displayStatus ?? r.displayStatus,
    kbLifecycleStatusRaw: p != null ? kbDetailLifecycleRawForDisplay(r.trainingStatus, p) : r.trainingStatus,
    pollTrainingStatus: p?.trainingStatus ?? r.kbApiTrainingStatus ?? null,
    trainingError: p?.trainingError ?? r.trainingError ?? null,
    extractionStatus: p?.extractionStatus ?? null,
    extractionError: p?.extractionError ?? null,
    isImporting: p?.isImporting,
    isExtracting: p?.isExtracting,
    isTraining: p?.isTraining,
    autoTrainEnabled: args.autoTrainEnabled,
  };
  return {
    label: kbLifecycleStatusChipLabel(bundle),
    dotCanon: kbLifecycleStatusDotCanon(bundle),
  };
}

type TableKbLifecycleRow = {
  active?: boolean;
  trainingStatus?: KbItemTrainingStatus | string | null;
  trainingError?: string | null;
  trainingDisplayLabel?: string | null | undefined;
  displayStatus?: string | null;
  displayLabel?: string | null;
  tableImportPhase?: string | null;
  isImporting?: boolean;
};

/** FAQs, snippets, suggestions — mirrored list/detail chips. */
export function kbMergedRowTrainingChip(row: KbLifecycleStatusPollBundle): string {
  return kbLifecycleStatusChipLabel(row);
}

export function kbMergedTableTrainingChip(t: TableKbLifecycleRow): string {
  return kbLifecycleStatusChipLabel({
    sourceType: 'table',
    active: t.active !== false,
    displayLabelProp: t.displayLabel,
    trainingDisplayLabel: t.trainingDisplayLabel,
    displayStatus: t.displayStatus,
    kbLifecycleStatusRaw: t.trainingStatus,
    trainingError: t.trainingError,
    tableImportPhase: t.tableImportPhase ?? null,
    isImporting: t.isImporting,
  });
}

export function kbMergedTableTrainingDotCanon(t: TableKbLifecycleRow): KnowledgeItemDisplayDotCanon {
  return kbLifecycleStatusDotCanon({
    sourceType: 'table',
    active: t.active !== false,
    displayLabelProp: t.displayLabel,
    trainingDisplayLabel: t.trainingDisplayLabel,
    displayStatus: t.displayStatus,
    kbLifecycleStatusRaw: t.trainingStatus,
    trainingError: t.trainingError,
    tableImportPhase: t.tableImportPhase ?? null,
    isImporting: t.isImporting,
  });
}

/** @deprecated Prefer {@link kbLifecycleStatusChipLabel}; kept for transitional call sites passing only normalized status strings. */
export function formatKnowledgeItemTrainingStatusDisplayLabel(
  status: KnowledgeTrainingStatus | string | null | undefined,
  trainingError?: string | null,
  displayLabel?: string | null,
): string {
  return kbLifecycleStatusChipLabel({
    kbLifecycleStatusRaw: status,
    trainingError,
    trainingDisplayLabel: displayLabel,
  });
}

export function kbMergedTrainingStatusChipLabel(row: {
  sourceType?: string;
  active?: boolean;
  kbApiTrainingStatus?: string | null;
  trainingDisplayLabel?: string | null;
  trainingStatus?: KnowledgeTrainingStatus | string | null;
  trainingError?: string | null;
  displayStatus?: string | null;
  displayLabel?: string | null;
}): string {
  return kbLifecycleStatusChipLabel({
    sourceType: row.sourceType ?? 'faq',
    active: row.active !== false,
    displayLabelProp: row.displayLabel,
    trainingDisplayLabel: row.trainingDisplayLabel,
    displayStatus: row.displayStatus,
    kbLifecycleStatusRaw: row.trainingStatus,
    pollTrainingStatus: row.kbApiTrainingStatus ?? null,
    trainingError: row.trainingError,
  });
}

/** Dot color driver aligned with {@link kbMergedTrainingStatusChipLabel} for list rows. */
export function kbMergedTrainingStatusDotCanon(row: {
  sourceType?: string;
  active?: boolean;
  kbApiTrainingStatus?: string | null;
  trainingDisplayLabel?: string | null;
  trainingStatus?: KnowledgeTrainingStatus | string | null;
  trainingError?: string | null;
  displayStatus?: string | null;
  displayLabel?: string | null;
}): KnowledgeItemDisplayDotCanon {
  return kbLifecycleStatusDotCanon({
    sourceType: row.sourceType ?? 'faq',
    active: row.active !== false,
    displayLabelProp: row.displayLabel,
    trainingDisplayLabel: row.trainingDisplayLabel,
    displayStatus: row.displayStatus,
    kbLifecycleStatusRaw: row.trainingStatus,
    pollTrainingStatus: row.kbApiTrainingStatus ?? null,
    trainingError: row.trainingError,
  });
}

/** Subline under “Training Queued” when `runAfter` is set (static snapshot). Omits `pending`. */
export function kbListRowQueuedTrainingSubline(
  row: { runAfter?: string | null },
  dotCanon: KnowledgeTrainingStatus | string | null | undefined,
): string | null {
  const c = normalizeKnowledgeTrainingStatus(dotCanon);
  const fromSchedule = knowledgeTrainingListScheduleSubline(c, row.runAfter ?? null, Date.now());
  if (fromSchedule) return fromSchedule;
  return knowledgeTrainingQueuedScheduleSubline(dotCanon, row.runAfter ?? null);
}

/** ISO time shown as “last trained” when the row is trained; prefers poll `lastTrainedAt`, else `ingestedAt` when ready. */
export function documentRowLastTrainedIso(row: CustomerWorkspaceDocument | DocumentRowWithKbMeta): string | null {
  const ext = row as DocumentRowWithKbMeta;
  const fromPoll = typeof ext.lastTrainedAt === 'string' && ext.lastTrainedAt.trim() ? ext.lastTrainedAt.trim() : null;
  if (fromPoll) return fromPoll;
  if (baselineDocumentRowTrainingStatus(row as CustomerWorkspaceDocument) !== 'ready') return null;
  const raw = row.ingestedAt;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object' && raw !== null && 'toISOString' in raw) {
    try {
      return (raw as Date).toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/** List/detail “size” line: character count shown as B / KB / MB (same scale as `formatKnowledgeBytes`). */
export function formatCharacterCountSizeLabel(count: number | null | undefined): string {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return '—';
  return formatKnowledgeBytes(count);
}

export function formatDocumentCharacterCountSizeLabel(doc: CustomerWorkspaceDocument): string {
  const pollUtf8 = doc.storedTextUtf8Bytes;
  if (typeof pollUtf8 === 'number' && Number.isFinite(pollUtf8) && pollUtf8 > 0) {
    return formatKnowledgeUtf8BytesDisplay(pollUtf8);
  }
  if (typeof doc.characterCount === 'number' && Number.isFinite(doc.characterCount) && doc.characterCount >= 0) {
    return formatCharacterCountSizeLabel(doc.characterCount);
  }
  const e = doc.extractedTextLength;
  if (typeof e === 'number' && Number.isFinite(e) && e >= 0) {
    return formatCharacterCountSizeLabel(e);
  }
  return '—';
}

/** Relative time from an ISO timestamp (e.g. “3 days ago”) for last trained. */
export function formatKbItemLastTrainedRelative(
  iso: string | null | undefined,
  opts?: { emptyLabel?: string },
): string {
  const empty = opts?.emptyLabel ?? 'never';
  if (typeof iso !== 'string' || !iso.trim()) return empty;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return empty;
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** Human-readable byte size for datasheet import / KB metadata. */
export function formatKbFileSizeDisplay(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${Math.round(mb * 10) / 10} MB`;
}

/** Locale date + time for “last trained”. */
export function formatKbItemLastTrainedDateTime(
  iso: string | null | undefined,
  opts?: { emptyLabel?: string },
): string {
  const empty = opts?.emptyLabel ?? 'never';
  if (typeof iso !== 'string' || !iso.trim()) return empty;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return empty;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}
export type TableBlock = {
  title: string;
  columns: string[];
  rows: string[][];
  active?: boolean;
  tableIndex?: number;
  knowledgeItemId?: string;
  trainingStatus?: KbItemTrainingStatus;
  kbApiTrainingStatus?: string | null;
  lastTrainedAt?: string | null;
  trainingError?: string | null;
  trainingDisplayLabel?: string;
  displayStatus?: string;
  /** Server display bundle when GET bot echoes it separately from `trainingDisplayLabel` */
  displayLabel?: string | null;
  importFileSize?: number | null;
  importFileName?: string | null;
  runAfter?: string | null;
  tableImportPhase?: string | null;
  isImporting?: boolean;
};

/** Datasheet list “size”: trimmed character count of grid text (not import file bytes). */
export function formatDatasheetCharacterCountSizeLabel(t: TableBlock): string {
  const n = characterCountTrimmed([t.columns.join(' '), ...t.rows.map((r) => r.join(' '))].join('\n'));
  return formatCharacterCountSizeLabel(n);
}

const QA_PRIMARY_LABEL_MAX_CHARS = 96;

function qaAnswerPreviewForPrimaryLabel(answer: string): string {
  const flat = answer.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  if (flat.length <= QA_PRIMARY_LABEL_MAX_CHARS) return flat;
  return `${flat.slice(0, QA_PRIMARY_LABEL_MAX_CHARS - 1).trimEnd()}…`;
}

/**
 * Library title / breadcrumb / detail header for Q&A: title, else first non-empty question,
 * else a short preview of the answer (when title and questions are empty).
 */
export function workspaceQaPrimaryLabel(faq: Pick<QaRow, 'title' | 'questions' | 'answer'>, fallback: string): string {
  const title = String(faq.title ?? '').trim();
  if (title) return title;
  for (const q of faq.questions ?? []) {
    const qt = String(q ?? '').trim();
    if (qt) return qt;
  }
  const fromAnswer = qaAnswerPreviewForPrimaryLabel(String(faq.answer ?? ''));
  if (fromAnswer) return fromAnswer;
  return fallback;
}

/** Approximate stored UTF-8 size for a Q&A row (title + all questions + answer). */
export function qaKnowledgeItemStoredUtf8Bytes(faq: Pick<QaRow, 'title' | 'questions' | 'answer'>): number {
  let n = utf8ByteLength(faq.title ?? '');
  for (const q of faq.questions ?? []) n += utf8ByteLength(String(q ?? ''));
  n += utf8ByteLength(faq.answer ?? '');
  return n;
}

export function snippetKnowledgeItemStoredUtf8Bytes(s: Pick<SnippetRow, 'title' | 'snippet'>): number {
  return utf8ByteLength(s.title ?? '') + utf8ByteLength(s.snippet ?? '');
}

/** Chip label plus optional scoped text (UTF-8 bytes). */
export function suggestionKnowledgeItemStoredUtf8Bytes(s: { label?: string; context?: string }): number {
  return utf8ByteLength(s.label ?? '') + utf8ByteLength(s.context ?? '');
}

/** Stored document body UTF-8 size when `text` is present (detail GET). */
export function documentKnowledgeItemStoredUtf8Bytes(doc: Pick<CustomerWorkspaceDocument, 'text'> | null): number | null {
  if (!doc) return null;
  const t = typeof doc.text === 'string' ? doc.text : '';
  if (!t.trim()) return null;
  return utf8ByteLength(t);
}

/** Human-readable UTF-8 byte size for analytics rows (same scale as list KB meters). */
export function formatKnowledgeUtf8BytesDisplay(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  return formatKnowledgeBytes(bytes);
}

/** Approximate UTF-8 size of datasheet grid (title + cells). */
export function datasheetGridUtf8Bytes(t: Pick<TableBlock, 'title' | 'columns' | 'rows'>): number {
  let n = utf8ByteLength(t.title ?? '');
  for (const c of t.columns ?? []) n += utf8ByteLength(String(c ?? ''));
  for (const r of t.rows ?? []) for (const cell of r ?? []) n += utf8ByteLength(String(cell ?? ''));
  return n;
}

/** Drop columns by original indices (0-based). Requires at least one column left. */
export function tableBlockWithColumnsRemoved(t: TableBlock, removeIndices: Set<number>): TableBlock {
  const keep = t.columns.map((_, i) => i).filter((i) => !removeIndices.has(i));
  if (keep.length === 0) {
    return { ...t, columns: [], rows: t.rows.map(() => []) };
  }
  const columns = keep.map((i) => t.columns[i] ?? '');
  const rows = t.rows.map((r) => keep.map((i) => String(r[i] ?? '')));
  return { ...t, columns, rows };
}

export function datasheetsFromBot(bot: CustomerBotDetail | null): TableBlock[] {
  if (!bot) return [];
  const b = bot as CustomerBotDetail & { knowledgeDatasheets?: TableBlock[]; knowledgeTables?: TableBlock[] };
  const raw = Array.isArray(b.knowledgeDatasheets)
    ? b.knowledgeDatasheets
    : Array.isArray(b.knowledgeTables)
      ? b.knowledgeTables
      : [];
  return raw
    .map((t, arrIdx) => {
      const ext = t as {
        trainingStatus?: unknown;
        lastTrainedAt?: string | null;
        importFileSize?: unknown;
        importFileName?: unknown;
        knowledgeItemId?: unknown;
        displayStatus?: unknown;
        displayLabel?: unknown;
        tableMeta?: { importPhase?: unknown };
      };
      const st = pickKbItemTrainingStatus(ext.trainingStatus);
      const importFileSize =
        typeof ext.importFileSize === 'number' && Number.isFinite(ext.importFileSize)
          ? ext.importFileSize
          : ext.importFileSize === null
            ? null
            : undefined;
      const importFileName =
        typeof ext.importFileName === 'string' && ext.importFileName.trim()
          ? ext.importFileName.trim()
          : ext.importFileName === null
            ? null
            : undefined;
      const tblIdx =
        typeof (t as { tableIndex?: unknown }).tableIndex === 'number'
          ? (t as { tableIndex: number }).tableIndex
          : undefined;
      const kid =
        typeof ext.knowledgeItemId === 'string' && ext.knowledgeItemId.trim()
          ? ext.knowledgeItemId.trim()
          : undefined;

      let syntheticDisplayStatus =
        typeof ext.displayStatus === 'string' && ext.displayStatus.trim() ? ext.displayStatus.trim() : undefined;
      if (!syntheticDisplayStatus && ext.tableMeta != null && typeof ext.tableMeta === 'object') {
        const phRaw = (ext.tableMeta as { importPhase?: unknown }).importPhase;
        const ph = typeof phRaw === 'string' ? phRaw.trim().toLowerCase() : '';
        if (ph === 'import_queued') syntheticDisplayStatus = 'import_queued';
        else if (ph === 'importing') syntheticDisplayStatus = 'importing';
        else if (ph === 'importing_table') syntheticDisplayStatus = 'importing_table';
        else if (ph === 'failed' || ph === 'import_failed') syntheticDisplayStatus = 'import_failed';
      }
      const dsLabel =
        typeof ext.displayLabel === 'string' && ext.displayLabel.trim() ? ext.displayLabel.trim() : undefined;
      const runAfterRaw = (ext as { runAfter?: unknown }).runAfter;
      const runAfter =
        typeof runAfterRaw === 'string' && runAfterRaw.trim()
          ? runAfterRaw.trim()
          : runAfterRaw === null
            ? null
            : undefined;

      return {
        title: (t.title ?? '').trim() || 'Datasheet',
        columns: Array.isArray(t.columns) ? t.columns.map((c) => String(c ?? '')) : [],
        rows: Array.isArray(t.rows) ? t.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : [],
        active: (t as { active?: boolean }).active !== false,
        tableIndex: tblIdx !== undefined ? tblIdx : arrIdx,
        ...(kid ? { knowledgeItemId: kid } : {}),
        ...(st ? { trainingStatus: st } : {}),
        lastTrainedAt: typeof ext.lastTrainedAt === 'string' ? ext.lastTrainedAt : null,
        ...(importFileSize !== undefined ? { importFileSize } : {}),
        ...(importFileName !== undefined ? { importFileName } : {}),
        ...(syntheticDisplayStatus ? { displayStatus: syntheticDisplayStatus } : {}),
        ...(dsLabel ? { displayLabel: dsLabel, trainingDisplayLabel: dsLabel } : {}),
        ...(runAfter !== undefined ? { runAfter } : {}),
      };
    })
    .filter((t) => t.columns.length > 0 && t.rows.length > 0);
}

export function snippetsFromBot(bot: CustomerBotDetail | null): SnippetRow[] {
  if (!bot) return [];
  const b = bot as CustomerBotDetail & { knowledgeSnippets?: SnippetRow[] };
  if (Array.isArray(b.knowledgeSnippets) && b.knowledgeSnippets.length > 0) {
    return b.knowledgeSnippets
      .map((s) => {
        const ext = s as {
          trainingStatus?: unknown;
          lastTrainedAt?: string | null;
          displayStatus?: unknown;
          displayLabel?: unknown;
          trainingDisplayLabel?: unknown;
          trainingError?: unknown;
          /** Rare legacy/admin payloads may use `label` for a titled snippet title. */
          label?: unknown;
          description?: unknown;
        };
        const st = pickKbItemTrainingStatus(ext.trainingStatus);
        const snippetIndex =
          typeof (s as { snippetIndex?: unknown }).snippetIndex === 'number'
            ? (s as { snippetIndex: number }).snippetIndex
            : undefined;
        const sk =
          typeof (s as { knowledgeItemId?: unknown }).knowledgeItemId === 'string' &&
          (s as { knowledgeItemId: string }).knowledgeItemId.trim()
            ? (s as { knowledgeItemId: string }).knowledgeItemId.trim()
            : undefined;
        const titleRaw = String(s.title ?? ext.label ?? '').trim();
        const bodyRaw = String(s.snippet ?? ext.description ?? '').trim();
        const row: SnippetRow = {
          title: titleRaw || 'Snippet',
          snippet: bodyRaw,
          active: (s as { active?: boolean }).active !== false,
          ...(snippetIndex !== undefined ? { snippetIndex } : {}),
          ...(sk ? { knowledgeItemId: sk } : {}),
        };
        if (st != null) row.trainingStatus = st;
        if ('lastTrainedAt' in ext) {
          const lt = ext.lastTrainedAt;
          row.lastTrainedAt = typeof lt === 'string' && lt.trim() ? lt : lt === null ? null : null;
        }
        if (typeof ext.displayStatus === 'string' && ext.displayStatus.trim()) {
          row.displayStatus = ext.displayStatus.trim();
        }
        if (typeof ext.displayLabel === 'string' && ext.displayLabel.trim()) {
          row.displayLabel = ext.displayLabel.trim();
        }
        if (typeof ext.trainingDisplayLabel === 'string' && ext.trainingDisplayLabel.trim()) {
          row.trainingDisplayLabel = ext.trainingDisplayLabel.trim();
        }
        if (typeof ext.trainingError === 'string' && ext.trainingError.trim()) {
          row.trainingError = ext.trainingError.trim();
        }
        const runAfterRaw = (ext as { runAfter?: unknown }).runAfter;
        if (typeof runAfterRaw === 'string' && runAfterRaw.trim()) {
          row.runAfter = runAfterRaw.trim();
        } else if (runAfterRaw === null) {
          row.runAfter = null;
        }
        return row;
      })
      .filter((s) => s.snippet);
  }
  const legacy = String(bot.knowledgeDescription ?? '').trim();
  return legacy ? [{ title: 'Notes', snippet: legacy, active: true }] : [];
}

export function normalizeQaFromApi(raw: unknown): QaRow {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const answer = String(o.answer ?? '').trim();
  const qLegacy = String(o.question ?? '').trim();
  const title = String(o.title ?? '').trim();
  const qs = Array.isArray(o.questions)
    ? (o.questions as unknown[]).map((q) => String(q ?? '').trim()).filter(Boolean)
    : [];
  const questions = qs.length > 0 ? qs : qLegacy ? [qLegacy] : title ? [title] : [];
  const st = pickKbItemTrainingStatus(o.trainingStatus);
  const row: QaRow = { title, questions, answer, active: o.active === false ? false : true };
  if (st != null) row.trainingStatus = st;
  if (typeof o.faqIndex === 'number' && Number.isFinite(o.faqIndex)) row.faqIndex = o.faqIndex;
  if (typeof (o as { knowledgeItemId?: unknown }).knowledgeItemId === 'string') {
    const k = String((o as { knowledgeItemId: string }).knowledgeItemId).trim();
    if (k) row.knowledgeItemId = k;
  }
  if (typeof (o as { displayStatus?: unknown }).displayStatus === 'string') {
    const ds = String((o as { displayStatus: string }).displayStatus).trim();
    if (ds) row.displayStatus = ds;
  }
  if (typeof (o as { displayLabel?: unknown }).displayLabel === 'string') {
    const dl = String((o as { displayLabel: string }).displayLabel).trim();
    if (dl) row.displayLabel = dl;
  }
  if (typeof (o as { trainingDisplayLabel?: unknown }).trainingDisplayLabel === 'string') {
    const tdl = String((o as { trainingDisplayLabel: string }).trainingDisplayLabel).trim();
    if (tdl) row.trainingDisplayLabel = tdl;
  }
  if (typeof (o as { trainingError?: unknown }).trainingError === 'string') {
    const te = String((o as { trainingError: string }).trainingError).trim();
    if (te) row.trainingError = te;
  }
  if ('lastTrainedAt' in o) {
    const lt = o.lastTrainedAt;
    row.lastTrainedAt = typeof lt === 'string' && lt.trim() ? lt : null;
  }
  if ('runAfter' in o) {
    const ra = o.runAfter;
    if (typeof ra === 'string' && ra.trim()) row.runAfter = ra.trim();
    else if (ra === null) row.runAfter = null;
  }
  return row;
}

export function faqsFromBot(bot: CustomerBotDetail | null): QaRow[] {
  if (!bot || !Array.isArray(bot.faqs)) return [];
  return bot.faqs
    .map((f) => normalizeQaFromApi(f))
    .filter((f) => f.answer && (f.questions.length > 0 || f.title));
}

/** Shapes for PATCH `faqs` (backend workspace bot payload). */
export function faqsToPatchPayload(faqs: QaRow[]) {
  return faqs
    .map((f) => {
      const questions = f.questions.map((q) => q.trim()).filter(Boolean);
      const title = f.title.trim();
      const qList = questions.length > 0 ? questions : title ? [title] : [];
      return {
        title: title || undefined,
        questions: qList,
        question: qList[0] ?? 'Question',
        answer: f.answer.trim(),
        active: f.active !== false,
      };
    })
    .filter((f) => f.answer && f.questions.length > 0);
}

/**
 * Mirrors backend `normalizeFaqs` eligibility: non-empty answer and (non-empty title or ≥1 non-empty question).
 */
export function qaFormPassesBackendNormalize(
  title: string,
  questionLines: readonly string[],
  answer: string,
): boolean {
  const a = String(answer ?? '').trim();
  if (!a) return false;
  const t = String(title ?? '').trim();
  const hasQuestion = questionLines.some((q) => String(q ?? '').trim());
  if (!hasQuestion && !t) return false;
  return true;
}

/**
 * Single-row body for `POST …/knowledge/snippets`. Matches workspace snippet normalization
 * (non-empty body; title defaults to `"Snippet"` when blank).
 */
export function snippetAppendPayloadFromForm(
  title: string,
  snippet: string,
  active = true,
): Record<string, unknown> | null {
  const body = String(snippet ?? '').trim();
  if (!body) return null;
  const titleTrim = String(title ?? '').trim();
  return {
    title: titleTrim || 'Snippet',
    snippet: body,
    active,
  };
}

/** Mirrors backend `normalizeKnowledgeSnippets`: rows without body text are dropped. */
export function snippetFormPassesBackendNormalize(snippet: string): boolean {
  return Boolean(String(snippet ?? '').trim());
}

/** When answer is set but title and all question lines are empty — row would be dropped by `normalizeFaqs`. */
export const QA_FORM_IDENTITY_BACKEND_MESSAGE =
  'Add a title or at least one question — required with an answer.';

/** ISO `runAfter` from poll row, or `null` when absent / empty — clears stale merge state. */
export function kbPollRunAfterIso(u: CustomerKnowledgeStatusItem): string | null {
  const v = u.runAfter;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Merge lightweight GET `/knowledge/status` into list rows (stable `id` first, then list slot index). No full reload. */
export function mergeQaRowsWithKbStatusPoll(
  base: QaRow[],
  poll: CustomerKnowledgeStatusItem[] | null | undefined,
): QaRow[] {
  if (!poll || poll.length === 0) return base;
  const byId = new Map<string, CustomerKnowledgeStatusItem>();
  const byIdx = new Map<number, CustomerKnowledgeStatusItem>();
  for (const it of poll) {
    if (!pollRowEligibleForKbMerge(it, 'faq')) continue;
    if (it.id) byId.set(it.id.trim(), it);
    if (typeof it.faqIndex === 'number' && Number.isFinite(it.faqIndex)) {
      const prev = byIdx.get(it.faqIndex);
      byIdx.set(it.faqIndex, prev ? pickBetterKnowledgeStatusItem(prev, it) : it);
    }
  }
  if (byId.size === 0 && byIdx.size === 0) return base;
  return base.map((row, arrayIndex) => {
    const kid = typeof row.knowledgeItemId === 'string' ? row.knowledgeItemId.trim() : '';
    /** Prefer persisted `faqIndex` when present — list order can differ from FAQ slot order. */
    const slotIndex =
      typeof row.faqIndex === 'number' && Number.isFinite(row.faqIndex)
        ? row.faqIndex
        : arrayIndex;
    const u =
      kid && byId.has(kid) ? byId.get(kid) : byIdx.has(slotIndex) ? byIdx.get(slotIndex) : undefined;
    if (!u) return row;
    const pollLabel =
      u.displayLabel != null && String(u.displayLabel).trim() ? String(u.displayLabel).trim() : undefined;
    const { displayLabel: _stripDl, trainingDisplayLabel: _stripTdl, ...rest } = row;
    const pollId = typeof u.id === 'string' && u.id.trim() ? u.id.trim() : '';
    return {
      ...rest,
      ...(pollId ? { knowledgeItemId: pollId } : {}),
      trainingStatus: mergedIndexedRowTrainingStatusFromPoll(row.trainingStatus, u),
      lastTrainedAt: u.lastTrainedAt ?? row.lastTrainedAt,
      ...(u.trainingError != null && String(u.trainingError).trim()
        ? { trainingError: String(u.trainingError).trim() }
        : {}),
      ...(pollLabel !== undefined ? { displayLabel: pollLabel, trainingDisplayLabel: pollLabel } : {}),
      ...(u.displayStatus != null && String(u.displayStatus).trim()
        ? { displayStatus: String(u.displayStatus).trim() }
        : {}),
      runAfter: kbPollRunAfterIso(u),
      ...(typeof u.trainingStatus === 'string' && u.trainingStatus.trim()
        ? { kbApiTrainingStatus: u.trainingStatus.trim() }
        : {}),
      ...(typeof u.active === 'boolean' ? { active: u.active } : {}),
    };
  });
}

export function mergeSnippetRowsWithKbStatusPoll(
  base: SnippetRow[],
  poll: CustomerKnowledgeStatusItem[] | null | undefined,
): SnippetRow[] {
  if (!poll || poll.length === 0) return base;
  const byId = new Map<string, CustomerKnowledgeStatusItem>();
  const byIdx = new Map<number, CustomerKnowledgeStatusItem>();
  for (const it of poll) {
    if (!pollRowEligibleForKbMerge(it, 'note')) continue;
    if (it.id) byId.set(it.id.trim(), it);
    if (typeof it.snippetIndex === 'number' && Number.isFinite(it.snippetIndex)) {
      const prev = byIdx.get(it.snippetIndex);
      byIdx.set(it.snippetIndex, prev ? pickBetterKnowledgeStatusItem(prev, it) : it);
    }
  }
  if (byId.size === 0 && byIdx.size === 0) return base;
  return base.map((row, arrayIndex) => {
    const kid = typeof row.knowledgeItemId === 'string' ? row.knowledgeItemId.trim() : '';
    /** Prefer server `snippetIndex` when present — list order can differ from KB slot order. */
    const slotIndex =
      typeof row.snippetIndex === 'number' && Number.isFinite(row.snippetIndex)
        ? row.snippetIndex
        : arrayIndex;
    const u =
      kid && byId.has(kid) ? byId.get(kid) : byIdx.has(slotIndex) ? byIdx.get(slotIndex) : undefined;
    if (!u) return row;
    const pollLabel =
      u.displayLabel != null && String(u.displayLabel).trim() ? String(u.displayLabel).trim() : undefined;
    const { displayLabel: _stripDl, trainingDisplayLabel: _stripTdl, ...rest } = row;
    const pollId = typeof u.id === 'string' && u.id.trim() ? u.id.trim() : '';
    return {
      ...rest,
      ...(pollId ? { knowledgeItemId: pollId } : {}),
      trainingStatus: mergedIndexedRowTrainingStatusFromPoll(row.trainingStatus, u),
      lastTrainedAt: u.lastTrainedAt ?? row.lastTrainedAt,
      ...(u.trainingError != null && String(u.trainingError).trim()
        ? { trainingError: String(u.trainingError).trim() }
        : {}),
      ...(pollLabel !== undefined ? { displayLabel: pollLabel, trainingDisplayLabel: pollLabel } : {}),
      ...(u.displayStatus != null && String(u.displayStatus).trim()
        ? { displayStatus: String(u.displayStatus).trim() }
        : {}),
      runAfter: kbPollRunAfterIso(u),
      ...(typeof u.trainingStatus === 'string' && u.trainingStatus.trim()
        ? { kbApiTrainingStatus: u.trainingStatus.trim() }
        : {}),
      ...(typeof u.active === 'boolean' ? { active: u.active } : {}),
    };
  });
}

export function mergeTableRowsWithKbStatusPoll(
  base: TableBlock[],
  poll: CustomerKnowledgeStatusItem[] | null | undefined,
): TableBlock[] {
  if (!poll || poll.length === 0) return base;
  const byId = new Map<string, CustomerKnowledgeStatusItem>();
  const byIdx = new Map<number, CustomerKnowledgeStatusItem>();
  for (const it of poll) {
    if (!pollRowEligibleForKbMerge(it, 'table')) continue;
    if (it.id) byId.set(it.id.trim(), it);
    if (typeof it.tableIndex === 'number' && Number.isFinite(it.tableIndex)) {
      const prev = byIdx.get(it.tableIndex);
      byIdx.set(it.tableIndex, prev ? pickBetterKnowledgeStatusItem(prev, it) : it);
    }
  }
  if (byId.size === 0 && byIdx.size === 0) return base;
  return base.map((row) => {
    const kid = typeof row.knowledgeItemId === 'string' ? row.knowledgeItemId.trim() : '';
    const idx = row.tableIndex;
    const u =
      kid && byId.has(kid)
        ? byId.get(kid)
        : typeof idx === 'number' && Number.isFinite(idx)
          ? byIdx.get(idx)
          : undefined;
    if (!u) return row;
    const pollLabel =
      u.displayLabel != null && String(u.displayLabel).trim() ? String(u.displayLabel).trim() : undefined;
    const { displayLabel: _stripDl, trainingDisplayLabel: _stripTdl, ...rest } = row;
    const pollId = typeof u.id === 'string' && u.id.trim() ? u.id.trim() : '';
    return {
      ...rest,
      ...(pollId ? { knowledgeItemId: pollId } : {}),
      trainingStatus: mergedIndexedRowTrainingStatusFromPoll(row.trainingStatus, u),
      lastTrainedAt: u.lastTrainedAt ?? row.lastTrainedAt,
      ...(u.trainingError != null && String(u.trainingError).trim()
        ? { trainingError: String(u.trainingError).trim() }
        : {}),
      ...(pollLabel !== undefined ? { displayLabel: pollLabel, trainingDisplayLabel: pollLabel } : {}),
      ...(u.displayStatus != null && String(u.displayStatus).trim()
        ? { displayStatus: String(u.displayStatus).trim() }
        : {}),
      runAfter: kbPollRunAfterIso(u),
      ...(typeof u.trainingStatus === 'string' && u.trainingStatus.trim()
        ? { kbApiTrainingStatus: u.trainingStatus.trim() }
        : {}),
      ...(u.isImporting === true ? { isImporting: true as const } : {}),
      ...(typeof u.active === 'boolean' ? { active: u.active } : {}),
    };
  });
}

/** Collapse duplicate lightweight poll rows per KB `_id` (document slice only). */
function dedupeKbPollDocumentsForMerge(poll: CustomerKnowledgeStatusItem[]): CustomerKnowledgeStatusItem[] {
  const byKb = new Map<string, CustomerKnowledgeStatusItem>();
  for (const it of poll) {
    const st = typeof it.sourceType === 'string' ? it.sourceType.trim().toLowerCase() : '';
    if (st !== '' && st !== 'document') continue;
    const kbId = typeof it.id === 'string' ? it.id.trim() : '';
    if (!kbId) continue;
    const prev = byKb.get(kbId);
    byKb.set(kbId, prev ? pickBetterKnowledgeStatusItem(prev, it) : it);
  }
  return [...byKb.values()];
}

/** Merge lightweight `GET /knowledge/status?type=document` into document list rows. */
export function mergeDocumentRowsWithKbStatusPoll(
  base: DocumentRowWithKbMeta[],
  poll: CustomerKnowledgeStatusItem[] | null | undefined,
  docKey: (row: DocumentRowWithKbMeta) => string,
  isClientPendingId: (id: string) => boolean,
): DocumentRowWithKbMeta[] {
  if (!poll || poll.length === 0) return base;
  const pollDocs = dedupeKbPollDocumentsForMerge(poll);
  const byDocId = new Map<string, CustomerKnowledgeStatusItem>();
  const byKbItemId = new Map<string, CustomerKnowledgeStatusItem>();
  for (const it of pollDocs) {
    const kbId = typeof it.id === 'string' ? it.id.trim() : '';
    if (kbId) byKbItemId.set(kbId, it);
    const legacy = typeof it.documentId === 'string' ? it.documentId.trim() : '';
    if (legacy) byDocId.set(legacy, it);
    if (kbId) byDocId.set(kbId, it);
  }
  if (byDocId.size === 0 && byKbItemId.size === 0) return base;

  const merged = base.map((row) => {
    const kid = typeof row.knowledgeItemId === 'string' ? row.knowledgeItemId.trim() : '';
    let u: CustomerKnowledgeStatusItem | undefined =
      kid && byKbItemId.has(kid) ? byKbItemId.get(kid) : undefined;
    if (!u) {
      const id = docKey(row);
      if (!id || isClientPendingId(id)) return row;
      u = byDocId.get(id);
    }
    if (!u) return row;
    const baseCanon = baselineDocumentRowTrainingStatus(row);
    const st = mergeDocumentRowCanonicalTrainingStatus(baseCanon, u.status, {
      latestIngestJobStatus: u.latestIngestJobStatus ?? null,
      extractionStatus: u.extractionStatus ?? null,
      displayStatus: u.displayStatus ?? null,
      trainingStatus: u.trainingStatus ?? null,
    });
    const next: DocumentRowWithKbMeta = {
      ...row,
      knowledgeItemId: u.id,
      ...(typeof u.active === 'boolean' ? { active: u.active } : {}),
      trainingStatus: st,
      lastQueuedAt: u.lastQueuedAt ?? null,
      runAfter: u.runAfter ?? null,
      lastTrainingStartedAt: u.lastTrainingStartedAt ?? null,
      lastTrainedAt: u.lastTrainedAt ?? null,
      ...(u.extractionStatus != null && String(u.extractionStatus).trim()
        ? { extractionStatus: String(u.extractionStatus).trim() }
        : {}),
      ...(u.displayStatus != null && String(u.displayStatus).trim()
        ? { displayStatus: String(u.displayStatus).trim() }
        : {}),
      ...(u.displayMessage != null && String(u.displayMessage).trim()
        ? { displayMessage: String(u.displayMessage).trim() }
        : {}),
      ...(u.displayLabel != null && String(u.displayLabel).trim()
        ? { trainingDisplayLabel: String(u.displayLabel).trim() }
        : {}),
      ...(u.documentStatus != null && String(u.documentStatus).trim()
        ? { documentStatus: String(u.documentStatus).trim() }
        : {}),
      ...(u.updatedAt != null ? { updatedAt: u.updatedAt } : {}),
    };
    const exErr =
      u.extractionError != null && String(u.extractionError).trim()
        ? String(u.extractionError).trim()
        : undefined;
    if (exErr) next.extractionError = exErr;
    const te =
      u.trainingError != null && String(u.trainingError).trim() ? String(u.trainingError).trim() : undefined;
    if (te) next.trainingError = te;
    const pollUtf8 = u.storedTextUtf8Bytes;
    if (typeof pollUtf8 === 'number' && Number.isFinite(pollUtf8) && pollUtf8 > 0) {
      next.storedTextUtf8Bytes = pollUtf8;
    }
    if (st === 'ready' && u.lastTrainedAt) {
      next.ingestedAt = u.lastTrainedAt;
    }
    return next;
  });

  const covered = new Set<string>();
  for (const row of merged) {
    const id = docKey(row);
    if (id && !isClientPendingId(id)) covered.add(id);
    const rk = typeof row.knowledgeItemId === 'string' ? row.knowledgeItemId.trim() : '';
    if (rk) covered.add(rk);
  }

  const extras: DocumentRowWithKbMeta[] = [];
  for (const u of pollDocs) {
    const kbId = typeof u.id === 'string' ? u.id.trim() : '';
    const legacyDoc = typeof u.documentId === 'string' ? u.documentId.trim() : '';
    const routeKey = legacyDoc || kbId;
    if (!routeKey || isClientPendingId(routeKey)) continue;
    if (covered.has(routeKey) || (kbId && covered.has(kbId))) continue;

    const st = mergeDocumentRowCanonicalTrainingStatus('pending', u.status, {
      latestIngestJobStatus: u.latestIngestJobStatus ?? null,
      extractionStatus: u.extractionStatus ?? null,
      displayStatus: u.displayStatus ?? null,
      trainingStatus: u.trainingStatus ?? null,
    });
    const title =
      typeof u.displayLabel === 'string' && u.displayLabel.trim()
        ? u.displayLabel.trim()
        : typeof u.displayMessage === 'string' && u.displayMessage.trim()
          ? u.displayMessage.trim().slice(0, 160)
          : 'Document';

    const next: DocumentRowWithKbMeta = {
      _id: routeKey,
      knowledgeItemId: kbId || undefined,
      title,
      ...(typeof u.active === 'boolean' ? { active: u.active } : {}),
      trainingStatus: st,
      status: st,
      lastQueuedAt: u.lastQueuedAt ?? null,
      runAfter: u.runAfter ?? null,
      lastTrainingStartedAt: u.lastTrainingStartedAt ?? null,
      lastTrainedAt: u.lastTrainedAt ?? null,
      ...(u.extractionStatus != null && String(u.extractionStatus).trim()
        ? { extractionStatus: String(u.extractionStatus).trim() }
        : {}),
      ...(u.displayStatus != null && String(u.displayStatus).trim()
        ? { displayStatus: String(u.displayStatus).trim() }
        : {}),
      ...(u.displayMessage != null && String(u.displayMessage).trim()
        ? { displayMessage: String(u.displayMessage).trim() }
        : {}),
      ...(u.displayLabel != null && String(u.displayLabel).trim()
        ? { trainingDisplayLabel: String(u.displayLabel).trim(), displayLabel: String(u.displayLabel).trim() }
        : {}),
      ...(u.documentStatus != null && String(u.documentStatus).trim()
        ? { documentStatus: String(u.documentStatus).trim() }
        : {}),
      ...(u.updatedAt != null ? { updatedAt: u.updatedAt } : {}),
    };
    const exErr =
      u.extractionError != null && String(u.extractionError).trim()
        ? String(u.extractionError).trim()
        : undefined;
    if (exErr) next.extractionError = exErr;
    const te =
      u.trainingError != null && String(u.trainingError).trim() ? String(u.trainingError).trim() : undefined;
    if (te) next.trainingError = te;
    const pollUtf8 = u.storedTextUtf8Bytes;
    if (typeof pollUtf8 === 'number' && Number.isFinite(pollUtf8) && pollUtf8 > 0) {
      next.storedTextUtf8Bytes = pollUtf8;
    }
    if (st === 'ready' && u.lastTrainedAt) {
      next.ingestedAt = u.lastTrainedAt;
    }
    extras.push(next);
  }

  return extras.length > 0 ? [...merged, ...extras] : merged;
}

export function previewText(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

export const cardClass =
  'w-full min-w-0 overflow-visible border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]';
