/**
 * Single source of truth for per-item Knowledge Base status **labels**, **tones**, and **dot canon**
 * (training lifecycle colors). Pipeline order is fixed so import/extraction always wins over training,
 * matching product rules and avoiding list/detail flicker when poll rows disagree.
 */
import type { CustomerWorkspaceDocument } from '@/api/types';
import { isKbPlanLimitTrainingError } from '@/lib/knowledgeStorageLimits';
import { TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT } from '@/lib/trainedKnowledgeStorageCopy';
import {
  baselineDocumentRowTrainingStatus,
  normalizeKnowledgeTrainingStatus,
  type KnowledgeTrainingStatus,
} from '@/lib/knowledgeTrainingStatus';

export type KnowledgeItemDisplayTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

/** Training / pipeline dot colors (same codes as {@link KnowledgeTrainingStatus} + storage limit). */
export type KnowledgeItemDisplayDotCanon = KnowledgeTrainingStatus;

export type KnowledgeItemDisplayResult = {
  key: string;
  label: string;
  tone: KnowledgeItemDisplayTone;
  isBusy: boolean;
  canRetry?: boolean;
  /** Drives {@link knowledgeTrainingStatusBadgeClassName} / dot classes. */
  dotCanon: KnowledgeItemDisplayDotCanon;
};

export type WorkspaceDocumentDisplayOptions = {
  autoTrainEnabled?: boolean | null;
};

export type KnowledgeItemDisplayInput = {
  sourceType: string;
  /** Ignored by {@link getKnowledgeItemDisplayStatus}; reply usage is {@link getKnowledgeItemReplyUsageLabel}. */
  active?: boolean;
  /** Primary KB training lifecycle (`KnowledgeBaseItem.status` / merged poll). */
  status?: string | null;
  /** API `trainingStatus` string (import/storage codes) — checked before normalizing `status`. */
  trainingStatus?: string | null;
  displayStatus?: string | null;
  displayLabel?: string | null;
  trainingDisplayLabel?: string | null;
  extractionStatus?: string | null;
  extractionError?: string | null;
  trainingError?: string | null;
  uploadStatus?: string | null;
  isContentExtracted?: boolean;
  /** Table `tableMeta.importPhase` when available. */
  tableImportPhase?: string | null;
  isImporting?: boolean;
  isExtracting?: boolean;
  isTraining?: boolean;
  extractManualRetrySuggested?: boolean;
  trainingManualRetrySuggested?: boolean;
  /** Workspace document text metrics (aligns with list row “has extractable text” heuristics). */
  characterCount?: number | null;
  extractedTextLength?: number | null;
  /**
   * Workspace Knowledge Overview — when `true`, `pending` after extraction reads as **Training Queued**
   * (auto-queue path); when `false`, **Training Required** (manual train).
   */
  autoTrainEnabled?: boolean | null;
  /** Enriched list/detail `documentStatus` / `status` when it matches backend pipeline stage codes. */
  documentPipelineStage?: string | null;
};

/** Aligned with `DOCUMENT_PIPELINE_STAGE_CODES` in `knowledgeViewTypes` (avoid importing to prevent cycles). */
const DOC_PIPELINE_STAGE_LOWER = new Set([
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
]);

function readDocumentPipelineStage(doc: CustomerWorkspaceDocument): string | null {
  const raw = String(
    (doc as { documentStatus?: unknown }).documentStatus ?? (doc as { status?: unknown }).status ?? '',
  )
    .trim()
    .toLowerCase();
  return raw && DOC_PIPELINE_STAGE_LOWER.has(raw) ? raw : null;
}

function lc(s: string | null | undefined): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function nt(raw: unknown): KnowledgeTrainingStatus {
  return normalizeKnowledgeTrainingStatus(raw as string | number | boolean | null | undefined);
}

function documentInputContentExtracted(input: KnowledgeItemDisplayInput): boolean {
  if (input.isContentExtracted === true) return true;
  const c = input.characterCount;
  if (typeof c === 'number' && c > 0) return true;
  const e = input.extractedTextLength;
  if (typeof e === 'number' && e > 0) return true;
  return false;
}

function documentExtractionPipelineActive(input: KnowledgeItemDisplayInput): boolean {
  const ex = lc(input.extractionStatus);
  return (
    ex === 'queued' ||
    ex === 'processing' ||
    ex === 'waiting_for_source' ||
    (input.isExtracting === true && ex !== 'done' && ex !== 'not_required' && ex !== 'failed')
  );
}

/** File stored; extraction not actively running yet (`uploadStatus: uploaded` or pipeline `pending_extraction`). */
function documentUploadedAwaitingExtraction(input: KnowledgeItemDisplayInput): boolean {
  if (lc(input.sourceType) !== 'document') return false;
  if (documentInputContentExtracted(input)) return false;
  const upload = lc(input.uploadStatus);
  if (upload === 'uploading' || upload === 'upload_failed') return false;
  const stage = lc(input.documentPipelineStage);
  if (documentExtractionPipelineActive(input)) return false;
  const ex = lc(input.extractionStatus);
  if (ex === 'failed') return false;
  if (stage === 'pending_extraction') return true;
  return upload === 'uploaded';
}

/**
 * Backend may set KB lifecycle to pending/queued before extract fields appear. Prefer **Extracting** until text exists
 * (unless {@link documentUploadedAwaitingExtraction} applies).
 */
function documentDeferTrainingLabelUntilTextExists(input: KnowledgeItemDisplayInput): KnowledgeItemDisplayResult | null {
  if (lc(input.sourceType) !== 'document') return null;
  if (documentInputContentExtracted(input)) return null;
  const st = nt(input.status);
  if (st !== 'pending' && st !== 'queued' && st !== 'processing') return null;
  const upload = lc(input.uploadStatus);
  if (upload === 'uploading' || upload === 'upload_failed') return null;
  const ex = lc(input.extractionStatus);
  if (ex === 'done' || ex === 'not_required') return null;
  return { key: 'extracting', label: 'Extracting', tone: 'info', isBusy: true, dotCanon: 'processing' };
}

/** Customer-facing line for the “Use in replies” dimension (separate from training lifecycle). */
export function getKnowledgeItemReplyUsageLabel(active?: boolean): 'Used in replies' | 'Not used in replies' {
  return active === false ? 'Not used in replies' : 'Used in replies';
}

/**
 * Maps a workspace document row (including poll merge fields) into {@link KnowledgeItemDisplayInput}.
 */
export function workspaceDocumentToDisplayInput(
  doc: CustomerWorkspaceDocument,
  opts?: WorkspaceDocumentDisplayOptions,
): KnowledgeItemDisplayInput {
  const ext = doc as CustomerWorkspaceDocument & {
    trainingDisplayLabel?: string | null;
    displayLabel?: string | null;
    displayStatus?: string | null;
    extractionStatus?: string | null;
    extractionError?: string | null;
    trainingError?: string | null;
    uploadStatus?: string | null;
    isImporting?: boolean;
    isExtracting?: boolean;
    isTraining?: boolean;
    extractManualRetrySuggested?: boolean;
    trainingManualRetrySuggested?: boolean;
  };
  const upload =
    typeof ext.uploadStatus === 'string' && ext.uploadStatus.trim()
      ? ext.uploadStatus.trim().toLowerCase()
      : typeof (ext as { fileMeta?: { uploadStatus?: string } }).fileMeta?.uploadStatus === 'string'
        ? String((ext as { fileMeta?: { uploadStatus?: string } }).fileMeta!.uploadStatus).trim().toLowerCase()
        : '';
  return {
    sourceType: 'document',
    active: ext.active !== false,
    status: baselineDocumentRowTrainingStatus(ext),
    trainingStatus:
      typeof (ext as { trainingStatus?: string }).trainingStatus === 'string'
        ? (ext as { trainingStatus?: string }).trainingStatus
        : null,
    displayStatus: typeof ext.displayStatus === 'string' ? ext.displayStatus : null,
    displayLabel: typeof ext.displayLabel === 'string' ? ext.displayLabel : null,
    trainingDisplayLabel: typeof ext.trainingDisplayLabel === 'string' ? ext.trainingDisplayLabel : null,
    extractionStatus: typeof ext.extractionStatus === 'string' ? ext.extractionStatus : null,
    extractionError: typeof ext.extractionError === 'string' ? ext.extractionError : null,
    trainingError: typeof ext.trainingError === 'string' ? ext.trainingError : null,
    uploadStatus: upload || null,
    isContentExtracted: ext.isContentExtracted === true,
    isImporting: ext.isImporting === true,
    isExtracting: ext.isExtracting === true,
    isTraining: ext.isTraining === true,
    extractManualRetrySuggested: ext.extractManualRetrySuggested === true,
    trainingManualRetrySuggested: ext.trainingManualRetrySuggested === true,
    characterCount: typeof ext.characterCount === 'number' ? ext.characterCount : null,
    extractedTextLength: typeof ext.extractedTextLength === 'number' ? ext.extractedTextLength : null,
    autoTrainEnabled: opts?.autoTrainEnabled,
    documentPipelineStage: readDocumentPipelineStage(ext),
  };
}

/**
 * Priority-ordered display status for all KB source types. Field-driven first so stale `displayLabel`
 * cannot mask active import/extraction.
 */
export function getKnowledgeItemDisplayStatus(input: KnowledgeItemDisplayInput): KnowledgeItemDisplayResult {
  const src = lc(input.sourceType) || 'unknown';
  const isDocument = src === 'document';
  const isTable = src === 'table';
  const ex = lc(input.extractionStatus);
  const ds = lc(input.displayStatus);
  const tsApi = lc(input.trainingStatus);
  const st = nt(input.status);
  const upload = lc(input.uploadStatus);
  const phase = lc(input.tableImportPhase);

  if (isKbPlanLimitTrainingError(input.trainingError) || ds === 'out_of_storage' || tsApi === 'out_of_storage') {
    return {
      key: 'out_of_storage',
      label: TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT,
      tone: 'danger',
      isBusy: false,
      dotCanon: 'out_of_storage',
    };
  }

  if (isDocument) {
    const docPipeEarly = lc(input.documentPipelineStage);
    if (upload === 'uploading' || docPipeEarly === 'uploading') {
      return { key: 'uploading', label: 'Uploading', tone: 'info', isBusy: true, dotCanon: 'processing' };
    }
    if (upload === 'upload_failed') {
      return { key: 'upload_failed', label: 'Upload failed', tone: 'danger', isBusy: false, dotCanon: 'failed' };
    }
  }

  const importActive =
    isTable &&
    (input.isImporting === true ||
      ds === 'import_queued' ||
      ds === 'importing' ||
      ds === 'importing_table' ||
      phase === 'import_queued' ||
      phase === 'importing' ||
      phase === 'importing_table');
  if (importActive) {
    return { key: 'importing', label: 'Importing', tone: 'info', isBusy: true, dotCanon: 'processing' };
  }

  const importFailed = isTable && (ds === 'import_failed' || phase === 'import_failed');
  if (importFailed) {
    return {
      key: 'import_failed',
      label: 'Import failed',
      tone: 'danger',
      isBusy: false,
      dotCanon: 'failed',
      canRetry: input.trainingManualRetrySuggested === true,
    };
  }

  if (isDocument) {
    if (ex === 'failed' || ds === 'extraction_failed') {
      return {
        key: 'extraction_failed',
        label: 'Extraction failed',
        tone: 'danger',
        isBusy: false,
        dotCanon: 'failed',
        canRetry: input.extractManualRetrySuggested === true,
      };
    }
    if (documentUploadedAwaitingExtraction(input)) {
      return { key: 'uploaded', label: 'Uploaded', tone: 'info', isBusy: false, dotCanon: 'pending' };
    }
    const stage = lc(input.documentPipelineStage);
    const extracting =
      ex === 'queued' ||
      ex === 'processing' ||
      ex === 'waiting_for_source' ||
      stage === 'extract_queued' ||
      stage === 'extract_processing' ||
      (input.isExtracting === true && ex !== 'done' && ex !== 'not_required' && ex !== 'failed');
    if (extracting) {
      return { key: 'extracting', label: 'Extracting', tone: 'info', isBusy: true, dotCanon: 'processing' };
    }
    const deferTrainingUntilExtracted = documentDeferTrainingLabelUntilTextExists(input);
    if (deferTrainingUntilExtracted) return deferTrainingUntilExtracted;
  }

  /**
   * KB `isTraining` is a coarse “work in flight” flag and is often true while `status` is still `queued`.
   * Never let it override canonical lifecycle: queued → Training Queued, pending → Training Required, processing → Training.
   * Reply usage (`active`) is ignored here — see {@link getKnowledgeItemReplyUsageLabel}.
   */
  if (st === 'queued') {
    return { key: 'queued', label: 'Training Queued', tone: 'warning', isBusy: false, dotCanon: 'queued' };
  }

  if (st === 'pending') {
    if (
      isDocument &&
      documentInputContentExtracted(input) &&
      input.autoTrainEnabled === true
    ) {
      return {
        key: 'queued',
        label: 'Training Queued',
        tone: 'warning',
        isBusy: false,
        dotCanon: 'queued',
      };
    }
    return {
      key: 'needs_training',
      label: 'Training Required',
      tone: 'warning',
      isBusy: false,
      dotCanon: 'pending',
    };
  }

  if (st === 'processing') {
    return { key: 'training', label: 'Training', tone: 'info', isBusy: true, dotCanon: 'processing' };
  }

  if (st === 'ready') {
    return { key: 'ready', label: 'Trained', tone: 'success', isBusy: false, dotCanon: 'ready' };
  }

  if (st === 'failed') {
    return {
      key: 'training_failed',
      label: 'Training Failed',
      tone: 'danger',
      isBusy: false,
      dotCanon: 'failed',
      canRetry: input.trainingManualRetrySuggested === true,
    };
  }

  return {
    key: 'unknown',
    label: '—',
    tone: 'neutral',
    isBusy: false,
    dotCanon: 'pending',
  };
}
